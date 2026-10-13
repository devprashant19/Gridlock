// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GridUSD.sol";
import "./HourToken.sol";
import "./IndexOracle.sol";
import "./SeriesFactory.sol";

contract DeliveryEscrow {
    enum Status { None, Requested, Provisioned, Settled, TimedOut }
    enum Verdict { None, Pass, Degraded, Fail }

    struct ProviderState {
        string name;
        bool registered;
    }

    struct Delivery {
        uint256 seriesId;
        address buyer;
        address provider;
        uint256 hours_;
        bytes32 buyerEncPubKey;
        uint64 deadline;
        uint64 provisionedAt;
        uint256 bondAmount;
        Status status;
        bytes ciphertext;
        Verdict verdict;
        uint32 tflopsE2;
        bytes32 resultRoot;
    }

    GridUSD public immutable gridUSD;
    IndexOracle public immutable oracle;
    SeriesFactory public factory;
    address public owner;
    address public verifierSigner;
    address public forwarder;

    // EIP-712 Domain Separator constants
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant VERDICT_TYPEHASH = keccak256("Verdict(uint256 deliveryId,uint8 verdict,uint32 tflopsE2,bytes32 resultRoot)");
    bytes32 public immutable DOMAIN_SEPARATOR;

    // State
    mapping(address => ProviderState) public providers;
    mapping(uint256 => address[]) internal queue; // seriesId => provider FIFO queue
    mapping(uint256 => mapping(address => uint256)) public openHours; // seriesId => provider => hours open
    mapping(uint256 => mapping(address => uint256)) public bondPerHour; // seriesId => provider => bond per hour (6 decimals)
    
    Delivery[] public deliveries;

    // Events
    event ProviderRegistered(address indexed provider, string name);
    event Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond);
    event DeliveryRequested(
        uint256 indexed deliveryId,
        uint256 indexed seriesId,
        address indexed buyer,
        address provider,
        uint256 hours_,
        bytes32 buyerEncPubKey,
        uint64 deadline
    );
    event Provisioned(uint256 indexed deliveryId, bytes ciphertext);
    event Settled(
        uint256 indexed deliveryId,
        uint8 verdict,
        uint32 tflopsE2,
        uint256 toBuyer,
        uint256 toProvider
    );
    event TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider);
    event VerifierSignerUpdated(address indexed signer);
    event ForwarderUpdated(address indexed forwarder);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyForwarder() {
        require(msg.sender == forwarder, "Only forwarder");
        _;
    }

    constructor(address _gridUSD, address _oracle, address _verifierSigner) {
        gridUSD = GridUSD(_gridUSD);
        oracle = IndexOracle(_oracle);
        verifierSigner = _verifierSigner;
        owner = msg.sender;

        DOMAIN_SEPARATOR = keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256(bytes("Gridlock Verifier")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function setFactory(address _factory) external onlyOwner {
        factory = SeriesFactory(_factory);
    }

    function setVerifierSigner(address _signer) external onlyOwner {
        verifierSigner = _signer;
        emit VerifierSignerUpdated(_signer);
    }

    function setForwarder(address _forwarder) external onlyOwner {
        forwarder = _forwarder;
        emit ForwarderUpdated(_forwarder);
    }

    function registerProvider(string calldata name) external {
        providers[msg.sender] = ProviderState({
            name: name,
            registered: true
        });
        emit ProviderRegistered(msg.sender, name);
    }

    function mint(uint256 seriesId, uint256 hours_) external returns (uint256 bond) {
        require(providers[msg.sender].registered, "Provider not registered");
        require(hours_ > 0, "Hours must be > 0");
        require(seriesId < factory.seriesCount(), "Invalid seriesId");
        (bytes32 gpuClass, address token, , , ) = factory.series(seriesId);
        
        (uint128 priceE8, ) = oracle.latest(gpuClass);
        // Bond (6dp) = hours * priceE8 * 120 / 100 / 100
        bond = (hours_ * uint256(priceE8) * 120) / 10000;
        
        require(gridUSD.transferFrom(msg.sender, address(this), bond), "Bond transfer failed");
        HourToken(token).mint(msg.sender, hours_ * 1e18);

        uint256 currentOpen = openHours[seriesId][msg.sender];
        if (currentOpen == 0) {
            queue[seriesId].push(msg.sender);
            bondPerHour[seriesId][msg.sender] = bond / hours_;
        } else {
            uint256 totalExistingBond = currentOpen * bondPerHour[seriesId][msg.sender];
            uint256 totalNewBond = totalExistingBond + bond;
            bondPerHour[seriesId][msg.sender] = totalNewBond / (currentOpen + hours_);
        }
        openHours[seriesId][msg.sender] = currentOpen + hours_;

        emit Minted(seriesId, msg.sender, hours_, bond);
    }

    function redeem(
        uint256 seriesId,
        uint256 hours_,
        bytes32 buyerEncPubKey
    ) external returns (uint256 deliveryId) {
        require(hours_ > 0, "Hours must be > 0");
        (, address token, uint64 windowStart, uint64 windowEnd, ) = factory.series(seriesId);
        require(block.timestamp >= windowStart && block.timestamp <= windowEnd, "Not within series window");

        HourToken(token).burn(msg.sender, hours_ * 1e18);

        // FIFO match to first provider with sufficient open hours
        address assignedProvider = address(0);
        address[] storage q = queue[seriesId];
        for (uint256 i = 0; i < q.length; i++) {
            address p = q[i];
            if (openHours[seriesId][p] >= hours_) {
                assignedProvider = p;
                openHours[seriesId][p] -= hours_;
                break;
            }
        }
        require(assignedProvider != address(0), "No provider with sufficient capacity");

        uint256 bondRate = bondPerHour[seriesId][assignedProvider];
        uint256 deliveryBond = bondRate * hours_;
        uint64 deadline = uint64(block.timestamp + 2 hours);

        deliveryId = deliveries.length;
        deliveries.push(Delivery({
            seriesId: seriesId,
            buyer: msg.sender,
            provider: assignedProvider,
            hours_: hours_,
            buyerEncPubKey: buyerEncPubKey,
            deadline: deadline,
            provisionedAt: 0,
            bondAmount: deliveryBond,
            status: Status.Requested,
            ciphertext: "",
            verdict: Verdict.None,
            tflopsE2: 0,
            resultRoot: bytes32(0)
        }));

        emit DeliveryRequested(
            deliveryId,
            seriesId,
            msg.sender,
            assignedProvider,
            hours_,
            buyerEncPubKey,
            deadline
        );
    }

    function provision(uint256 deliveryId, bytes calldata ciphertext) external {
        require(deliveryId < deliveries.length, "Invalid deliveryId");
        Delivery storage d = deliveries[deliveryId];
        require(msg.sender == d.provider, "Only assigned provider");
        require(d.status == Status.Requested, "Invalid status");
        require(block.timestamp <= d.deadline, "Provisioning deadline passed");
        require(ciphertext.length > 0, "Empty ciphertext");

        d.status = Status.Provisioned;
        d.provisionedAt = uint64(block.timestamp);
        d.ciphertext = ciphertext;

        emit Provisioned(deliveryId, ciphertext);
    }

    function settleWithSig(
        uint256 deliveryId,
        uint8 verdict,
        uint32 tflopsE2,
        bytes32 resultRoot,
        bytes calldata signature
    ) external {
        bytes32 structHash = keccak256(abi.encode(
            VERDICT_TYPEHASH,
            deliveryId,
            verdict,
            tflopsE2,
            resultRoot
        ));
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = _recoverSigner(hash, signature);
        require(signer == verifierSigner, "Invalid verifier signature");

        _settle(deliveryId, verdict, tflopsE2, resultRoot);
    }

    function onReport(bytes calldata report) external onlyForwarder {
        (uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot) = 
            abi.decode(report, (uint256, uint8, uint32, bytes32));
        _settle(deliveryId, verdict, tflopsE2, resultRoot);
    }

    function _settle(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot) internal {
        require(deliveryId < deliveries.length, "Invalid deliveryId");
        Delivery storage d = deliveries[deliveryId];
        require(d.status == Status.Provisioned, "Not provisioned");
        require(verdict >= 1 && verdict <= 3, "Invalid verdict");

        d.status = Status.Settled;
        d.verdict = Verdict(verdict);
        d.tflopsE2 = tflopsE2;
        d.resultRoot = resultRoot;

        uint256 toBuyer = 0;
        uint256 toProvider = 0;

        if (verdict == 1) { // PASS: 100% to provider
            toProvider = d.bondAmount;
        } else if (verdict == 2) { // DEGRADED: 70% provider, 30% buyer
            toProvider = (d.bondAmount * 70) / 100;
            toBuyer = d.bondAmount - toProvider;
        } else if (verdict == 3) { // FAIL: 100% to buyer
            toBuyer = d.bondAmount;
        }

        if (toBuyer > 0) {
            require(gridUSD.transfer(d.buyer, toBuyer), "Buyer transfer failed");
        }
        if (toProvider > 0) {
            require(gridUSD.transfer(d.provider, toProvider), "Provider transfer failed");
        }

        emit Settled(deliveryId, verdict, tflopsE2, toBuyer, toProvider);
    }

    function claimTimeout(uint256 deliveryId) external {
        require(deliveryId < deliveries.length, "Invalid deliveryId");
        Delivery storage d = deliveries[deliveryId];
        
        uint256 toBuyer = 0;
        uint256 toProvider = 0;

        if (d.status == Status.Requested && block.timestamp > d.deadline) {
            // Provider failed to provision within 2h -> buyer gets full bond
            d.status = Status.TimedOut;
            toBuyer = d.bondAmount;
            require(gridUSD.transfer(d.buyer, toBuyer), "Transfer to buyer failed");
        } else if (
            d.status == Status.Provisioned && 
            block.timestamp > d.provisionedAt + (d.hours_ * 1 hours) + 1 hours
        ) {
            // Verifier never settled after rental ended + 1h buffer -> provider gets bond
            d.status = Status.TimedOut;
            toProvider = d.bondAmount;
            require(gridUSD.transfer(d.provider, toProvider), "Transfer to provider failed");
        } else {
            revert("Timeout condition not met");
        }

        emit TimeoutClaimed(deliveryId, toBuyer, toProvider);
    }

    function withdrawUnsold(uint256 seriesId) external {
        uint256 hours_ = openHours[seriesId][msg.sender];
        require(hours_ > 0, "No open hours to withdraw");
        withdrawUnsold(seriesId, hours_);
    }

    function withdrawUnsold(uint256 seriesId, uint256 hours_) public {
        require(hours_ > 0, "Hours must be > 0");
        (, address token, , uint64 windowEnd, ) = factory.series(seriesId);
        require(block.timestamp > windowEnd, "Series window has not ended");
        require(openHours[seriesId][msg.sender] >= hours_, "Insufficient open hours");

        openHours[seriesId][msg.sender] -= hours_;
        uint256 refundBond = bondPerHour[seriesId][msg.sender] * hours_;
        if (openHours[seriesId][msg.sender] == 0) {
            bondPerHour[seriesId][msg.sender] = 0;
        }

        HourToken(token).burn(msg.sender, hours_ * 1e18);
        require(gridUSD.transfer(msg.sender, refundBond), "Refund transfer failed");
    }

    function getDelivery(uint256 deliveryId) external view returns (Delivery memory) {
        require(deliveryId < deliveries.length, "Invalid deliveryId");
        return deliveries[deliveryId];
    }

    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature 'v' value");
        return ecrecover(hash, v, r, s);
    }
}

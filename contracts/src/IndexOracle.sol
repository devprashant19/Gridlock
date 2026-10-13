// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract IndexOracle {
    address public owner;
    address public forwarder;

    struct PricePrint {
        uint128 priceE8;
        uint64 dayKey;
    }

    mapping(bytes32 => PricePrint) public latestPrints;

    event PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8);
    event ForwarderUpdated(address indexed forwarder);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyOwnerOrForwarder() {
        require(msg.sender == owner || msg.sender == forwarder, "Only owner or forwarder");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setForwarder(address _forwarder) external onlyOwner {
        forwarder = _forwarder;
        emit ForwarderUpdated(_forwarder);
    }

    function setFixedPrice(string calldata className, uint128 priceE8) external onlyOwner {
        bytes32 classHash = keccak256(bytes(className));
        uint64 dayKey = uint64(block.timestamp);
        latestPrints[classHash] = PricePrint({
            priceE8: priceE8,
            dayKey: dayKey
        });
        emit PrintPublished(classHash, dayKey, priceE8);
    }

    function pushPrint(bytes32 gpuClass, uint64 dayKey, uint128 priceE8) external onlyOwnerOrForwarder {
        latestPrints[gpuClass] = PricePrint({
            priceE8: priceE8,
            dayKey: dayKey
        });
        emit PrintPublished(gpuClass, dayKey, priceE8);
    }

    function onReport(bytes calldata report) external {
        require(msg.sender == forwarder, "Only forwarder");
        (bytes32 gpuClass, uint64 dayKey, uint128 priceE8) = abi.decode(report, (bytes32, uint64, uint128));
        latestPrints[gpuClass] = PricePrint({
            priceE8: priceE8,
            dayKey: dayKey
        });
        emit PrintPublished(gpuClass, dayKey, priceE8);
    }

    function latest(bytes32 gpuClass) external view returns (uint128 priceE8, uint64 dayKey) {
        PricePrint memory p = latestPrints[gpuClass];
        require(p.priceE8 > 0, "Price not set for class");
        return (p.priceE8, p.dayKey);
    }
}

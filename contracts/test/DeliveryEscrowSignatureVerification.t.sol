// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowSignatureVerificationTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;
    uint256 internal deliveryId;
    uint256 internal wrongSignerPk = 0x99991111;

    function setUp() public override {
        super.setUp();

        (activeSeriesId, , , ) = _createDeterministicActiveSeries(A100_CLASS, "gA100-ACT", 7 days);
        (, address tokenAddr, , , ) = factory.series(activeSeriesId);
        token = HourToken(tokenAddr);

        vm.prank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");

        _fundWithGridUSD(PROVIDER1, 10_000 * 1e6);
        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), type(uint256).max);

        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 20);

        vm.prank(address(escrow));
        token.mint(BUYER, 10 * 1e18);

        vm.prank(BUYER);
        deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");
    }

    function _buildDigest(
        bytes32 domainSeparator,
        uint256 id,
        uint8 verdict,
        uint32 tflopsE2,
        bytes32 resultRoot
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            escrow.VERDICT_TYPEHASH(),
            id,
            verdict,
            tflopsE2,
            resultRoot
        ));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _sign(uint256 privateKey, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_ValidSignature_Acceptance() public {
        uint8 verdict = 1;
        uint32 tflops = 30000;
        bytes32 root = keccak256("valid_root");
        bytes32 digest = _buildDigest(escrow.DOMAIN_SEPARATOR(), deliveryId, verdict, tflops, root);
        bytes memory sig = _sign(VERIFIER_PK, digest);

        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Settled));
        assertEq(uint256(d.verdict), uint256(DeliveryEscrow.Verdict.Pass));
    }

    function test_RevertWhen_WrongSigner() public {
        uint8 verdict = 1;
        uint32 tflops = 30000;
        bytes32 root = keccak256("valid_root");
        bytes32 digest = _buildDigest(escrow.DOMAIN_SEPARATOR(), deliveryId, verdict, tflops, root);
        bytes memory sig = _sign(wrongSignerPk, digest);

        vm.expectRevert("Invalid verifier signature");
        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);
    }

    function test_RevertWhen_WrongChainId() public {
        bytes32 wrongChainDomain = keccak256(abi.encode(
            escrow.DOMAIN_TYPEHASH(),
            keccak256(bytes("Gridlock Verifier")),
            keccak256(bytes("1")),
            block.chainid + 999, // wrong chain ID
            address(escrow)
        ));
        uint8 verdict = 1;
        uint32 tflops = 30000;
        bytes32 root = keccak256("valid_root");
        bytes32 digest = _buildDigest(wrongChainDomain, deliveryId, verdict, tflops, root);
        bytes memory sig = _sign(VERIFIER_PK, digest);

        vm.expectRevert("Invalid verifier signature");
        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);
    }

    function test_RevertWhen_WrongVerifyingContract() public {
        bytes32 wrongContractDomain = keccak256(abi.encode(
            escrow.DOMAIN_TYPEHASH(),
            keccak256(bytes("Gridlock Verifier")),
            keccak256(bytes("1")),
            block.chainid,
            address(0xdeadbeef) // wrong contract address
        ));
        uint8 verdict = 1;
        uint32 tflops = 30000;
        bytes32 root = keccak256("valid_root");
        bytes32 digest = _buildDigest(wrongContractDomain, deliveryId, verdict, tflops, root);
        bytes memory sig = _sign(VERIFIER_PK, digest);

        vm.expectRevert("Invalid verifier signature");
        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);
    }

    function test_RevertWhen_TamperedVerdict() public {
        uint8 signedVerdict = 1; // PASS
        uint8 tamperedVerdict = 2; // DEGRADED
        uint32 tflops = 30000;
        bytes32 root = keccak256("valid_root");
        bytes32 digest = _buildDigest(escrow.DOMAIN_SEPARATOR(), deliveryId, signedVerdict, tflops, root);
        bytes memory sig = _sign(VERIFIER_PK, digest);

        // Caller submits tampered verdict
        vm.expectRevert("Invalid verifier signature");
        escrow.settleWithSig(deliveryId, tamperedVerdict, tflops, root, sig);
    }

    function test_RevertWhen_TamperedResultRoot() public {
        uint8 verdict = 1;
        uint32 tflops = 30000;
        bytes32 signedRoot = keccak256("root_A");
        bytes32 tamperedRoot = keccak256("root_B");
        bytes32 digest = _buildDigest(escrow.DOMAIN_SEPARATOR(), deliveryId, verdict, tflops, signedRoot);
        bytes memory sig = _sign(VERIFIER_PK, digest);

        vm.expectRevert("Invalid verifier signature");
        escrow.settleWithSig(deliveryId, verdict, tflops, tamperedRoot, sig);
    }

    function test_RevertWhen_MalformedSignature_Length() public {
        bytes memory shortSig = hex"0102030405";
        vm.expectRevert("Invalid signature length");
        escrow.settleWithSig(deliveryId, 1, 30000, bytes32("root"), shortSig);
    }

    function test_RevertWhen_SignatureReplay() public {
        uint8 verdict = 1;
        uint32 tflops = 30000;
        bytes32 root = keccak256("replay_root");
        bytes32 digest = _buildDigest(escrow.DOMAIN_SEPARATOR(), deliveryId, verdict, tflops, root);
        bytes memory sig = _sign(VERIFIER_PK, digest);

        // First execution succeeds
        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);

        // Second execution reverts with "Not provisioned"
        vm.expectRevert("Not provisioned");
        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);
    }
}

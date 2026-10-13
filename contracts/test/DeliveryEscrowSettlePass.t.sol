// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowSettlePassTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;
    uint256 internal deliveryId;
    uint256 internal bondAmount;

    event Settled(
        uint256 indexed deliveryId,
        uint8 verdict,
        uint32 tflopsE2,
        uint256 toBuyer,
        uint256 toProvider
    );

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
        escrow.mint(activeSeriesId, 10);

        vm.prank(address(escrow));
        token.mint(BUYER, 5 * 1e18);

        vm.prank(BUYER);
        deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_enc_pubkey_1"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        bondAmount = d.bondAmount;

        // Provision delivery
        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef12345678");
    }

    function _signVerdict(
        uint256 id,
        uint8 verdict,
        uint32 tflopsE2,
        bytes32 resultRoot
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            escrow.VERDICT_TYPEHASH(),
            id,
            verdict,
            tflopsE2,
            resultRoot
        ));
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            escrow.DOMAIN_SEPARATOR(),
            structHash
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VERIFIER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_SettlePass_WithSignature_FullProviderRelease() public {
        uint8 verdict = 1; // PASS
        uint32 tflops = 31200; // 312.00 TFLOPS
        bytes32 root = keccak256("benchmark_result_root_pass");
        bytes memory sig = _signVerdict(deliveryId, verdict, tflops, root);

        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBalBefore = gridUSD.balanceOf(BUYER);
        uint256 escrowBalBefore = gridUSD.balanceOf(address(escrow));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit Settled(deliveryId, verdict, tflops, 0, bondAmount);

        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);

        // Assert 100% bond released to provider
        assertEq(gridUSD.balanceOf(PROVIDER1), providerBalBefore + bondAmount);
        assertEq(gridUSD.balanceOf(BUYER), buyerBalBefore);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBalBefore - bondAmount);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Settled));
        assertEq(uint256(d.verdict), uint256(DeliveryEscrow.Verdict.Pass));
        assertEq(d.tflopsE2, tflops);
        assertEq(d.resultRoot, root);
    }

    function test_SettlePass_ViaForwarderReport_FullProviderRelease() public {
        uint8 verdict = 1; // PASS
        uint32 tflops = 31500;
        bytes32 root = keccak256("benchmark_result_root_pass_forwarder");
        bytes memory report = abi.encode(deliveryId, verdict, tflops, root);

        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBalBefore = gridUSD.balanceOf(BUYER);
        uint256 escrowBalBefore = gridUSD.balanceOf(address(escrow));

        vm.prank(FORWARDER);
        escrow.onReport(report);

        assertEq(gridUSD.balanceOf(PROVIDER1), providerBalBefore + bondAmount);
        assertEq(gridUSD.balanceOf(BUYER), buyerBalBefore);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBalBefore - bondAmount);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Settled));
        assertEq(uint256(d.verdict), uint256(DeliveryEscrow.Verdict.Pass));
    }
}

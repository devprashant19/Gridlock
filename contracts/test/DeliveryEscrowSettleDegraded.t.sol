// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowSettleDegradedTest is GridlockTestBase {
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

    function test_SettleDegraded_StandardSplit_70Provider_30Buyer() public {
        uint8 verdict = 2; // DEGRADED
        uint32 tflops = 22000; // 220.00 TFLOPS (below target)
        bytes32 root = keccak256("benchmark_result_root_degraded");
        bytes memory sig = _signVerdict(deliveryId, verdict, tflops, root);

        uint256 expectedToProvider = (bondAmount * 70) / 100;
        uint256 expectedToBuyer = bondAmount - expectedToProvider;

        // Verify mathematical 70/30 proportion
        assertEq(expectedToProvider + expectedToBuyer, bondAmount);

        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBalBefore = gridUSD.balanceOf(BUYER);
        uint256 escrowBalBefore = gridUSD.balanceOf(address(escrow));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit Settled(deliveryId, verdict, tflops, expectedToBuyer, expectedToProvider);

        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);

        // Assert 70% to provider, 30% to buyer
        assertEq(gridUSD.balanceOf(PROVIDER1), providerBalBefore + expectedToProvider);
        assertEq(gridUSD.balanceOf(BUYER), buyerBalBefore + expectedToBuyer);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBalBefore - bondAmount);

        // Assert no stranded collateral
        assertEq(
            (gridUSD.balanceOf(PROVIDER1) - providerBalBefore) +
            (gridUSD.balanceOf(BUYER) - buyerBalBefore),
            bondAmount
        );

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Settled));
        assertEq(uint256(d.verdict), uint256(DeliveryEscrow.Verdict.Degraded));
    }

    function test_SettleDegraded_ForwarderReport_ExactConservation() public {
        uint8 verdict = 2; // DEGRADED
        uint32 tflops = 21000;
        bytes32 root = keccak256("benchmark_result_root_degraded_fw");
        bytes memory report = abi.encode(deliveryId, verdict, tflops, root);

        uint256 expectedToProvider = (bondAmount * 70) / 100;
        uint256 expectedToBuyer = bondAmount - expectedToProvider;

        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBalBefore = gridUSD.balanceOf(BUYER);

        vm.prank(FORWARDER);
        escrow.onReport(report);

        assertEq(gridUSD.balanceOf(PROVIDER1), providerBalBefore + expectedToProvider);
        assertEq(gridUSD.balanceOf(BUYER), buyerBalBefore + expectedToBuyer);
    }
}

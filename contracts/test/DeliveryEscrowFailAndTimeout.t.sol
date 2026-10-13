// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowFailAndTimeoutTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;

    event Settled(
        uint256 indexed deliveryId,
        uint8 verdict,
        uint32 tflopsE2,
        uint256 toBuyer,
        uint256 toProvider
    );

    event TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider);

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

    function test_SettleFail_FullBuyerPayout() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 4, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint256 bondAmount = d.bondAmount;

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef1234");

        uint8 verdict = 3; // FAIL
        uint32 tflops = 5000;
        bytes32 root = keccak256("fail_root");
        bytes memory sig = _signVerdict(deliveryId, verdict, tflops, root);

        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBalBefore = gridUSD.balanceOf(BUYER);
        uint256 escrowBalBefore = gridUSD.balanceOf(address(escrow));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit Settled(deliveryId, verdict, tflops, bondAmount, 0);

        escrow.settleWithSig(deliveryId, verdict, tflops, root, sig);

        // Assert 100% of bond refunded to buyer
        assertEq(gridUSD.balanceOf(BUYER), buyerBalBefore + bondAmount);
        assertEq(gridUSD.balanceOf(PROVIDER1), providerBalBefore);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBalBefore - bondAmount);

        d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Settled));
        assertEq(uint256(d.verdict), uint256(DeliveryEscrow.Verdict.Fail));
    }

    function test_Timeout_Requested_Unprovisioned_FullBuyerPayout() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 3, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint256 bondAmount = d.bondAmount;
        uint64 deadline = d.deadline;

        // Before deadline: revert
        warpTo(deadline - 1);
        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);

        // At deadline: revert
        warpTo(deadline);
        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);

        // After deadline: succeeds with full bond to buyer
        warpTo(deadline + 1);

        uint256 buyerBalBefore = gridUSD.balanceOf(BUYER);
        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 escrowBalBefore = gridUSD.balanceOf(address(escrow));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit TimeoutClaimed(deliveryId, bondAmount, 0);

        escrow.claimTimeout(deliveryId);

        assertEq(gridUSD.balanceOf(BUYER), buyerBalBefore + bondAmount);
        assertEq(gridUSD.balanceOf(PROVIDER1), providerBalBefore);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBalBefore - bondAmount);

        d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.TimedOut));
    }

    function test_Timeout_Provisioned_Unsettled_FullProviderPayout() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint256 bondAmount = d.bondAmount;

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef1234");

        d = escrow.getDelivery(deliveryId);
        uint256 timeoutThreshold = d.provisionedAt + (5 * 1 hours) + 1 hours;

        // Before timeout threshold: revert
        warpTo(timeoutThreshold);
        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);

        // Past timeout threshold: succeeds with 100% bond to provider
        warpTo(timeoutThreshold + 1);

        uint256 buyerBalBefore = gridUSD.balanceOf(BUYER);
        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 escrowBalBefore = gridUSD.balanceOf(address(escrow));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit TimeoutClaimed(deliveryId, 0, bondAmount);

        escrow.claimTimeout(deliveryId);

        assertEq(gridUSD.balanceOf(PROVIDER1), providerBalBefore + bondAmount);
        assertEq(gridUSD.balanceOf(BUYER), buyerBalBefore);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBalBefore - bondAmount);

        d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.TimedOut));
    }
}

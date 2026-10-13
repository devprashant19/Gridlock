// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowWithdrawalTest is GridlockTestBase {
    uint256 public seriesId;
    address public hourToken;
    uint64 public windowEnd;

    function setUp() public override {
        super.setUp();

        uint64 windowStart = uint64(block.timestamp);
        windowEnd = uint64(block.timestamp + 7 days);

        (seriesId, hourToken) = _createSeries(
            T4_CLASS,
            "gT4-NOW",
            windowStart,
            windowEnd
        );

        vm.startPrank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");
        gridUSD.approve(address(escrow), 100_000 * 1e6);
        vm.stopPrank();
    }

    function test_WithdrawUnsold_RevertWhen_WindowNotEnded() public {
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 10);

        // Current time is within window
        vm.prank(PROVIDER1);
        vm.expectRevert("Series window has not ended");
        escrow.withdrawUnsold(seriesId, 10);
    }

    function test_WithdrawUnsold_RevertWhen_ZeroHours() public {
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 10);

        warpTo(windowEnd + 1);

        vm.prank(PROVIDER1);
        vm.expectRevert("Hours must be > 0");
        escrow.withdrawUnsold(seriesId, 0);
    }

    function test_WithdrawUnsold_RevertWhen_InsufficientOpenHours() public {
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 5);

        warpTo(windowEnd + 1);

        vm.prank(PROVIDER1);
        vm.expectRevert("Insufficient open hours");
        escrow.withdrawUnsold(seriesId, 10);
    }

    function test_WithdrawUnsold_RevertWhen_UnauthorizedStranger() public {
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 10);

        warpTo(windowEnd + 1);

        address stranger = address(0x9999);
        vm.prank(stranger);
        vm.expectRevert("No open hours to withdraw");
        escrow.withdrawUnsold(seriesId);
    }

    function test_WithdrawUnsold_PartialCapacity_Success() public {
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 20); // 8.40 gUSD bond for 20 hours at $0.35

        warpTo(windowEnd + 1);

        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);

        // Withdraw partial 5 hours
        vm.prank(PROVIDER1);
        escrow.withdrawUnsold(seriesId, 5);

        uint256 expectedRefund = 5 * 420_000; // 2.10 gUSD
        assertEq(gridUSD.balanceOf(PROVIDER1) - providerBalBefore, expectedRefund);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 15);
        assertEq(HourToken(hourToken).balanceOf(PROVIDER1), 15 * 1e18);
    }

    function test_WithdrawUnsold_FullCapacity_SingleArg_Success() public {
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 10);

        warpTo(windowEnd + 1);

        uint256 providerBalBefore = gridUSD.balanceOf(PROVIDER1);

        // Single argument withdrawUnsold(seriesId)
        vm.prank(PROVIDER1);
        escrow.withdrawUnsold(seriesId);

        uint256 expectedRefund = 10 * 420_000; // 4.20 gUSD
        assertEq(gridUSD.balanceOf(PROVIDER1) - providerBalBefore, expectedRefund);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 0);
        assertEq(escrow.bondPerHour(seriesId, PROVIDER1), 0);
        assertEq(HourToken(hourToken).balanceOf(PROVIDER1), 0);
    }

    function test_WithdrawUnsold_DoesNotDrainAssignedCollateral() public {
        // Mint 20 hours: total bond = 8_400_000 gUSD
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 20);

        // Transfer 10 HourTokens to buyer
        vm.prank(PROVIDER1);
        HourToken(hourToken).transfer(BUYER, 10 * 1e18);

        // Buyer redeems 10 hours: moves 4_200_000 gUSD bond into delivery
        bytes32 mockBuyerPubKey = keccak256("BuyerPubKeyX25519");
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(seriesId, 10, mockBuyerPubKey);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(d.bondAmount, 4_200_000);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 10);

        // Window ends
        warpTo(windowEnd + 1);

        // Provider cannot withdraw 20 hours because 10 are assigned
        vm.prank(PROVIDER1);
        vm.expectRevert("Insufficient open hours");
        escrow.withdrawUnsold(seriesId, 20);

        // Provider withdraws all unsold hours (10 hours)
        vm.prank(PROVIDER1);
        escrow.withdrawUnsold(seriesId);

        // Assert delivery collateral is untouched and still fully backed
        assertEq(gridUSD.balanceOf(address(escrow)), d.bondAmount);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 0);
    }
}

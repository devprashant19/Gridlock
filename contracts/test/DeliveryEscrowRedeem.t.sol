// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowRedeemTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;
    uint64 internal windowStart;
    uint64 internal windowEnd;

    function setUp() public override {
        super.setUp();

        // Create a standard series with a known future window
        windowStart = uint64(START_TIME + 1 days);
        windowEnd = uint64(START_TIME + 7 days);

        address tokenAddr;
        (activeSeriesId, tokenAddr) = _createSeries(
            A100_CLASS,
            "GPU-A100-OCT",
            windowStart,
            windowEnd
        );
        token = HourToken(tokenAddr);

        // Register provider
        vm.prank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");

        // Fund and approve provider for minting
        _fundWithGridUSD(PROVIDER1, 10_000 * 1e6);
        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), type(uint256).max);
    }

    function test_RevertWhen_RedeemZeroHours() public {
        vm.warp(windowStart + 1 hours);
        bytes32 pubKey = bytes32("test_encryption_public_key_01");

        vm.prank(BUYER);
        vm.expectRevert("Hours must be > 0");
        escrow.redeem(activeSeriesId, 0, pubKey);
    }

    function test_RevertWhen_RedeemBeforeWindow() public {
        // Warp before windowStart
        vm.warp(windowStart - 1);
        bytes32 pubKey = bytes32("test_encryption_public_key_01");

        vm.prank(BUYER);
        vm.expectRevert("Not within series window");
        escrow.redeem(activeSeriesId, 10, pubKey);
    }

    function test_RevertWhen_RedeemAfterWindow() public {
        // Warp after windowEnd
        vm.warp(windowEnd + 1);
        bytes32 pubKey = bytes32("test_encryption_public_key_01");

        vm.prank(BUYER);
        vm.expectRevert("Not within series window");
        escrow.redeem(activeSeriesId, 10, pubKey);
    }

    function test_RevertWhen_RedeemEmptyProviderQueue() public {
        // Within window, but no provider has minted capacity
        vm.warp(windowStart + 100);
        bytes32 pubKey = bytes32("test_encryption_public_key_01");

        // Mint HourTokens directly to buyer via escrow prank
        vm.prank(address(escrow));
        token.mint(BUYER, 10 * 1e18);

        vm.prank(BUYER);
        vm.expectRevert("No provider with sufficient capacity");
        escrow.redeem(activeSeriesId, 10, pubKey);
    }

    function test_RevertWhen_RedeemInsufficientProviderCapacity() public {
        // Provider mints 5 hours
        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 5);

        vm.warp(windowStart + 100);
        bytes32 pubKey = bytes32("test_encryption_public_key_01");

        // Buyer has 10 hours token
        vm.prank(address(escrow));
        token.mint(BUYER, 10 * 1e18);

        // Buyer attempts to redeem 10 hours, but provider only has 5
        vm.prank(BUYER);
        vm.expectRevert("No provider with sufficient capacity");
        escrow.redeem(activeSeriesId, 10, pubKey);
    }

    function test_RevertWhen_RedeemInsufficientBuyerBalance() public {
        // Provider mints 10 hours
        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 10);

        vm.warp(windowStart + 100);
        bytes32 pubKey = bytes32("test_encryption_public_key_01");

        // Buyer has 0 HourTokens
        vm.prank(BUYER);
        vm.expectRevert(); // HourToken: ERC20 burn exceeds balance
        escrow.redeem(activeSeriesId, 10, pubKey);
    }

    function test_Redeem_ValidPrerequisites_Passes() public {
        // Provider mints 10 hours
        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 10);

        // Give buyer 5 HourTokens
        vm.prank(address(escrow));
        token.mint(BUYER, 5 * 1e18);

        vm.warp(windowStart + 200);
        bytes32 pubKey = bytes32("test_encryption_public_key_01");

        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, pubKey);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(d.seriesId, activeSeriesId);
        assertEq(d.buyer, BUYER);
        assertEq(d.provider, PROVIDER1);
        assertEq(d.hours_, 5);
        assertEq(d.buyerEncPubKey, pubKey);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Requested));
        assertEq(d.deadline, uint64(block.timestamp + 2 hours));
    }
}

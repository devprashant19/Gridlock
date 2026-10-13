// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowFIFOTest is GridlockTestBase {
    uint256 public seriesId;
    address public hourToken;

    function setUp() public override {
        super.setUp();

        // Create T4 series with active window
        (seriesId, hourToken) = _createSeries(
            T4_CLASS,
            "gT4-NOW",
            uint64(block.timestamp),
            uint64(block.timestamp + 7 days)
        );

        // Register both providers
        vm.prank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");

        vm.prank(PROVIDER2);
        escrow.registerProvider("Provider Beta");

        // Fund and approve GridUSD for minting
        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), 100_000 * 1e6);

        vm.prank(PROVIDER2);
        gridUSD.approve(address(escrow), 100_000 * 1e6);
    }

    function test_FIFO_TwoProviders_SequentialAssignments() public {
        // Provider 1 mints 10 hours first -> queued at index 0
        vm.prank(PROVIDER1);
        escrow.mint(seriesId, 10);

        // Provider 2 mints 20 hours second -> queued at index 1
        vm.prank(PROVIDER2);
        escrow.mint(seriesId, 20);

        // Mint HourTokens directly to Buyer via escrow so totalSupply matches balance
        vm.prank(address(escrow));
        HourToken(hourToken).mint(BUYER, 50 * 1e18);

        bytes32 mockBuyerPubKey = keccak256("BuyerPubKeyX25519");

        // Redemption 1: Buyer redeems 6 hours. Provider 1 has 10 >= 6 -> Assigned to Provider 1
        vm.prank(BUYER);
        uint256 deliveryId1 = escrow.redeem(seriesId, 6, mockBuyerPubKey);
        DeliveryEscrow.Delivery memory d1 = escrow.getDelivery(deliveryId1);
        assertEq(d1.provider, PROVIDER1);
        assertEq(d1.hours_, 6);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 4);
        assertEq(escrow.openHours(seriesId, PROVIDER2), 20);

        // Redemption 2: Buyer redeems 5 hours.
        // Provider 1 has only 4 open (< 5). Provider 2 has 20 >= 5 -> Assigned to Provider 2
        vm.prank(BUYER);
        uint256 deliveryId2 = escrow.redeem(seriesId, 5, mockBuyerPubKey);
        DeliveryEscrow.Delivery memory d2 = escrow.getDelivery(deliveryId2);
        assertEq(d2.provider, PROVIDER2);
        assertEq(d2.hours_, 5);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 4);
        assertEq(escrow.openHours(seriesId, PROVIDER2), 15);

        // Redemption 3: Buyer redeems 4 hours.
        // Provider 1 has 4 open (>= 4) -> Assigned to Provider 1 (FIFO priority restored)
        vm.prank(BUYER);
        uint256 deliveryId3 = escrow.redeem(seriesId, 4, mockBuyerPubKey);
        DeliveryEscrow.Delivery memory d3 = escrow.getDelivery(deliveryId3);
        assertEq(d3.provider, PROVIDER1);
        assertEq(d3.hours_, 4);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 0); // Depleted!
        assertEq(escrow.openHours(seriesId, PROVIDER2), 15);

        // Redemption 4: Buyer redeems 10 hours.
        // Provider 1 is depleted (0). Provider 2 has 15 >= 10 -> Assigned to Provider 2
        vm.prank(BUYER);
        uint256 deliveryId4 = escrow.redeem(seriesId, 10, mockBuyerPubKey);
        DeliveryEscrow.Delivery memory d4 = escrow.getDelivery(deliveryId4);
        assertEq(d4.provider, PROVIDER2);
        assertEq(d4.hours_, 10);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 0);
        assertEq(escrow.openHours(seriesId, PROVIDER2), 5);

        // Redemption 5: Buyer attempts to redeem 10 hours.
        // Provider 1 has 0, Provider 2 has 5 -> Neither has >= 10 -> Reverts with capacity error
        vm.prank(BUYER);
        vm.expectRevert("No provider with sufficient capacity");
        escrow.redeem(seriesId, 10, mockBuyerPubKey);
    }
}

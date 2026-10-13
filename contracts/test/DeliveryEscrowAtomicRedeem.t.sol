// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowAtomicRedeemTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;
    uint64 internal windowStart;
    uint64 internal windowEnd;

    function setUp() public override {
        super.setUp();

        (activeSeriesId, , windowStart, windowEnd) = 
            _createDeterministicActiveSeries(A100_CLASS, "gA100-ACTIVE", 7 days);

        (, address tokenAddr, , , ) = factory.series(activeSeriesId);
        token = HourToken(tokenAddr);

        // Register provider
        vm.prank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");

        _fundWithGridUSD(PROVIDER1, 10_000 * 1e6);
        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), type(uint256).max);
    }

    function test_AtomicRedeem_ExactTokenBurn_And_DeliveryCreation() public {
        // Provider mints 10 hours
        vm.prank(PROVIDER1);
        uint256 mintedBond = escrow.mint(activeSeriesId, 10);
        uint256 expectedBondPerHour = mintedBond / 10;

        // Transfer 4 hours to buyer
        vm.prank(PROVIDER1);
        token.transfer(BUYER, 4 * 1e18);

        uint256 buyerBalanceBefore = token.balanceOf(BUYER);
        uint256 totalSupplyBefore = token.totalSupply();
        uint256 openHoursBefore = escrow.openHours(activeSeriesId, PROVIDER1);

        bytes32 pubKey = bytes32("buyer_x25519_enc_pubkey_sample");

        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 4, pubKey);

        // 1. Verify token burn
        assertEq(token.balanceOf(BUYER), buyerBalanceBefore - (4 * 1e18));
        assertEq(token.totalSupply(), totalSupplyBefore - (4 * 1e18));

        // 2. Verify provider capacity delta
        assertEq(escrow.openHours(activeSeriesId, PROVIDER1), openHoursBefore - 4);

        // 3. Verify delivery attributes
        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(d.seriesId, activeSeriesId);
        assertEq(d.buyer, BUYER);
        assertEq(d.provider, PROVIDER1);
        assertEq(d.hours_, 4);
        assertEq(d.buyerEncPubKey, pubKey);
        assertEq(d.deadline, uint64(block.timestamp + 2 hours));
        assertEq(d.provisionedAt, 0);
        assertEq(d.bondAmount, expectedBondPerHour * 4);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Requested));
        assertEq(d.ciphertext.length, 0);
        assertEq(uint256(d.verdict), uint256(DeliveryEscrow.Verdict.None));
    }

    function test_FailedRedeem_RevertsStateAtomically() public {
        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 5);

        // Transfer 10 tokens to buyer (more than provider capacity)
        vm.prank(address(escrow));
        token.mint(BUYER, 10 * 1e18);

        uint256 buyerBalBefore = token.balanceOf(BUYER);
        uint256 supplyBefore = token.totalSupply();
        uint256 openHoursBefore = escrow.openHours(activeSeriesId, PROVIDER1);

        bytes32 pubKey = bytes32("buyer_sample_pubkey");

        // Attempt to redeem 6 hours (provider only has 5 open hours)
        vm.prank(BUYER);
        vm.expectRevert("No provider with sufficient capacity");
        escrow.redeem(activeSeriesId, 6, pubKey);

        // Verify zero partial state mutations: tokens were NOT burned despite burn call preceding queue check
        assertEq(token.balanceOf(BUYER), buyerBalBefore);
        assertEq(token.totalSupply(), supplyBefore);
        assertEq(escrow.openHours(activeSeriesId, PROVIDER1), openHoursBefore);
    }

    function test_SequentialRedemptions_ExhaustCapacityDeterministic() public {
        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 10);

        address buyer2 = address(0x3002);
        vm.prank(PROVIDER1);
        token.transfer(BUYER, 4 * 1e18);
        vm.prank(PROVIDER1);
        token.transfer(buyer2, 6 * 1e18);

        // Give BUYER 1 additional token for the 3rd redemption test
        vm.prank(address(escrow));
        token.mint(BUYER, 1 * 1e18);

        // 1st redemption: 4 hours
        vm.prank(BUYER);
        uint256 del1 = escrow.redeem(activeSeriesId, 4, bytes32("pubkey1"));
        assertEq(del1, 0);
        assertEq(escrow.openHours(activeSeriesId, PROVIDER1), 6);

        // 2nd redemption: 6 hours
        vm.prank(buyer2);
        uint256 del2 = escrow.redeem(activeSeriesId, 6, bytes32("pubkey2"));
        assertEq(del2, 1);
        assertEq(escrow.openHours(activeSeriesId, PROVIDER1), 0);

        // 3rd redemption: BUYER still has 1 token, but provider has 0 hours
        vm.prank(BUYER);
        vm.expectRevert("No provider with sufficient capacity");
        escrow.redeem(activeSeriesId, 1, bytes32("pubkey3"));
    }
}

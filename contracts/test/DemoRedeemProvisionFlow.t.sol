// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DemoRedeemProvisionFlowTest is GridlockTestBase {
    uint256 internal demoSeriesId;
    HourToken internal demoToken;

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

    function setUp() public override {
        super.setUp();

        (demoSeriesId, , , ) = _createDeterministicActiveSeries(H100_CLASS, "gH100-DEMO", 7 days);
        (, address tokenAddr, , , ) = factory.series(demoSeriesId);
        demoToken = HourToken(tokenAddr);

        vm.prank(PROVIDER1);
        escrow.registerProvider("RunPod Alpha Cluster");

        _fundWithGridUSD(PROVIDER1, 10_000 * 1e6);
        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), type(uint256).max);

        vm.prank(PROVIDER1);
        escrow.mint(demoSeriesId, 10);
    }

    function test_BuyerRedemption_And_ProviderProvisioning_Flow() public {
        // 1. Transfer HourTokens from provider to buyer (e.g. secondary OTC or DEX trade)
        uint256 redeemHours = 4;
        vm.prank(PROVIDER1);
        demoToken.transfer(BUYER, redeemHours * 1e18);

        assertEq(demoToken.balanceOf(BUYER), redeemHours * 1e18);

        // 2. Buyer redeems tokens for compute delivery
        bytes32 buyerPubKey = bytes32(hex"11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff");
        uint64 expectedDeadline = uint64(block.timestamp + 2 hours);

        vm.expectEmit(true, true, true, true, address(escrow));
        emit DeliveryRequested(
            0,
            demoSeriesId,
            BUYER,
            PROVIDER1,
            redeemHours,
            buyerPubKey,
            expectedDeadline
        );

        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(demoSeriesId, redeemHours, buyerPubKey);

        assertEq(deliveryId, 0);
        assertEq(demoToken.balanceOf(BUYER), 0);
        assertEq(demoToken.totalSupply(), (10 - redeemHours) * 1e18);

        // 3. Provider Provisions delivery before deadline
        bytes memory standardCiphertext = abi.encodePacked(
            hex"01",
            bytes32(hex"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
            bytes24(hex"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
            bytes16(hex"cccccccccccccccccccccccccccccccc")
        );

        warpForward(15 minutes); // Provision 15 minutes after request

        vm.expectEmit(true, false, false, true, address(escrow));
        emit Provisioned(deliveryId, standardCiphertext);

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, standardCiphertext);

        // 4. Verify Delivery Record State
        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(d.seriesId, demoSeriesId);
        assertEq(d.buyer, BUYER);
        assertEq(d.provider, PROVIDER1);
        assertEq(d.hours_, redeemHours);
        assertEq(d.buyerEncPubKey, buyerPubKey);
        assertEq(d.deadline, expectedDeadline);
        assertEq(d.provisionedAt, block.timestamp);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Provisioned));
        assertEq(d.ciphertext, standardCiphertext);
    }
}

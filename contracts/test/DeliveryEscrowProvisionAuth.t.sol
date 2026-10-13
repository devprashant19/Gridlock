// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowProvisionAuthTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;
    uint256 internal deliveryId;
    address internal stranger = address(0x9999);

    function setUp() public override {
        super.setUp();

        (activeSeriesId, , , ) = _createDeterministicActiveSeries(A100_CLASS, "gA100-ACT", 7 days);
        (, address tokenAddr, , , ) = factory.series(activeSeriesId);
        token = HourToken(tokenAddr);

        // Register two providers
        vm.prank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");

        vm.prank(PROVIDER2);
        escrow.registerProvider("Provider Beta");

        _fundWithGridUSD(PROVIDER1, 10_000 * 1e6);
        _fundWithGridUSD(PROVIDER2, 10_000 * 1e6);

        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), type(uint256).max);
        vm.prank(PROVIDER2);
        gridUSD.approve(address(escrow), type(uint256).max);

        // PROVIDER1 mints capacity first (so queue assigns PROVIDER1)
        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 10);

        vm.prank(PROVIDER2);
        escrow.mint(activeSeriesId, 10);

        // Fund BUYER and redeem
        vm.prank(address(escrow));
        token.mint(BUYER, 5 * 1e18);

        vm.prank(BUYER);
        deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_enc_pubkey_1"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(d.provider, PROVIDER1);
    }

    function test_Provision_Success_ByAssignedProvider() public {
        // Build valid agreed ciphertext: 0x01 || ephemeralX25519Pub(32) || nonce(24) || tag(16)
        bytes memory standardCiphertext = abi.encodePacked(
            hex"01",
            bytes32(hex"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
            bytes24(hex"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
            bytes16(hex"cccccccccccccccccccccccccccccccc")
        );

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, standardCiphertext);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Provisioned));
        assertEq(d.ciphertext, standardCiphertext);
    }

    function test_RevertWhen_ProvisionByUnassignedProvider() public {
        bytes memory cipher = hex"01abcdef";

        vm.prank(PROVIDER2);
        vm.expectRevert("Only assigned provider");
        escrow.provision(deliveryId, cipher);
    }

    function test_RevertWhen_ProvisionByBuyer() public {
        bytes memory cipher = hex"01abcdef";

        vm.prank(BUYER);
        vm.expectRevert("Only assigned provider");
        escrow.provision(deliveryId, cipher);
    }

    function test_RevertWhen_ProvisionByStranger() public {
        bytes memory cipher = hex"01abcdef";

        vm.prank(stranger);
        vm.expectRevert("Only assigned provider");
        escrow.provision(deliveryId, cipher);
    }

    function test_RevertWhen_ProvisionEmptyCiphertext() public {
        bytes memory emptyCipher = "";

        vm.prank(PROVIDER1);
        vm.expectRevert("Empty ciphertext");
        escrow.provision(deliveryId, emptyCipher);
    }
}

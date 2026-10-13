// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowProvisionDeadlineTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;
    uint256 internal deliveryId;
    uint64 internal deadline;

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
        deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("pubkey_alpha"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        deadline = d.deadline;
    }

    function test_Provision_Succeeds_BeforeDeadline() public {
        warpTo(deadline - 100);
        bytes memory cipher = hex"01abcdef12345678";

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, cipher);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Provisioned));
        assertEq(d.provisionedAt, deadline - 100);
        assertEq(d.ciphertext, cipher);
    }

    function test_Provision_Succeeds_ExactlyAtDeadline() public {
        warpTo(deadline);
        bytes memory cipher = hex"01abcdef12345678";

        // Exactly at deadline, provision must succeed
        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, cipher);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Provisioned));
        assertEq(d.provisionedAt, deadline);
    }

    function test_Provision_Reverts_ImmediatelyAfterDeadline() public {
        warpTo(deadline + 1);
        bytes memory cipher = hex"01abcdef12345678";

        // 1 second past deadline, provision must revert
        vm.prank(PROVIDER1);
        vm.expectRevert("Provisioning deadline passed");
        escrow.provision(deliveryId, cipher);
    }

    function test_MutualExclusion_AtAndAfterDeadline() public {
        // At deadline: timeout claim must revert, provision must succeed
        warpTo(deadline);
        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);

        // After deadline: provision must revert, timeout claim must succeed
        warpTo(deadline + 1);
        bytes memory cipher = hex"01abcdef12345678";

        vm.prank(PROVIDER1);
        vm.expectRevert("Provisioning deadline passed");
        escrow.provision(deliveryId, cipher);

        uint256 buyerBalanceBefore = gridUSD.balanceOf(BUYER);
        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint256 bond = d.bondAmount;

        escrow.claimTimeout(deliveryId);

        d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.TimedOut));
        assertEq(gridUSD.balanceOf(BUYER), buyerBalanceBefore + bond);
    }
}

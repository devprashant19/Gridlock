// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DemoTimeoutBoundariesTest is GridlockTestBase {
    uint256 internal demoSeriesId;
    HourToken internal demoToken;

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
        escrow.mint(demoSeriesId, 30);

        vm.prank(address(escrow));
        demoToken.mint(BUYER, 30 * 1e18);
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

    function test_Boundary_ExactDeadline_ProvisionWins_TimeoutReverts() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(demoSeriesId, 5, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint64 deadline = d.deadline;

        // At exact deadline
        warpTo(deadline);

        // Timeout claim fails
        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);

        // Provisioning succeeds
        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");

        d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Provisioned));
    }

    function test_Boundary_PastDeadline_TimeoutWins_ProvisionReverts() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(demoSeriesId, 5, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint64 deadline = d.deadline;

        // Past deadline
        warpTo(deadline + 1);

        // Provisioning fails
        vm.prank(PROVIDER1);
        vm.expectRevert("Provisioning deadline passed");
        escrow.provision(deliveryId, hex"01abcdef");

        // Timeout succeeds
        escrow.claimTimeout(deliveryId);

        d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.TimedOut));
    }

    function test_Boundary_RentalBuffer_SettlementVsTimeoutRace() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(demoSeriesId, 5, bytes32("buyer_key"));

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint256 timeoutThreshold = d.provisionedAt + (5 * 1 hours) + 1 hours;

        // Exactly at timeout threshold
        warpTo(timeoutThreshold);

        // Timeout claim reverts
        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);

        // Advance 1 second past threshold
        warpTo(timeoutThreshold + 1);

        // Timeout claimed by provider
        escrow.claimTimeout(deliveryId);

        // Late verifier report reverts
        bytes memory sig = _signVerdict(deliveryId, 1, 30000, bytes32("root"));
        vm.expectRevert("Not provisioned");
        escrow.settleWithSig(deliveryId, 1, 30000, bytes32("root"), sig);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowInvariantsTest is GridlockTestBase {
    uint256 internal activeSeriesId;
    HourToken internal token;

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

    function test_RevertWhen_DuplicateSettleWithSig() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");

        bytes memory sig = _signVerdict(deliveryId, 1, 30000, bytes32("root1"));

        // First settlement succeeds
        escrow.settleWithSig(deliveryId, 1, 30000, bytes32("root1"), sig);

        // Second attempt with exact same signature must revert
        vm.expectRevert("Not provisioned");
        escrow.settleWithSig(deliveryId, 1, 30000, bytes32("root1"), sig);
    }

    function test_RevertWhen_SettleReport_AfterSettleWithSig() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");

        bytes memory sig = _signVerdict(deliveryId, 1, 30000, bytes32("root1"));
        escrow.settleWithSig(deliveryId, 1, 30000, bytes32("root1"), sig);

        // Competing forwarder report must revert
        bytes memory report = abi.encode(deliveryId, uint8(2), uint32(20000), bytes32("root2"));
        vm.prank(FORWARDER);
        vm.expectRevert("Not provisioned");
        escrow.onReport(report);
    }

    function test_RevertWhen_TimeoutClaim_AfterSettlement() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");

        bytes memory sig = _signVerdict(deliveryId, 1, 30000, bytes32("root1"));
        escrow.settleWithSig(deliveryId, 1, 30000, bytes32("root1"), sig);

        // Warp past timeout threshold
        warpForward(10 days);

        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);
    }

    function test_RevertWhen_Settlement_AfterTimeoutClaim() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        uint256 timeoutThreshold = d.provisionedAt + (5 * 1 hours) + 1 hours;

        warpTo(timeoutThreshold + 1);

        // Timeout claim succeeds
        escrow.claimTimeout(deliveryId);

        // Late verifier settlement must revert
        bytes memory sig = _signVerdict(deliveryId, 1, 30000, bytes32("root1"));
        vm.expectRevert("Not provisioned");
        escrow.settleWithSig(deliveryId, 1, 30000, bytes32("root1"), sig);
    }

    function test_RevertWhen_Provision_AfterUnprovisionedTimeout() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        warpTo(d.deadline + 1);

        // Timeout claimed by buyer
        escrow.claimTimeout(deliveryId);

        // Late provider provision must revert
        vm.prank(PROVIDER1);
        vm.expectRevert("Invalid status");
        escrow.provision(deliveryId, hex"01abcdef");
    }

    function test_RevertWhen_DuplicateTimeoutClaim() public {
        vm.prank(BUYER);
        uint256 deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        warpTo(d.deadline + 1);

        escrow.claimTimeout(deliveryId);

        // Second timeout claim must revert
        vm.expectRevert("Timeout condition not met");
        escrow.claimTimeout(deliveryId);
    }
}

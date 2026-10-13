// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract ForwarderPermissionsTest is GridlockTestBase {
    address internal newForwarder = address(0x4002);
    address internal unauthorizedCaller = address(0x9999);
    uint256 internal deliveryId;
    uint256 internal activeSeriesId;

    event ForwarderUpdated(address indexed forwarder);

    function setUp() public override {
        super.setUp();

        (activeSeriesId, , , ) = _createDeterministicActiveSeries(A100_CLASS, "gA100-ACT", 7 days);

        vm.prank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");

        _fundWithGridUSD(PROVIDER1, 10_000 * 1e6);
        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), type(uint256).max);

        vm.prank(PROVIDER1);
        escrow.mint(activeSeriesId, 10);

        (, address tokenAddr, , , ) = factory.series(activeSeriesId);
        vm.prank(address(escrow));
        HourToken(tokenAddr).mint(BUYER, 5 * 1e18);

        vm.prank(BUYER);
        deliveryId = escrow.redeem(activeSeriesId, 5, bytes32("buyer_key"));

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");
    }

    // --- DeliveryEscrow Forwarder Tests ---

    function test_Escrow_SetForwarder_ByOwner_Success() public {
        vm.prank(OWNER);
        vm.expectEmit(true, false, false, false, address(escrow));
        emit ForwarderUpdated(newForwarder);

        escrow.setForwarder(newForwarder);
        assertEq(escrow.forwarder(), newForwarder);
    }

    function test_Escrow_SetForwarder_RevertWhen_NotOwner() public {
        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only owner");
        escrow.setForwarder(newForwarder);
    }

    function test_Escrow_OnReport_Success_ByAuthorizedForwarder() public {
        bytes memory report = abi.encode(deliveryId, uint8(1), uint32(31000), bytes32("root_fw"));

        vm.prank(FORWARDER);
        escrow.onReport(report);

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        assertEq(uint256(d.status), uint256(DeliveryEscrow.Status.Settled));
        assertEq(uint256(d.verdict), uint256(DeliveryEscrow.Verdict.Pass));
    }

    function test_Escrow_OnReport_RevertWhen_UnauthorizedCaller() public {
        bytes memory report = abi.encode(deliveryId, uint8(1), uint32(31000), bytes32("root_fw"));

        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only forwarder");
        escrow.onReport(report);
    }

    // --- IndexOracle Forwarder Tests ---

    function test_Oracle_SetForwarder_ByOwner_Success() public {
        vm.prank(OWNER);
        vm.expectEmit(true, false, false, false, address(oracle));
        emit ForwarderUpdated(newForwarder);

        oracle.setForwarder(newForwarder);
        assertEq(oracle.forwarder(), newForwarder);
    }

    function test_Oracle_SetForwarder_RevertWhen_NotOwner() public {
        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only owner");
        oracle.setForwarder(newForwarder);
    }

    function test_Oracle_OnReport_Success_ByAuthorizedForwarder() public {
        uint64 timestampSec = uint64(block.timestamp + 500);
        uint128 newPrice = 280_000_000;
        bytes memory report = abi.encode(H100_CLASS, timestampSec, newPrice);

        vm.prank(FORWARDER);
        oracle.onReport(report);

        (uint128 storedPrice, uint64 storedDay) = oracle.latest(H100_CLASS);
        assertEq(storedPrice, newPrice);
        assertEq(storedDay, timestampSec);
    }

    function test_Oracle_OnReport_RevertWhen_UnauthorizedCaller() public {
        bytes memory report = abi.encode(H100_CLASS, uint64(block.timestamp), uint128(280_000_000));

        vm.prank(unauthorizedCaller);
        vm.expectRevert("Only forwarder");
        oracle.onReport(report);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract IndexOracleTest is GridlockTestBase {
    address public user1 = address(0x9001);

    event PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8);
    event ForwarderUpdated(address indexed forwarder);

    function test_OwnerIsConfigured() public view {
        assertEq(oracle.owner(), OWNER);
    }

    function test_ForwarderIsConfigured() public view {
        assertEq(oracle.forwarder(), FORWARDER);
    }

    function test_SetForwarder_ByOwner_Success() public {
        address newForwarder = address(0x7777);

        vm.prank(OWNER);
        vm.expectEmit(true, false, false, false);
        emit ForwarderUpdated(newForwarder);
        oracle.setForwarder(newForwarder);

        assertEq(oracle.forwarder(), newForwarder);
    }

    function test_SetForwarder_RevertWhen_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Only owner");
        oracle.setForwarder(user1);
    }

    function test_SetFixedPrice_ByOwner_Success() public {
        vm.prank(OWNER);
        vm.expectEmit(true, true, false, true);
        emit PrintPublished(keccak256("B200"), uint64(block.timestamp), 500_000_000);
        oracle.setFixedPrice("B200", 500_000_000); // $5.00/hr

        (uint128 price, uint64 dayKey) = oracle.latest(keccak256("B200"));
        assertEq(price, 500_000_000);
        assertEq(dayKey, uint64(block.timestamp));
    }

    function test_SetFixedPrice_RevertWhen_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Only owner");
        oracle.setFixedPrice("B200", 500_000_000);
    }

    function test_PushPrint_ByOwner_Success() public {
        bytes32 classHash = keccak256("CustomGPU");
        uint64 timestampSec = uint64(block.timestamp);
        uint128 price = 120_000_000;

        vm.prank(OWNER);
        oracle.pushPrint(classHash, timestampSec, price);

        (uint128 p, uint64 d) = oracle.latest(classHash);
        assertEq(p, price);
        assertEq(d, timestampSec);
    }

    function test_PushPrint_ByForwarder_Success() public {
        bytes32 classHash = keccak256("ForwarderGPU");
        uint64 timestampSec = uint64(block.timestamp);
        uint128 price = 310_000_000;

        vm.prank(FORWARDER);
        oracle.pushPrint(classHash, timestampSec, price);

        (uint128 p, uint64 d) = oracle.latest(classHash);
        assertEq(p, price);
        assertEq(d, timestampSec);
    }

    function test_PushPrint_RevertWhen_Unauthorized() public {
        vm.prank(user1);
        vm.expectRevert("Only owner or forwarder");
        oracle.pushPrint(H100_CLASS, uint64(block.timestamp), 999_000_000);
    }

    function test_OnReport_ByForwarder_Success() public {
        bytes32 classHash = H200_CLASS;
        uint64 timestampSec = uint64(block.timestamp + 1 hours);
        uint128 newPrice = 360_000_000;

        bytes memory report = abi.encode(classHash, timestampSec, newPrice);

        vm.prank(FORWARDER);
        oracle.onReport(report);

        (uint128 p, uint64 d) = oracle.latest(classHash);
        assertEq(p, newPrice);
        assertEq(d, timestampSec);
    }

    function test_OnReport_RevertWhen_Unauthorized() public {
        bytes memory report = abi.encode(H200_CLASS, uint64(block.timestamp), uint128(360_000_000));

        vm.prank(user1);
        vm.expectRevert("Only forwarder");
        oracle.onReport(report);
    }

    function test_Latest_RevertWhen_PriceNotSet() public {
        bytes32 unconfiguredClass = keccak256("NonExistentGPU");

        vm.expectRevert("Price not set for class");
        oracle.latest(unconfiguredClass);
    }
}

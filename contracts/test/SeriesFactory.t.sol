// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract SeriesFactoryTest is GridlockTestBase {
    address public user1 = address(0x9001);

    event SeriesCreated(
        uint256 indexed seriesId,
        bytes32 indexed gpuClass,
        address token,
        uint64 windowStart,
        uint64 windowEnd,
        string symbol
    );

    function test_ConfiguredEscrow() public view {
        assertEq(factory.escrow(), address(escrow));
    }

    function test_CreateSeries_Success() public {
        uint64 start = uint64(block.timestamp);
        uint64 end = uint64(block.timestamp + 7 days);

        vm.prank(OWNER);
        vm.expectEmit(true, true, false, false);
        emit SeriesCreated(0, T4_CLASS, address(0), start, end, "gT4-NOW");

        (uint256 id, address token) = factory.createSeries(T4_CLASS, "gT4-NOW", start, end);

        assertEq(id, 0);
        assertTrue(token != address(0));
        assertEq(factory.seriesCount(), 1);

        HourToken hourToken = HourToken(token);
        assertEq(hourToken.symbol(), "gT4-NOW");
        assertEq(hourToken.escrow(), address(escrow));
    }

    function test_CreateSeries_SeriesInfoStored() public {
        uint64 start = uint64(block.timestamp + 1 days);
        uint64 end = uint64(block.timestamp + 8 days);

        (uint256 id, address token) = factory.createSeries(H100_CLASS, "gH100-W43", start, end);

        (
            bytes32 storedClass,
            address storedToken,
            uint64 storedStart,
            uint64 storedEnd,
            string memory storedSymbol
        ) = factory.series(id);

        assertEq(storedClass, H100_CLASS);
        assertEq(storedToken, token);
        assertEq(storedStart, start);
        assertEq(storedEnd, end);
        assertEq(storedSymbol, "gH100-W43");
    }

    function test_CreateSeries_PermissionlessPolicy() public {
        // Confirming that series creation is permissionless (callable by any user)
        uint64 start = uint64(block.timestamp);
        uint64 end = uint64(block.timestamp + 3 days);

        vm.prank(user1);
        (uint256 id, ) = factory.createSeries(A100_CLASS, "gA100-USER", start, end);

        assertEq(id, 0);
        assertEq(factory.seriesCount(), 1);
    }

    function test_CreateSeries_SequentialIDs() public {
        uint64 start = uint64(block.timestamp);
        uint64 end = uint64(block.timestamp + 7 days);

        (uint256 id1, ) = factory.createSeries(T4_CLASS, "s1", start, end);
        (uint256 id2, ) = factory.createSeries(H100_CLASS, "s2", start, end);
        (uint256 id3, ) = factory.createSeries(H200_CLASS, "s3", start, end);

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(id3, 2);
        assertEq(factory.seriesCount(), 3);
    }

    function test_CreateSeries_RevertWhen_InvalidWindow() public {
        uint64 start = uint64(block.timestamp + 7 days);
        uint64 end = uint64(block.timestamp); // end < start

        vm.expectRevert("Invalid window");
        factory.createSeries(T4_CLASS, "gT4-FAIL", start, end);

        // end == start
        vm.expectRevert("Invalid window");
        factory.createSeries(T4_CLASS, "gT4-FAIL2", start, start);
    }

    function test_Series_RevertWhen_InvalidSeriesId() public {
        vm.expectRevert("Invalid seriesId");
        factory.series(999);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract GridUSDTest is GridlockTestBase {
    address public user1 = address(0x9001);
    address public user2 = address(0x9002);

    function test_Decimals() public view {
        assertEq(gridUSD.decimals(), 6);
    }

    function test_Metadata() public view {
        assertEq(gridUSD.name(), "Gridlock USD");
        assertEq(gridUSD.symbol(), "gUSD");
    }

    function test_Faucet_Success() public {
        vm.prank(user1);
        gridUSD.faucet();

        assertEq(gridUSD.balanceOf(user1), 1_000 * 1e6);
        assertEq(gridUSD.lastFaucetTime(user1), block.timestamp);
    }

    function test_Faucet_RevertWhen_RateLimited() public {
        vm.prank(user1);
        gridUSD.faucet();

        vm.prank(user1);
        vm.expectRevert("Faucet rate-limited: 1/hr");
        gridUSD.faucet();
    }

    function test_Faucet_SuccessAfterCooldown() public {
        vm.prank(user1);
        gridUSD.faucet();

        warpForward(1 hours);

        vm.prank(user1);
        gridUSD.faucet();

        assertEq(gridUSD.balanceOf(user1), 2_000 * 1e6);
    }

    function test_Transfer_Success() public {
        vm.prank(PROVIDER1);
        bool success = gridUSD.transfer(user1, 500 * 1e6);

        assertTrue(success);
        assertEq(gridUSD.balanceOf(user1), 500 * 1e6);
        assertEq(gridUSD.balanceOf(PROVIDER1), (100_000 - 500) * 1e6);
    }

    function test_Transfer_RevertWhen_InsufficientBalance() public {
        vm.prank(user1); // has 0 balance
        vm.expectRevert("Insufficient balance");
        gridUSD.transfer(user2, 10 * 1e6);
    }

    function test_Approve_And_Allowance() public {
        vm.prank(PROVIDER1);
        bool success = gridUSD.approve(user1, 1_000 * 1e6);

        assertTrue(success);
        assertEq(gridUSD.allowance(PROVIDER1, user1), 1_000 * 1e6);
    }

    function test_TransferFrom_Success() public {
        vm.prank(PROVIDER1);
        gridUSD.approve(user1, 1_000 * 1e6);

        vm.prank(user1);
        bool success = gridUSD.transferFrom(PROVIDER1, user2, 400 * 1e6);

        assertTrue(success);
        assertEq(gridUSD.balanceOf(user2), 400 * 1e6);
        assertEq(gridUSD.allowance(PROVIDER1, user1), 600 * 1e6);
    }

    function test_TransferFrom_InfiniteAllowanceDoesNotDecrement() public {
        vm.prank(PROVIDER1);
        gridUSD.approve(user1, type(uint256).max);

        vm.prank(user1);
        bool success = gridUSD.transferFrom(PROVIDER1, user2, 400 * 1e6);

        assertTrue(success);
        assertEq(gridUSD.allowance(PROVIDER1, user1), type(uint256).max);
    }

    function test_TransferFrom_RevertWhen_InsufficientAllowance() public {
        vm.prank(PROVIDER1);
        gridUSD.approve(user1, 100 * 1e6);

        vm.prank(user1);
        vm.expectRevert("Insufficient allowance");
        gridUSD.transferFrom(PROVIDER1, user2, 200 * 1e6);
    }

    function test_TransferFrom_RevertWhen_InsufficientBalance() public {
        vm.prank(user1);
        gridUSD.approve(user2, 1_000 * 1e6);

        vm.prank(user2);
        vm.expectRevert("Insufficient balance");
        gridUSD.transferFrom(user1, user2, 500 * 1e6);
    }
}

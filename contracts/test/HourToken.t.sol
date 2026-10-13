// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract HourTokenTest is GridlockTestBase {
    HourToken public hourToken;
    address public user1 = address(0x9001);
    address public user2 = address(0x9002);

    function setUp() public override {
        super.setUp();

        // Create a test series to get an initialized HourToken
        (, address tokenAddr) = _createSeries(T4_CLASS, "gT4-NOW", uint64(block.timestamp), uint64(block.timestamp + 7 days));
        hourToken = HourToken(tokenAddr);
    }

    function test_Decimals() public view {
        assertEq(hourToken.decimals(), 18);
    }

    function test_Metadata() public view {
        assertEq(hourToken.symbol(), "gT4-NOW");
        assertEq(hourToken.name(), "Gridlock Hour - gT4-NOW");
    }

    function test_ConfiguredEscrow() public view {
        assertEq(hourToken.escrow(), address(escrow));
    }

    function test_Mint_ByEscrow_Success() public {
        vm.prank(address(escrow));
        hourToken.mint(PROVIDER1, 10 * 1e18);

        assertEq(hourToken.balanceOf(PROVIDER1), 10 * 1e18);
        assertEq(hourToken.totalSupply(), 10 * 1e18);
    }

    function test_Mint_RevertWhen_UnauthorizedCaller() public {
        vm.prank(user1);
        vm.expectRevert("Only escrow");
        hourToken.mint(user1, 10 * 1e18);
    }

    function test_Burn_ByEscrow_Success() public {
        vm.prank(address(escrow));
        hourToken.mint(PROVIDER1, 10 * 1e18);

        vm.prank(address(escrow));
        hourToken.burn(PROVIDER1, 4 * 1e18);

        assertEq(hourToken.balanceOf(PROVIDER1), 6 * 1e18);
        assertEq(hourToken.totalSupply(), 6 * 1e18);
    }

    function test_Burn_RevertWhen_UnauthorizedCaller() public {
        vm.prank(address(escrow));
        hourToken.mint(PROVIDER1, 10 * 1e18);

        vm.prank(user1);
        vm.expectRevert("Only escrow");
        hourToken.burn(PROVIDER1, 2 * 1e18);
    }

    function test_Burn_RevertWhen_InsufficientBalance() public {
        vm.prank(address(escrow));
        hourToken.mint(PROVIDER1, 5 * 1e18);

        vm.prank(address(escrow));
        vm.expectRevert("Insufficient balance");
        hourToken.burn(PROVIDER1, 10 * 1e18);
    }

    function test_Transfers_BetweenUsers() public {
        vm.prank(address(escrow));
        hourToken.mint(PROVIDER1, 20 * 1e18);

        vm.prank(PROVIDER1);
        bool success = hourToken.transfer(BUYER, 5 * 1e18);

        assertTrue(success);
        assertEq(hourToken.balanceOf(BUYER), 5 * 1e18);
        assertEq(hourToken.balanceOf(PROVIDER1), 15 * 1e18);
    }
}

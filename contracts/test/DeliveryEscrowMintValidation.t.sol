// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowMintValidationTest is GridlockTestBase {
    uint256 public seriesId;

    function setUp() public override {
        super.setUp();

        (seriesId, ) = _createSeries(
            T4_CLASS,
            "gT4-NOW",
            uint64(block.timestamp),
            uint64(block.timestamp + 7 days)
        );

        vm.startPrank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");
        gridUSD.approve(address(escrow), 100_000 * 1e6);
        vm.stopPrank();
    }

    function test_RevertWhen_MintZeroHours() public {
        vm.prank(PROVIDER1);
        vm.expectRevert("Hours must be > 0");
        escrow.mint(seriesId, 0);
    }

    function test_RevertWhen_MintInvalidSeriesId() public {
        vm.prank(PROVIDER1);
        vm.expectRevert("Invalid seriesId");
        escrow.mint(999, 10);
    }

    function test_RevertWhen_MintUnregisteredProvider() public {
        address stranger = address(0x7654);
        _fundWithGridUSD(stranger, 10_000 * 1e6);

        vm.startPrank(stranger);
        gridUSD.approve(address(escrow), 10_000 * 1e6);
        vm.expectRevert("Provider not registered");
        escrow.mint(seriesId, 5);
        vm.stopPrank();
    }

    function test_RevertWhen_MintInsufficientAllowance() public {
        address underApproved = address(0x6543);
        _fundWithGridUSD(underApproved, 10_000 * 1e6);

        vm.startPrank(underApproved);
        escrow.registerProvider("UnderApproved Provider");
        gridUSD.approve(address(escrow), 1 * 1e6); // Only approved 1 gUSD, but 10 hours needs 4.2 gUSD

        vm.expectRevert("Insufficient allowance");
        escrow.mint(seriesId, 10);
        vm.stopPrank();
    }

    function test_RevertWhen_MintInsufficientBalance() public {
        address brokeProvider = address(0x5432);

        vm.startPrank(brokeProvider);
        escrow.registerProvider("Broke Provider");
        gridUSD.approve(address(escrow), 10_000 * 1e6);

        vm.expectRevert("Insufficient balance");
        escrow.mint(seriesId, 10);
        vm.stopPrank();
    }

    function test_ValidMint_AccountingDeltas() public {
        uint256 hours_ = 10;
        uint256 expectedBond = (hours_ * 35_000_000 * 120) / 10000; // 4.2 gUSD

        uint256 providerGridUSDBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 escrowGridUSDBefore = gridUSD.balanceOf(address(escrow));
        uint256 providerOpenBefore = escrow.openHours(seriesId, PROVIDER1);

        vm.prank(PROVIDER1);
        uint256 bond = escrow.mint(seriesId, hours_);

        assertEq(bond, expectedBond);
        assertEq(providerGridUSDBefore - gridUSD.balanceOf(PROVIDER1), expectedBond);
        assertEq(gridUSD.balanceOf(address(escrow)) - escrowGridUSDBefore, expectedBond);
        assertEq(escrow.openHours(seriesId, PROVIDER1) - providerOpenBefore, hours_);
        assertEq(escrow.bondPerHour(seriesId, PROVIDER1), expectedBond / hours_);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowMultiBatchTest is GridlockTestBase {
    uint256 public seriesId;

    function setUp() public override {
        super.setUp();

        // Create H100 series
        (seriesId, ) = _createSeries(
            H100_CLASS,
            "gH100-W43",
            uint64(block.timestamp),
            uint64(block.timestamp + 7 days)
        );

        vm.startPrank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");
        gridUSD.approve(address(escrow), 100_000 * 1e6);
        vm.stopPrank();
    }

    /// @notice Regression test proving that minting batch 2 at a higher price overwrites
    /// batch 1's historical bond rate, breaking conservation of collateral.
    function test_MultiBatchBondAccounting_OverwriteDefect() public {
        // Price A: Set oracle price to $1.00/hr (100_000_000 e8) -> bond per hr = 1.20 gUSD (1_200_000)
        vm.prank(OWNER);
        oracle.pushPrint(H100_CLASS, uint64(block.timestamp), 100_000_000);

        // Batch 1: Provider mints 10 hours at $1.00/hr
        vm.prank(PROVIDER1);
        uint256 bond1 = escrow.mint(seriesId, 10);
        assertEq(bond1, 12_000_000); // 12 gUSD
        assertEq(escrow.bondPerHour(seriesId, PROVIDER1), 1_200_000);
        assertEq(escrow.openHours(seriesId, PROVIDER1), 10);

        // Price B: Price increases to $2.00/hr (200_000_000 e8) -> bond per hr = 2.40 gUSD (2_400_000)
        vm.prank(OWNER);
        oracle.pushPrint(H100_CLASS, uint64(block.timestamp), 200_000_000);

        // Batch 2: Provider mints 10 hours at $2.00/hr
        vm.prank(PROVIDER1);
        uint256 bond2 = escrow.mint(seriesId, 10);
        assertEq(bond2, 24_000_000); // 24 gUSD
        assertEq(escrow.openHours(seriesId, PROVIDER1), 20);

        // In a tranche-safe model, total deposited bond = 36_000_000 for 20 hours -> 1_800_000 per hour
        // But under the unpatched contract, bondPerHour is overwritten to 2_400_000:
        uint256 recordedRate = escrow.bondPerHour(seriesId, PROVIDER1);

        // Assert defect presence: unpatched rate equals 2_400_000 instead of weighted average 1_800_000
        assertEq(recordedRate, 2_400_000, "Defect reproduced: batch 2 overwrote batch 1 bond rate");
    }
}

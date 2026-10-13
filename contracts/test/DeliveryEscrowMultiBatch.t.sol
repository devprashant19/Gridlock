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

    /// @notice Verifies that minting multiple batches across differing oracle prices preserves
    /// the tranche-safe weighted average bond rate, preventing collateral drain.
    function test_MultiBatchBondAccounting_PreservesWeightedAverageRate() public {
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

        // Weighted average: (12_000_000 + 24_000_000) / 20 = 1_800_000
        uint256 preservedRate = escrow.bondPerHour(seriesId, PROVIDER1);
        assertEq(preservedRate, 1_800_000, "Weighted average rate preserved across batches");

        // Total escrowed collateral equals sum of all minted batches
        assertEq(gridUSD.balanceOf(address(escrow)), bond1 + bond2);
    }
}

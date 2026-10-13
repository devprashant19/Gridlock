// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract SanityTest is GridlockTestBase {
    function test_DeploymentSanity() public view {
        assertEq(address(escrow.gridUSD()), address(gridUSD));
        assertEq(address(escrow.oracle()), address(oracle));
        assertEq(address(escrow.factory()), address(factory));
        assertEq(escrow.verifierSigner(), verifierSigner);
        assertEq(escrow.forwarder(), FORWARDER);
        assertEq(oracle.forwarder(), FORWARDER);
    }

    function test_InitialBalances() public view {
        assertEq(gridUSD.balanceOf(PROVIDER1), 100_000 * 1e6);
        assertEq(gridUSD.balanceOf(PROVIDER2), 100_000 * 1e6);
        assertEq(gridUSD.balanceOf(BUYER), 100_000 * 1e6);
    }

    function test_InitialOraclePrices() public view {
        (uint128 t4Price, ) = oracle.latest(T4_CLASS);
        assertEq(t4Price, 35_000_000);

        (uint128 h100Price, ) = oracle.latest(H100_CLASS);
        assertEq(h100Price, 265_000_000);
    }

    function test_TimeWarpHelper() public {
        uint256 start = block.timestamp;
        warpForward(1 days);
        assertEq(block.timestamp, start + 1 days);
    }

    function test_DeterministicSeriesWindows() public {
        (uint256 seriesId, address tokenAddr, uint64 start, uint64 end) = 
            _createDeterministicActiveSeries(A100_CLASS, "gA100-ACTIVE", 7 days);

        assertEq(start, block.timestamp);
        assertEq(end, block.timestamp + 7 days);
        assertTrue(tokenAddr != address(0));

        (uint256 futSeriesId, , uint64 futStart, uint64 futEnd) = 
            _createDeterministicFutureSeries(H100_CLASS, "gH100-FUT", 2 days, 5 days);

        assertEq(futStart, block.timestamp + 2 days);
        assertEq(futEnd, block.timestamp + 7 days);
        assertTrue(futSeriesId > seriesId);
    }
}

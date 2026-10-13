// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DemoFixtureTest is GridlockTestBase {
    uint256 internal demoSeriesId;
    address internal demoToken;
    uint64 internal activeStart;
    uint64 internal activeEnd;

    function test_ReproducibleDemoFixture_InitialState() public {
        // 1. Verify contracts are properly wired
        assertEq(address(escrow.gridUSD()), address(gridUSD));
        assertEq(address(escrow.oracle()), address(oracle));
        assertEq(address(escrow.factory()), address(factory));
        assertEq(escrow.verifierSigner(), verifierSigner);
        assertEq(escrow.forwarder(), FORWARDER);

        // 2. Seed payment tokens and register provider
        _fundWithGridUSD(PROVIDER1, 50_000 * 1e6);
        vm.prank(PROVIDER1);
        escrow.registerProvider("RunPod Alpha Cluster");

        (string memory name, bool registered) = escrow.providers(PROVIDER1);
        assertEq(name, "RunPod Alpha Cluster");
        assertTrue(registered);

        // 3. Create a representative GPU series with a controlled active window
        (demoSeriesId, demoToken, activeStart, activeEnd) = 
            _createDeterministicActiveSeries(H100_CLASS, "gH100-DEMO", 7 days);

        assertEq(demoSeriesId, 0);
        assertTrue(demoToken != address(0));
        assertEq(activeStart, block.timestamp);
        assertEq(activeEnd, block.timestamp + 7 days);

        // 4. Verify baseline oracle pricing
        (uint128 h100Price, ) = oracle.latest(H100_CLASS);
        assertEq(h100Price, 265_000_000); // $2.65/hr
    }
}

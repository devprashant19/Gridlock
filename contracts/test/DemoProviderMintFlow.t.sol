// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DemoProviderMintFlowTest is GridlockTestBase {
    uint256 internal demoSeriesId;
    HourToken internal demoToken;

    event ProviderRegistered(address indexed provider, string name);
    event Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond);

    function setUp() public override {
        super.setUp();

        (demoSeriesId, , , ) = _createDeterministicActiveSeries(H100_CLASS, "gH100-DEMO", 7 days);
        (, address tokenAddr, , , ) = factory.series(demoSeriesId);
        demoToken = HourToken(tokenAddr);
    }

    function test_ProviderOnboarding_And_MintFlow_Reproducible() public {
        address provider = PROVIDER1;
        uint256 initialGridUSD = 10_000 * 1e6;
        _fundWithGridUSD(provider, initialGridUSD);

        // 1. Provider Registration
        vm.expectEmit(true, false, false, true, address(escrow));
        emit ProviderRegistered(provider, "Lambda Cloud Pod 4");

        vm.prank(provider);
        escrow.registerProvider("Lambda Cloud Pod 4");

        // 2. Allowance Approval
        uint256 approveAmount = 5_000 * 1e6;
        assertEq(gridUSD.allowance(provider, address(escrow)), 0);

        vm.prank(provider);
        gridUSD.approve(address(escrow), approveAmount);
        assertEq(gridUSD.allowance(provider, address(escrow)), approveAmount);

        // 3. Mint Capacity (10 hours)
        // Price for H100 SXM = 265_000_000 ($2.65/hr). Bond = (10 * 265_000_000 * 120) / 10000 = 31_800_000 ($31.80)
        uint256 hoursToMint = 10;
        uint256 expectedBond = (hoursToMint * 265_000_000 * 120) / 10000;

        uint256 providerBalBefore = gridUSD.balanceOf(provider);
        uint256 escrowBalBefore = gridUSD.balanceOf(address(escrow));

        vm.expectEmit(true, true, false, true, address(escrow));
        emit Minted(demoSeriesId, provider, hoursToMint, expectedBond);

        vm.prank(provider);
        uint256 actualBond = escrow.mint(demoSeriesId, hoursToMint);

        assertEq(actualBond, expectedBond);

        // 4. Verify Balance and Allowance Transitions
        assertEq(gridUSD.balanceOf(provider), providerBalBefore - expectedBond);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBalBefore + expectedBond);
        assertEq(gridUSD.allowance(provider, address(escrow)), approveAmount - expectedBond);

        // 5. Verify HourToken Issuance
        assertEq(demoToken.balanceOf(provider), hoursToMint * 1e18);
        assertEq(demoToken.totalSupply(), hoursToMint * 1e18);

        // 6. Verify Escrow Storage State
        assertEq(escrow.openHours(demoSeriesId, provider), hoursToMint);
        assertEq(escrow.bondPerHour(demoSeriesId, provider), expectedBond / hoursToMint);
    }
}

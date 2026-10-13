// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract CollateralMathTest is GridlockTestBase {
    function test_BondCalculation_T4_Representative() public pure {
        // T4 at $0.35/hr (35_000_000 e8) for 10 hours
        // Expected bond: 10 * 0.35 * 1.20 = $4.20 = 4_200_000 gUSD (6 decimals)
        uint256 hours_ = 10;
        uint128 priceE8 = 35_000_000;
        uint256 bond = (hours_ * uint256(priceE8) * 120) / 10000;

        assertEq(bond, 4_200_000);
    }

    function test_BondCalculation_H100_Representative() public pure {
        // H100 SXM at $2.65/hr (265_000_000 e8) for 1 hour
        // Expected bond: 1 * 2.65 * 1.20 = $3.18 = 3_180_000 gUSD
        uint256 hours_ = 1;
        uint128 priceE8 = 265_000_000;
        uint256 bond = (hours_ * uint256(priceE8) * 120) / 10000;

        assertEq(bond, 3_180_000);
    }

    function test_BondCalculation_A100_Representative() public pure {
        // A100 SXM4 at $1.80/hr (180_000_000 e8) for 5 hours
        // Expected bond: 5 * 1.80 * 1.20 = $10.80 = 10_800_000 gUSD
        uint256 hours_ = 5;
        uint128 priceE8 = 180_000_000;
        uint256 bond = (hours_ * uint256(priceE8) * 120) / 10000;

        assertEq(bond, 10_800_000);
    }

    function test_BondCalculation_LargeCapacity() public pure {
        // 10,000 hours at $3.40/hr (340_000_000 e8)
        // Expected bond: 10,000 * 3.40 * 1.20 = $40,800 = 40_800_000_000 gUSD
        uint256 hours_ = 10_000;
        uint128 priceE8 = 340_000_000;
        uint256 bond = (hours_ * uint256(priceE8) * 120) / 10000;

        assertEq(bond, 40_800_000_000);
    }

    function test_ActualMintPullExactBond() public {
        (, address token) = _createSeries(T4_CLASS, "gT4-NOW", uint64(block.timestamp), uint64(block.timestamp + 7 days));

        vm.startPrank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");
        gridUSD.approve(address(escrow), 100_000 * 1e6);

        uint256 balanceBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 bondReturned = escrow.mint(0, 10);
        uint256 balanceAfter = gridUSD.balanceOf(PROVIDER1);

        assertEq(bondReturned, 4_200_000);
        assertEq(balanceBefore - balanceAfter, 4_200_000);
        assertEq(HourToken(token).balanceOf(PROVIDER1), 10 * 1e18);
        vm.stopPrank();
    }
}

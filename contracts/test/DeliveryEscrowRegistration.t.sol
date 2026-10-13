// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowRegistrationTest is GridlockTestBase {
    address public unregisteredUser = address(0x8888);
    uint256 public testSeriesId;

    function setUp() public override {
        super.setUp();

        // Create standard test series
        (testSeriesId, ) = _createSeries(
            T4_CLASS,
            "gT4-NOW",
            uint64(block.timestamp),
            uint64(block.timestamp + 7 days)
        );

        // Fund unregistered user with GridUSD
        _fundWithGridUSD(unregisteredUser, 10_000 * 1e6);
    }

    function test_ProviderRegistration_Success() public {
        vm.prank(PROVIDER1);
        escrow.registerProvider("Provider Alpha");

        (string memory name, bool registered) = escrow.providers(PROVIDER1);
        assertEq(name, "Provider Alpha");
        assertTrue(registered);
    }

    /// @notice Regression test verifying registration enforcement on mint.
    /// Fails against unpatched contract because mint() currently lacks registration check.
    function test_RevertWhen_ProviderNotRegistered() public {
        vm.startPrank(unregisteredUser);
        gridUSD.approve(address(escrow), 10_000 * 1e6);

        // Intended policy: minting requires prior provider registration
        vm.expectRevert("Provider not registered");
        escrow.mint(testSeriesId, 5);
        vm.stopPrank();
    }
}

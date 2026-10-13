// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract IntegrationSmokeCheckTest is GridlockTestBase {
    function test_BytecodePresence_CoreContracts() public view {
        assertTrue(address(gridUSD).code.length > 0, "GridUSD has no bytecode");
        assertTrue(address(oracle).code.length > 0, "IndexOracle has no bytecode");
        assertTrue(address(escrow).code.length > 0, "DeliveryEscrow has no bytecode");
        assertTrue(address(factory).code.length > 0, "SeriesFactory has no bytecode");
    }

    function test_RejectPlaceholderAddresses() public pure {
        address[4] memory placeholders = [
            address(0x1111111111111111111111111111111111111111),
            address(0x2222222222222222222222222222222222222222),
            address(0x3333333333333333333333333333333333333333),
            address(0x4444444444444444444444444444444444444444)
        ];

        for (uint256 i = 0; i < placeholders.length; i++) {
            assertTrue(_isPlaceholder(placeholders[i]), "Should detect placeholder");
        }
    }

    function test_DeployedContracts_NotPlaceholders() public view {
        assertFalse(_isPlaceholder(address(gridUSD)), "GridUSD is placeholder");
        assertFalse(_isPlaceholder(address(oracle)), "IndexOracle is placeholder");
        assertFalse(_isPlaceholder(address(escrow)), "DeliveryEscrow is placeholder");
        assertFalse(_isPlaceholder(address(factory)), "SeriesFactory is placeholder");
    }

    function test_CoreInterfaceSignatures_Callable() public view {
        // Safe static view calls to verify expected interfaces
        assertEq(gridUSD.decimals(), 6);
        (uint128 t4Price, ) = oracle.latest(T4_CLASS);
        assertTrue(t4Price > 0);
        assertEq(factory.seriesCount(), 0);
        assertEq(escrow.owner(), OWNER);
        assertEq(escrow.verifierSigner(), verifierSigner);
    }

    function _isPlaceholder(address target) internal pure returns (bool) {
        if (target == address(0)) return true;
        bytes20 b = bytes20(target);
        // Check for repeating byte patterns like 0x1111... or 0x2222...
        bytes1 first = b[0];
        for (uint256 i = 1; i < 20; i++) {
            if (b[i] != first) return false;
        }
        return true;
    }
}

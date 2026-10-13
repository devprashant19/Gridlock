// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DeliveryEscrowSignerConfigTest is GridlockTestBase {
    function test_RevertWhen_ZeroVerifierSignerInConstructor() public {
        vm.expectRevert("Invalid verifier signer address");
        new DeliveryEscrow(address(gridUSD), address(oracle), address(0));
    }

    function test_RevertWhen_ZeroGridUSDInConstructor() public {
        vm.expectRevert("Invalid GridUSD address");
        new DeliveryEscrow(address(0), address(oracle), verifierSigner);
    }

    function test_RevertWhen_ZeroOracleInConstructor() public {
        vm.expectRevert("Invalid oracle address");
        new DeliveryEscrow(address(gridUSD), address(0), verifierSigner);
    }

    function test_RevertWhen_ZeroVerifierSignerInSetter() public {
        vm.prank(OWNER);
        vm.expectRevert("Invalid verifier signer address");
        escrow.setVerifierSigner(address(0));
    }

    function test_RevertWhen_SetVerifierSigner_NotOwner() public {
        address newSigner = address(0x8888);
        vm.prank(BUYER);
        vm.expectRevert("Only owner");
        escrow.setVerifierSigner(newSigner);
    }

    function test_SetVerifierSigner_Success_ByOwner() public {
        address newSigner = address(0x8888);
        vm.prank(OWNER);
        escrow.setVerifierSigner(newSigner);
        assertEq(escrow.verifierSigner(), newSigner);
    }
}

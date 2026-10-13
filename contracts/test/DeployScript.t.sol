// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../script/Deploy.s.sol";

contract DeployScriptTest is Test {
    DeployScript internal script;

    function setUp() public {
        script = new DeployScript();
    }

    function test_LocalDeployment_RunsReproducibly() public {
        uint256 testDeployerPk = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address testVerifierSigner = vm.addr(0xABCD1234);

        vm.setEnv("DEPLOYER_PK", vm.toString(testDeployerPk));
        vm.setEnv("VERIFIER_SIGNER_ADDRESS", vm.toString(testVerifierSigner));

        // Execute deployment script in simulation mode
        script.run();
    }
}

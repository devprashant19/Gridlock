// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/GridUSD.sol";
import "../src/IndexOracle.sol";
import "../src/HourToken.sol";
import "../src/SeriesFactory.sol";
import "../src/DeliveryEscrow.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PK");
        address verifierSigner = vm.envAddress("VERIFIER_SIGNER_ADDRESS");
        require(verifierSigner != address(0), "VERIFIER_SIGNER_ADDRESS must be set and non-zero");

        vm.startBroadcast(deployerPrivateKey);

        GridUSD gridUSD = new GridUSD();
        console.log("GridUSD deployed at:", address(gridUSD));

        IndexOracle oracle = new IndexOracle();
        console.log("IndexOracle deployed at:", address(oracle));

        DeliveryEscrow escrow = new DeliveryEscrow(address(gridUSD), address(oracle), verifierSigner);
        console.log("DeliveryEscrow deployed at:", address(escrow));

        SeriesFactory factory = new SeriesFactory(address(escrow));
        console.log("SeriesFactory deployed at:", address(factory));

        escrow.setFactory(address(factory));

        _seedInitialPrices(oracle);
        _createDefaultSeries(factory);

        vm.stopBroadcast();

        _writeDeploymentMetadata(
            address(gridUSD),
            address(oracle),
            address(escrow),
            address(factory),
            verifierSigner
        );
    }

    function _seedInitialPrices(IndexOracle oracle) internal {
        oracle.setFixedPrice("T4", 35_000_000); // $0.35/hr
        oracle.pushPrint(keccak256("H100 SXM"), uint64(block.timestamp), 265_000_000); // $2.65/hr
        oracle.pushPrint(keccak256("A100 SXM4"), uint64(block.timestamp), 180_000_000); // $1.80/hr
        oracle.pushPrint(keccak256("H200"), uint64(block.timestamp), 340_000_000); // $3.40/hr
    }

    function _createDefaultSeries(SeriesFactory factory) internal {
        uint64 now_ = uint64(block.timestamp);
        factory.createSeries(keccak256("T4"), "gT4-NOW", now_, now_ + 7 days);
        factory.createSeries(keccak256("H100 SXM"), "gH100-W43", now_ + 7 days, now_ + 14 days);
        factory.createSeries(keccak256("H100 SXM"), "gH100-W44", now_ + 14 days, now_ + 21 days);
        factory.createSeries(keccak256("A100 SXM4"), "gA100-W43", now_ + 7 days, now_ + 14 days);
    }

    function _writeDeploymentMetadata(
        address gridUSD,
        address oracle,
        address escrow,
        address factory,
        address verifierSigner
    ) internal {
        string memory contractsObj = "contracts";
        vm.serializeAddress(contractsObj, "GridUSD", gridUSD);
        vm.serializeAddress(contractsObj, "IndexOracle", oracle);
        vm.serializeAddress(contractsObj, "SeriesFactory", factory);
        string memory contractsOutput = vm.serializeAddress(contractsObj, "DeliveryEscrow", escrow);

        string memory extObj = "external";
        vm.serializeAddress(extObj, "kuruRouter", address(0x7EFbE105Ca7415dE98F96622173458ac1c054630));
        string memory extOutput = vm.serializeAddress(extObj, "verifierSigner", verifierSigner);

        string memory root = "root";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeString(root, "network", "local-sim");
        vm.serializeUint(root, "deployBlock", block.number);
        vm.serializeString(root, "contracts", contractsOutput);
        string memory finalJson = vm.serializeString(root, "external", extOutput);

        string memory exportPath = vm.envOr("DEPLOYMENT_OUT", string("../deployments/local.json"));
        vm.writeJson(finalJson, exportPath);
        console.log("Truthful deployment metadata written to:", exportPath);
    }
}

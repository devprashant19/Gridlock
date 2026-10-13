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
        address verifierSigner = vm.envOr("VERIFIER_SIGNER_ADDRESS", address(0x5555555555555555555555555555555555555555));

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy GridUSD
        GridUSD gridUSD = new GridUSD();
        console.log("GridUSD deployed at:", address(gridUSD));

        // 2. Deploy IndexOracle
        IndexOracle oracle = new IndexOracle();
        console.log("IndexOracle deployed at:", address(oracle));

        // 3. Deploy DeliveryEscrow
        DeliveryEscrow escrow = new DeliveryEscrow(address(gridUSD), address(oracle), verifierSigner);
        console.log("DeliveryEscrow deployed at:", address(escrow));

        // 4. Deploy SeriesFactory
        SeriesFactory factory = new SeriesFactory(address(escrow));
        console.log("SeriesFactory deployed at:", address(factory));

        // 5. Wire factory to escrow
        escrow.setFactory(address(factory));

        // 6. Push initial prices
        oracle.setFixedPrice("T4", 35_000_000); // $0.35/hr
        oracle.pushPrint(keccak256("H100 SXM"), uint64(block.timestamp), 265_000_000); // $2.65/hr
        oracle.pushPrint(keccak256("A100 SXM4"), uint64(block.timestamp), 180_000_000); // $1.80/hr
        oracle.pushPrint(keccak256("H200"), uint64(block.timestamp), 340_000_000); // $3.40/hr

        // 7. Create default series
        uint64 now_ = uint64(block.timestamp);
        (uint256 s1, address t1) = factory.createSeries(keccak256("T4"), "gT4-NOW", now_, now_ + 7 days);
        console.log("Series 1 (gT4-NOW):", s1, t1);

        (uint256 s2, address t2) = factory.createSeries(keccak256("H100 SXM"), "gH100-W43", now_ + 7 days, now_ + 14 days);
        console.log("Series 2 (gH100-W43):", s2, t2);

        (uint256 s3, address t3) = factory.createSeries(keccak256("H100 SXM"), "gH100-W44", now_ + 14 days, now_ + 21 days);
        console.log("Series 3 (gH100-W44):", s3, t3);

        (uint256 s4, address t4) = factory.createSeries(keccak256("A100 SXM4"), "gA100-W43", now_ + 7 days, now_ + 14 days);
        console.log("Series 4 (gA100-W43):", s4, t4);

        vm.stopBroadcast();
    }
}

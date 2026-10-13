// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GridUSD.sol";
import "../src/IndexOracle.sol";
import "../src/HourToken.sol";
import "../src/SeriesFactory.sol";
import "../src/DeliveryEscrow.sol";

abstract contract GridlockTestBase is Test {
    // Deterministic test accounts
    address public constant OWNER = address(0x1001);
    address public constant PROVIDER1 = address(0x2001);
    address public constant PROVIDER2 = address(0x2002);
    address public constant BUYER = address(0x3001);
    address public constant FORWARDER = address(0x4001);

    uint256 public constant VERIFIER_PK = 0xABCD1234;
    address public verifierSigner;

    // Standard starting timestamp (realistic Unix epoch)
    uint256 public constant START_TIME = 1_728_864_000;

    // Contracts
    GridUSD public gridUSD;
    IndexOracle public oracle;
    SeriesFactory public factory;
    DeliveryEscrow public escrow;

    bytes32 public constant H100_CLASS = keccak256("H100 SXM");
    bytes32 public constant T4_CLASS = keccak256("T4");
    bytes32 public constant A100_CLASS = keccak256("A100 SXM4");
    bytes32 public constant H200_CLASS = keccak256("H200");

    function setUp() public virtual {
        vm.warp(START_TIME);
        verifierSigner = vm.addr(VERIFIER_PK);

        vm.startPrank(OWNER);

        gridUSD = new GridUSD();
        oracle = new IndexOracle();
        escrow = new DeliveryEscrow(address(gridUSD), address(oracle), verifierSigner);
        factory = new SeriesFactory(address(escrow));

        escrow.setFactory(address(factory));
        escrow.setForwarder(FORWARDER);
        oracle.setForwarder(FORWARDER);

        // Push baseline oracle prices (8 decimals)
        oracle.setFixedPrice("T4", 35_000_000); // $0.35/hr
        oracle.pushPrint(H100_CLASS, uint64(block.timestamp), 265_000_000); // $2.65/hr
        oracle.pushPrint(A100_CLASS, uint64(block.timestamp), 180_000_000); // $1.80/hr
        oracle.pushPrint(H200_CLASS, uint64(block.timestamp), 340_000_000); // $3.40/hr

        vm.stopPrank();

        // Seed deterministic test balances (GridUSD has 6 decimals)
        _fundWithGridUSD(PROVIDER1, 100_000 * 1e6);
        _fundWithGridUSD(PROVIDER2, 100_000 * 1e6);
        _fundWithGridUSD(BUYER, 100_000 * 1e6);
    }

    function _fundWithGridUSD(address recipient, uint256 amount) internal {
        deal(address(gridUSD), recipient, amount);
    }

    function _createSeries(
        bytes32 gpuClass,
        string memory symbol,
        uint64 windowStart,
        uint64 windowEnd
    ) internal returns (uint256 seriesId, address token) {
        vm.prank(OWNER);
        (seriesId, token) = factory.createSeries(gpuClass, symbol, windowStart, windowEnd);
    }

    function warpTo(uint256 targetTimestamp) internal {
        vm.warp(targetTimestamp);
    }

    function warpForward(uint256 duration) internal {
        vm.warp(block.timestamp + duration);
    }
}

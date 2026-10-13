// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";

contract DemoSettlementOutcomesTest is GridlockTestBase {
    uint256 internal demoSeriesId;
    HourToken internal demoToken;

    event Settled(
        uint256 indexed deliveryId,
        uint8 verdict,
        uint32 tflopsE2,
        uint256 toBuyer,
        uint256 toProvider
    );

    function setUp() public override {
        super.setUp();

        (demoSeriesId, , , ) = _createDeterministicActiveSeries(H100_CLASS, "gH100-DEMO", 7 days);
        (, address tokenAddr, , , ) = factory.series(demoSeriesId);
        demoToken = HourToken(tokenAddr);

        vm.prank(PROVIDER1);
        escrow.registerProvider("RunPod Alpha Cluster");

        _fundWithGridUSD(PROVIDER1, 10_000 * 1e6);
        vm.prank(PROVIDER1);
        gridUSD.approve(address(escrow), type(uint256).max);

        vm.prank(PROVIDER1);
        escrow.mint(demoSeriesId, 30);

        vm.prank(address(escrow));
        demoToken.mint(BUYER, 30 * 1e18);
    }

    function _signVerdict(
        uint256 id,
        uint8 verdict,
        uint32 tflopsE2,
        bytes32 resultRoot
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            escrow.VERDICT_TYPEHASH(),
            id,
            verdict,
            tflopsE2,
            resultRoot
        ));
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            escrow.DOMAIN_SEPARATOR(),
            structHash
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VERIFIER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _setupProvisionedDelivery(uint256 hours_) internal returns (uint256 deliveryId, uint256 bond) {
        vm.prank(BUYER);
        deliveryId = escrow.redeem(demoSeriesId, hours_, bytes32("buyer_key"));

        DeliveryEscrow.Delivery memory d = escrow.getDelivery(deliveryId);
        bond = d.bondAmount;

        vm.prank(PROVIDER1);
        escrow.provision(deliveryId, hex"01abcdef");
    }

    function test_EndToEnd_PASS_Outcome() public {
        (uint256 id, uint256 bond) = _setupProvisionedDelivery(5);

        uint256 providerBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBefore = gridUSD.balanceOf(BUYER);
        uint256 escrowBefore = gridUSD.balanceOf(address(escrow));

        bytes memory sig = _signVerdict(id, 1, 31200, bytes32("pass_root"));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit Settled(id, 1, 31200, 0, bond);

        escrow.settleWithSig(id, 1, 31200, bytes32("pass_root"), sig);

        // Assert 100% to provider
        assertEq(gridUSD.balanceOf(PROVIDER1), providerBefore + bond);
        assertEq(gridUSD.balanceOf(BUYER), buyerBefore);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBefore - bond);
    }

    function test_EndToEnd_DEGRADED_Outcome() public {
        (uint256 id, uint256 bond) = _setupProvisionedDelivery(5);

        uint256 providerBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBefore = gridUSD.balanceOf(BUYER);
        uint256 escrowBefore = gridUSD.balanceOf(address(escrow));

        uint256 expectedProvider = (bond * 70) / 100;
        uint256 expectedBuyer = bond - expectedProvider;

        bytes memory sig = _signVerdict(id, 2, 21000, bytes32("degraded_root"));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit Settled(id, 2, 21000, expectedBuyer, expectedProvider);

        escrow.settleWithSig(id, 2, 21000, bytes32("degraded_root"), sig);

        // Assert 70% to provider, 30% to buyer
        assertEq(gridUSD.balanceOf(PROVIDER1), providerBefore + expectedProvider);
        assertEq(gridUSD.balanceOf(BUYER), buyerBefore + expectedBuyer);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBefore - bond);
        assertEq(expectedProvider + expectedBuyer, bond);
    }

    function test_EndToEnd_FAIL_Outcome() public {
        (uint256 id, uint256 bond) = _setupProvisionedDelivery(5);

        uint256 providerBefore = gridUSD.balanceOf(PROVIDER1);
        uint256 buyerBefore = gridUSD.balanceOf(BUYER);
        uint256 escrowBefore = gridUSD.balanceOf(address(escrow));

        bytes memory sig = _signVerdict(id, 3, 5000, bytes32("fail_root"));

        vm.expectEmit(true, false, false, true, address(escrow));
        emit Settled(id, 3, 5000, bond, 0);

        escrow.settleWithSig(id, 3, 5000, bytes32("fail_root"), sig);

        // Assert 100% refund to buyer
        assertEq(gridUSD.balanceOf(BUYER), buyerBefore + bond);
        assertEq(gridUSD.balanceOf(PROVIDER1), providerBefore);
        assertEq(gridUSD.balanceOf(address(escrow)), escrowBefore - bond);
    }
}

import testnetDeployments from "../../deployments/testnet.json";
import GridUSDAbi from "../../abis/GridUSD.json";
import DeliveryEscrowAbi from "../../abis/DeliveryEscrow.json";
import IndexOracleAbi from "../../abis/IndexOracle.json";
import SeriesFactoryAbi from "../../abis/SeriesFactory.json";
import HourTokenAbi from "../../abis/HourToken.json";

export const DEPLOYMENTS = testnetDeployments;

export const CONTRACT_ADDRESSES = {
  chainId: DEPLOYMENTS.chainId,
  gridUSD: DEPLOYMENTS.contracts.GridUSD as `0x${string}`,
  indexOracle: DEPLOYMENTS.contracts.IndexOracle as `0x${string}`,
  seriesFactory: DEPLOYMENTS.contracts.SeriesFactory as `0x${string}`,
  deliveryEscrow: DEPLOYMENTS.contracts.DeliveryEscrow as `0x${string}`,
  kuruRouter: DEPLOYMENTS.external.kuruRouter as `0x${string}`,
  verifierSigner: DEPLOYMENTS.external.verifierSigner as `0x${string}`,
};

export const ABIS = {
  GridUSD: GridUSDAbi,
  DeliveryEscrow: DeliveryEscrowAbi,
  IndexOracle: IndexOracleAbi,
  SeriesFactory: SeriesFactoryAbi,
  HourToken: HourTokenAbi,
};

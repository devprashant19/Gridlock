// Creates one Kuru order book (HourToken / GridUSD) per series and writes the full
// deployments/testnet.json the web app and indexer read (series ids, tokens, windows,
// kuruMarket). Run after `forge script script/Deploy.s.sol` with DEPLOYMENT_OUT pointing
// at the same file. Idempotent: markets that already have code are kept.
import { ethers } from "ethers";
import { ParamCreator } from "@kuru-labs/kuru-sdk";
import { ABI, KURU_MARGIN_ACCOUNT, KURU_ROUTER, MARKET, readDeployments, wallet, writeDeployments, DEPLOYMENTS, SeriesEntry } from "./common";

async function main() {
  const signer = wallet("DEPLOYER_PK");
  const p = signer.provider as ethers.providers.Provider;
  const dep = readDeployments();
  const net = await p.getNetwork();
  console.log(`Deployer ${signer.address} on chain ${net.chainId}; writing ${DEPLOYMENTS}`);

  const factory = new ethers.Contract(dep.contracts.SeriesFactory, ABI.factory, p);
  if ((await p.getCode(factory.address)) === "0x") throw new Error(`No SeriesFactory code at ${factory.address}`);

  const count = (await factory.seriesCount()).toNumber();
  const previous = dep.series ?? {};
  const series: Record<string, SeriesEntry> = {};
  const creator = new ParamCreator();

  for (let id = 0; id < count; id++) {
    const s = await factory.series(id);
    const symbol: string = s.symbol;
    let market = previous[symbol]?.kuruMarket;
    if (market && (await p.getCode(market)) !== "0x") {
      console.log(`  ${symbol} (#${id}) keeps market ${market}`);
    } else {
      market = await creator.deployMarket(
        signer, KURU_ROUTER, MARKET.type, s.token, dep.contracts.GridUSD,
        MARKET.sizePrecision, MARKET.pricePrecision, MARKET.tickSize, MARKET.minSize, MARKET.maxSize,
        MARKET.takerFeeBps, MARKET.makerFeeBps, MARKET.ammSpread,
      );
      console.log(`  ${symbol} (#${id}) new Kuru market ${market}`);
    }
    series[symbol] = {
      seriesId: id,
      gpuClass: s.gpuClass,
      token: s.token,
      kuruMarket: market,
      windowStart: Number(s.windowStart),
      windowEnd: Number(s.windowEnd),
    };
    // write after every market so a failure halfway doesn't lose deployed books
    writeDeployments({
      ...dep,
      network: net.chainId === 10143 ? "monad-testnet" : dep.network,
      external: { ...dep.external, kuruRouter: KURU_ROUTER, kuruMarginAccount: KURU_MARGIN_ACCOUNT },
      series: { ...series },
    });
  }
  console.log(`Done: ${Object.keys(series).length} series. Next: npm run seed-ladder, then \`pnpm sync\` in web/ and indexer/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

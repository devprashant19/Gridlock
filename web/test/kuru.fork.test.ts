// Kuru buy/sell through the scoped Mera ethers signer, against an anvil fork of Monad
// testnet. Skipped unless KURU_FORK_RPC is set, e.g.:
//   anvil --fork-url https://testnet-rpc.monad.xyz --chain-id 10143 --port 8547
//   (cd ../contracts && forge build --contracts src)
//   KURU_FORK_RPC=http://127.0.0.1:8547 pnpm vitest run test/kuru.fork.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ethers } from "ethers";

const RPC = process.env.KURU_FORK_RPC;
const ANVIL_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const OUT = process.env.FORGE_OUT ?? resolve(__dirname, "../../contracts/out");

const artifact = (file: string, name: string) => {
  const j = JSON.parse(readFileSync(resolve(OUT, file, `${name}.json`), "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object as string };
};

describe.skipIf(!RPC)("Kuru trading via Mera session (fork)", () => {
  it("seller rests an ask, buyer market-buys it", async () => {
    process.env.NEXT_PUBLIC_MONAD_RPC = RPC;
    const { createSecp256k1SigningSession } = await import("@category-labs/mera");
    const { toViemAccount } = await import("@category-labs/mera/viem");
    const { deriveEvmPrivateKey } = await import("../lib/wallet/derive");
    const { scopeAccount } = await import("../lib/wallet/scope");
    const { MeraEthersSigner } = await import("../lib/wallet/ethersSigner");
    const { getEthersProvider } = await import("../lib/chain");
    const { KURU_MARGIN_ACCOUNT, KURU_ROUTER } = await import("../lib/config");
    const kuru = await import("../lib/kuru");
    const { ParamCreator } = await import("@kuru-labs/kuru-sdk");

    const provider = getEthersProvider();
    const deployer = new ethers.Wallet(ANVIL_PK, provider);

    const g = artifact("GridUSD.sol", "GridUSD");
    const h = artifact("HourToken.sol", "HourToken");
    const gusd = await new ethers.ContractFactory(g.abi, g.bytecode, deployer).deploy();
    const hour = await new ethers.ContractFactory(h.abi, h.bytecode, deployer).deploy("gT4-TEST", deployer.address);
    await Promise.all([gusd.deployed(), hour.deployed()]);

    const pc = new ParamCreator();
    // price 1e5 (0.00001 gUSD), tick 100 (= 0.001 gUSD), size 1e6, min 0.01 h. Market type 0 = ERC20/ERC20.
    const B = ethers.BigNumber.from;
    const market = await pc.deployMarket(
      deployer, KURU_ROUTER, 0, hour.address, gusd.address,
      B(1_000_000), B(100_000), B(100), B(10_000), B("100000000000"), 30, 10, B(100),
    );
    expect(market).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const mkSession = async (seed: number) => {
      const pk = deriveEvmPrivateKey(new Uint8Array(32).fill(seed));
      const s = createSecp256k1SigningSession({ privateKey: pk });
      pk.fill(0);
      const scope = { allowlist: [gusd.address, hour.address, market, KURU_MARGIN_ACCOUNT, KURU_ROUTER] as `0x${string}`[], gridUSD: gusd.address as `0x${string}`, capRaw: 200_000_000n, spentRaw: 0n };
      const account = scopeAccount(toViemAccount(s), scope);
      await provider.send("anvil_setBalance", [account.address, "0x8AC7230489E80000"]);
      return { signer: new MeraEthersSigner(account, 10143, provider), address: account.address, scope };
    };
    const seller = await mkSession(1);
    const buyer = await mkSession(2);

    await (await hour.mint(seller.address, ethers.utils.parseUnits("10", 18))).wait();
    await (await gusd.connect(buyer.signer).faucet()).wait();

    await kuru.limitSell(seller.signer, market, 0.40004, 5); // snaps to the 0.400 tick
    const book = await kuru.getBook(market);
    expect(book.asks[0][0]).toBeCloseTo(0.4, 6);
    expect(book.asks[0][1]).toBeCloseTo(5, 6);

    const est = kuru.estimateBuy(book, 1);
    expect(est.hours).toBeCloseTo(2.5, 6);
    await kuru.marketBuy(buyer.signer, market, 1, est.hours * 0.95);

    const got = Number(ethers.utils.formatUnits(await hour.balanceOf(buyer.address), 18));
    expect(got).toBeGreaterThan(2.3); // 2.5h minus taker fee
    expect(buyer.scope.spentRaw).toBe(1_000_000n); // the gUSD approve was booked against the cap
    const after = await kuru.getBook(market);
    expect(after.asks[0][1]).toBeCloseTo(2.5, 6);
  }, 180_000);
});

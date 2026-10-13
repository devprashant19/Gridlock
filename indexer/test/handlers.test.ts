import assert from "assert";
import { TestHelpers } from "generated";

const { MockDb, DeliveryEscrow, SeriesFactory, IndexOracle, KuruOrderBook } = TestHelpers;

const PROVIDER = "0x00000000000000000000000000000000000000a1";
const BUYER = "0x00000000000000000000000000000000000000b1";
const T4 = "0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0";
const MARKET = "0x8888888888888888888888888888888888888888"; // gT4-NOW in src/markets.ts

const block = (n: number) => ({ number: n, timestamp: 1_700_000_000 + n, hash: `0x${n.toString(16).padStart(64, "0")}` });
const meta = (n: number, extra: object = {}) => ({
  mockEventData: { block: block(n), logIndex: n, transaction: { hash: `0x${"ab".repeat(32)}` }, ...extra },
});

async function seed() {
  let db = MockDb.createMockDb();
  db = await SeriesFactory.SeriesCreated.processEvent({
    event: SeriesFactory.SeriesCreated.createMockEvent({
      seriesId: 1n, gpuClass: T4, token: "0x7777777777777777777777777777777777777777",
      windowStart: 1n, windowEnd: 2n, symbol: "gT4-NOW", ...meta(1),
    }),
    mockDb: db,
  });
  db = await DeliveryEscrow.ProviderRegistered.processEvent({
    event: DeliveryEscrow.ProviderRegistered.createMockEvent({ provider: PROVIDER, name: "HyperNode", ...meta(2) }),
    mockDb: db,
  });
  db = await DeliveryEscrow.Minted.processEvent({
    event: DeliveryEscrow.Minted.createMockEvent({ seriesId: 1n, provider: PROVIDER, hours_: 10n, bond: 4_200_000n, ...meta(3) }),
    mockDb: db,
  });
  return db;
}

async function redeemAndProvision(db: ReturnType<typeof MockDb.createMockDb>, id: bigint, hours: bigint, n: number) {
  db = await DeliveryEscrow.DeliveryRequested.processEvent({
    event: DeliveryEscrow.DeliveryRequested.createMockEvent({
      deliveryId: id, seriesId: 1n, buyer: BUYER, provider: PROVIDER, hours_: hours,
      buyerEncPubKey: `0x${"11".repeat(32)}`, deadline: 99n, ...meta(n),
    }),
    mockDb: db,
  });
  return DeliveryEscrow.Provisioned.processEvent({
    event: DeliveryEscrow.Provisioned.createMockEvent({ deliveryId: id, ciphertext: "0xdeadbeef", ...meta(n + 1) }),
    mockDb: db,
  });
}

describe("Gridlock indexer", () => {
  it("tracks series hours and provider mint", async () => {
    const db = await seed();
    const s = db.entities.Series.get("1")!;
    assert.equal(s.symbol, "gT4-NOW");
    assert.equal(s.market, MARKET);
    assert.equal(s.openHours, 10n);
    const p = db.entities.Provider.get(PROVIDER)!;
    assert.equal(p.name, "HyperNode");
    assert.equal(p.minted, 10n);
    assert.equal(p.bondPosted, 4_200_000n);
  });

  it("delivery lifecycle + leaderboard counters per verdict", async () => {
    let db = await seed();
    db = await redeemAndProvision(db, 0n, 1n, 10);
    assert.equal(db.entities.Delivery.get("0")!.status, "Provisioned");
    assert.equal(db.entities.Series.get("1")!.openHours, 9n);

    // FAIL: whole bond to buyer
    db = await DeliveryEscrow.Settled.processEvent({
      event: DeliveryEscrow.Settled.createMockEvent({ deliveryId: 0n, verdict: 3n, tflopsE2: 120n, toBuyer: 420_000n, toProvider: 0n, ...meta(12) }),
      mockDb: db,
    });
    // PASS
    db = await redeemAndProvision(db, 1n, 2n, 20);
    db = await DeliveryEscrow.Settled.processEvent({
      event: DeliveryEscrow.Settled.createMockEvent({ deliveryId: 1n, verdict: 1n, tflopsE2: 815n, toBuyer: 0n, toProvider: 840_000n, ...meta(22) }),
      mockDb: db,
    });
    // DEGRADED
    db = await redeemAndProvision(db, 2n, 1n, 30);
    db = await DeliveryEscrow.Settled.processEvent({
      event: DeliveryEscrow.Settled.createMockEvent({ deliveryId: 2n, verdict: 2n, tflopsE2: 500n, toBuyer: 294_000n, toProvider: 126_000n, ...meta(32) }),
      mockDb: db,
    });

    const d = db.entities.Delivery.get("0")!;
    assert.equal(d.status, "Settled");
    assert.equal(d.verdict, 3);
    assert.equal(d.tflopsE2, 120);

    const p = db.entities.Provider.get(PROVIDER)!;
    assert.deepEqual([p.passes, p.degraded, p.fails], [1, 1, 1]);
    assert.equal(p.slashedTotal, 714_000n);
    assert.equal(p.earnedTotal, 966_000n);
    assert.equal(p.hoursDelivered, 3n); // fail hours excluded
  });

  it("timeout before provisioning counts as a strike", async () => {
    let db = await seed();
    db = await DeliveryEscrow.DeliveryRequested.processEvent({
      event: DeliveryEscrow.DeliveryRequested.createMockEvent({
        deliveryId: 5n, seriesId: 1n, buyer: BUYER, provider: PROVIDER, hours_: 1n,
        buyerEncPubKey: `0x${"11".repeat(32)}`, deadline: 99n, ...meta(40),
      }),
      mockDb: db,
    });
    db = await DeliveryEscrow.TimeoutClaimed.processEvent({
      event: DeliveryEscrow.TimeoutClaimed.createMockEvent({ deliveryId: 5n, toBuyer: 420_000n, toProvider: 0n, ...meta(41) }),
      mockDb: db,
    });
    assert.equal(db.entities.Delivery.get("5")!.status, "TimedOut");
    const p = db.entities.Provider.get(PROVIDER)!;
    assert.equal(p.timeouts, 1);
    assert.equal(p.slashedTotal, 420_000n);
  });

  it("index prints and kuru trades feed the forward curve", async () => {
    let db = await seed();
    db = await IndexOracle.PrintPublished.processEvent({
      event: IndexOracle.PrintPublished.createMockEvent({ gpuClass: T4, dayKey: 20000n, priceE8: 35_000_000n, ...meta(50) }),
      mockDb: db,
    });
    db = await IndexOracle.PrintPublished.processEvent({
      event: IndexOracle.PrintPublished.createMockEvent({ gpuClass: T4, dayKey: 20001n, priceE8: 36_000_000n, ...meta(51) }),
      mockDb: db,
    });
    const c = db.entities.GpuClass.get(T4)!;
    assert.equal(c.latestPriceE8, 36_000_000n);
    assert.equal(c.printCount, 2);

    db = await KuruOrderBook.Trade.processEvent({
      event: KuruOrderBook.Trade.createMockEvent({
        orderId: 7n, makerAddress: PROVIDER, isBuy: false, price: 355_000_000_000_000_000n, updatedSize: 0n,
        takerAddress: BUYER, txOrigin: BUYER, filledSize: 100n, ...meta(52, { srcAddress: MARKET }),
      }),
      mockDb: db,
    });
    const s = db.entities.Series.get("1")!;
    assert.equal(s.lastPrice, 355_000_000_000_000_000n);
    assert.equal(s.tradeCount, 1);
    assert.equal(db.entities.Trade.getAll().length, 1);
  });
});

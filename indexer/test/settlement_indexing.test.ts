import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Settlement & Timeout Indexing", () => {
  it("indexes PASS settlement (verdict 1) and updates provider reputation", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyerAddr = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    // 1. Setup provider, series, and delivery
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "AlphaNode" },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 301n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 20n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    // 2. Settle with PASS verdict (1)
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 301n,
                verdict: 1n,
                tflopsE2: 8250n,
                toBuyer: 0n,
                toProvider: 2400000000n,
              },
            },
          ],
        },
      },
    });

    const delivery = await testIndexer.Delivery.get("301");
    expect(delivery?.status).toBe("SETTLED");
    expect(delivery?.verdict).toBe(1);
    expect(delivery?.toProvider).toBe(2400000000n);

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.passes).toBe(1);
    expect(provider?.hoursDelivered).toBe(20n);
    expect(provider?.slashedTotal).toBe(0n);
  });

  it("indexes DEGRADED settlement (verdict 2) and records partial slash", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x3333333333333333333333333333333333333333" as `0x${string}`;
    const buyerAddr = "0x4444444444444444444444444444444444444444" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "BetaNode" },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 302n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 10n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 302n,
                verdict: 2n,
                tflopsE2: 5500n,
                toBuyer: 360000000n,
                toProvider: 840000000n,
              },
            },
          ],
        },
      },
    });

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.degraded).toBe(1);
    expect(provider?.hoursDelivered).toBe(10n);
    expect(provider?.slashedTotal).toBe(360000000n);
  });

  it("indexes FAIL settlement (verdict 3) and records full slash without hours delivered", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x5555555555555555555555555555555555555555" as `0x${string}`;
    const buyerAddr = "0x6666666666666666666666666666666666666666" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "GammaNode" },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 303n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 15n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 303n,
                verdict: 3n,
                tflopsE2: 1200n,
                toBuyer: 1800000000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.fails).toBe(1);
    expect(provider?.hoursDelivered).toBe(0n);
    expect(provider?.slashedTotal).toBe(1800000000n);
  });

  it("indexes TimeoutClaimed correctly", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x7777777777777777777777777777777777777777" as `0x${string}`;
    const buyerAddr = "0x8888888888888888888888888888888888888888" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "DeltaNode" },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 304n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 8n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "TimeoutClaimed",
              params: {
                deliveryId: 304n,
                toBuyer: 960000000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    const delivery = await testIndexer.Delivery.get("304");
    expect(delivery?.status).toBe("TIMEOUT");
    expect(delivery?.toBuyer).toBe(960000000n);

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.timeouts).toBe(1);
    expect(provider?.slashedTotal).toBe(960000000n);
  });
});

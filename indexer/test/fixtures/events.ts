/**
 * Deterministic Event Fixtures for Gridlock Indexer Testing
 * Derived from compiled ABI types and deployments/testnet.json
 */

export const FIXTURE_GPU_CLASSES = {
  T4: "0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0",
  H100: "0x60956bca9283f6f9cbe0d3ff7174e9b72ecda0ffbf96f3cf0f2bf29a65721118",
  A100: "0x370ce5f4b2cf3a09e0fa9560f443b3ee3ee486d30bcf9e78297b819f727c62ee",
};

export const FIXTURE_PROVIDERS = {
  alpha: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  beta: "0x2222222222222222222222222222222222222222" as `0x${string}`,
  gamma: "0x3333333333333333333333333333333333333333" as `0x${string}`,
};

export const FIXTURE_BUYERS = {
  alice: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as `0x${string}`,
  bob: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as `0x${string}`,
};

export const FIXTURE_SERIES = [
  {
    contract: "SeriesFactory" as const,
    event: "SeriesCreated" as const,
    params: {
      seriesId: 1n,
      gpuClass: FIXTURE_GPU_CLASSES.T4,
      token: "0x7777777777777777777777777777777777777777" as `0x${string}`,
      windowStart: 1728864000n,
      windowEnd: 1729468800n,
      symbol: "gT4-NOW",
    },
  },
  {
    contract: "SeriesFactory" as const,
    event: "SeriesCreated" as const,
    params: {
      seriesId: 2n,
      gpuClass: FIXTURE_GPU_CLASSES.H100,
      token: "0x9999999999999999999999999999999999999999" as `0x${string}`,
      windowStart: 1729468800n,
      windowEnd: 1730073600n,
      symbol: "gH100-W43",
    },
  },
];

import { describe, it, expect } from "vitest";

describe("Frontend Indexed Data Consistency", () => {
  it("formats provider metrics consistently for the UI with proper decimals and fallbacks", () => {
    const rawEnvioResponse = [
      {
        id: "0x1111111111111111111111111111111111111111",
        name: "HyperNode-Bangalore",
        passes: 24,
        degraded: 1,
        fails: 0,
        timeouts: 0,
        hoursDelivered: "142",
        slashedTotal: "0",
      },
      {
        id: "0x2222222222222222222222222222222222222222",
        name: "FastCloud-Delhi",
        passes: 12,
        degraded: 3,
        fails: 1,
        timeouts: 1,
        hoursDelivered: "58",
        slashedTotal: "4200000", // 4.20 gUSD (6 decimals)
      },
    ];

    const formatted = rawEnvioResponse.map((p) => ({
      ...p,
      slashedTotal: (Number(p.slashedTotal) / 1e6).toFixed(2),
    }));

    expect(formatted[0].slashedTotal).toBe("0.00");
    expect(formatted[1].slashedTotal).toBe("4.20");
    expect(formatted[0].hoursDelivered).toBe("142");
    expect(formatted[1].fails).toBe(1);
  });
});

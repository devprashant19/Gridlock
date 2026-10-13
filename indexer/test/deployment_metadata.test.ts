import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import yaml from "yaml";

describe("Envio Deployment Metadata & ABI Verification", () => {
  it("verifies config.yaml aligns exactly with deployments/testnet.json and compiled ABIs", () => {
    const configPath = path.resolve(__dirname, "../config.yaml");
    const testnetPath = path.resolve(__dirname, "../../deployments/testnet.json");

    const configFile = fs.readFileSync(configPath, "utf-8");
    const config = yaml.parse(configFile);

    const testnetJson = JSON.parse(fs.readFileSync(testnetPath, "utf-8"));

    // 1. Verify Chain ID
    expect(config.chains[0].id).toBe(testnetJson.chainId);
    expect(config.chains[0].id).toBe(10143);

    // 2. Verify Contract Addresses in config match testnet.json
    const contracts = config.chains[0].contracts;
    const contractMap = new Map(contracts.map((c: any) => [c.name, c.address.toLowerCase()]));

    expect(contractMap.get("DeliveryEscrow")).toBe(testnetJson.contracts.DeliveryEscrow.toLowerCase());
    expect(contractMap.get("SeriesFactory")).toBe(testnetJson.contracts.SeriesFactory.toLowerCase());
    expect(contractMap.get("IndexOracle")).toBe(testnetJson.contracts.IndexOracle.toLowerCase());

    // 3. Verify Events match ABIs
    for (const c of contracts) {
      const abiPath = path.resolve(__dirname, `../../abis/${c.name}.json`);
      expect(fs.existsSync(abiPath)).toBe(true);

      const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
      const abiEventNames = new Set(abi.filter((x: any) => x.type === "event").map((x: any) => x.name));

      for (const ev of c.events) {
        const evName = ev.event.split("(")[0];
        expect(abiEventNames.has(evName)).toBe(true);
      }
    }
  });
});

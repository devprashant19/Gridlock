"use client";

import React, { useState } from "react";
import { DEPLOYMENTS } from "../lib/contracts";

export default function HomePage() {
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState("");

  const handleFaucet = async () => {
    setFaucetLoading(true);
    setFaucetMsg("Requesting 1,000 gUSD faucet...");
    setTimeout(() => {
      setFaucetLoading(false);
      setFaucetMsg("Success: 1,000 gUSD minted to your active wallet!");
    }, 1200);
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-gradient-to-r from-grid-800 to-grid-700/60 p-8 rounded-2xl border border-grid-700 relative overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-grid-monad/20 text-grid-monad border border-grid-monad/30">
            <span>Live on Monad Testnet</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Physically Delivered GPU Forwards
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed">
            Lock compute costs before price spikes. Providers mint against a 120% bond.
            If GPU verification fails in the pod, the bond is automatically slashed to you in a single block.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <a
              href="/market/gT4-NOW"
              className="px-6 py-3 rounded-xl bg-grid-monad text-black font-semibold hover:opacity-95 transition shadow-lg shadow-grid-monad/20"
            >
              Trade on Kuru Order Book &rarr;
            </a>
            <button
              onClick={handleFaucet}
              disabled={faucetLoading}
              className="px-6 py-3 rounded-xl bg-grid-700 text-white font-medium hover:bg-grid-600 border border-gray-600 transition"
            >
              {faucetLoading ? "Minting..." : "Claim 1,000 gUSD Faucet"}
            </button>
          </div>
          {faucetMsg && <p className="text-xs text-grid-pass mt-2">{faucetMsg}</p>}
        </div>
      </div>

      {/* Demo Warning Banner */}
      <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/60 flex items-center justify-between text-sm">
        <div className="flex items-center space-x-3 text-purple-200">
          <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-purple-800 text-white">Demo Mode</span>
          <span><strong className="text-white">gT4-NOW</strong> series uses fixed $0.35/hr reference price for instant live verification in free Colab T4 pods.</span>
        </div>
      </div>

      {/* Forward Curve Table */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Active Forward Curve</h2>
        <div className="overflow-x-auto rounded-xl border border-grid-700 bg-grid-800/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-grid-800 text-gray-400 text-xs uppercase border-b border-grid-700">
              <tr>
                <th className="p-4">Series Symbol</th>
                <th className="p-4">GPU Class</th>
                <th className="p-4">Delivery Window</th>
                <th className="p-4">Spot Index</th>
                <th className="p-4">Bond Req.</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-700">
              {Object.entries(DEPLOYMENTS.series).map(([symbol, item]) => (
                <tr key={symbol} className="hover:bg-grid-700/40 transition">
                  <td className="p-4 font-semibold text-white">{symbol}</td>
                  <td className="p-4 text-gray-300">
                    {symbol.includes("T4") ? "Tesla T4 (FP16 8.1 TF)" : symbol.includes("H100") ? "H100 SXM (FP16 989 TF)" : "A100 SXM4 (FP16 312 TF)"}
                  </td>
                  <td className="p-4 text-gray-400">
                    {new Date(item.windowStart * 1000).toLocaleDateString()} &ndash; {new Date(item.windowEnd * 1000).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-white font-mono">
                    {symbol.includes("T4") ? "$0.35 / hr" : symbol.includes("H100") ? "$2.65 / hr" : "$1.80 / hr"}
                  </td>
                  <td className="p-4 text-grid-monad font-medium">120% gUSD</td>
                  <td className="p-4 text-right">
                    <a
                      href={`/market/${symbol}`}
                      className="inline-block px-4 py-1.5 rounded-lg bg-grid-700 hover:bg-grid-600 text-xs font-semibold text-white border border-gray-600 transition"
                    >
                      Trade &rarr;
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

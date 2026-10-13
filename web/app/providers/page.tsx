"use client";

import React, { useEffect, useState } from "react";
import { fetchProviderLeaderboard, ProviderRecord } from "../../lib/envio";

const FALLBACK_PROVIDERS = [
  { name: "HyperNode-Bangalore", passes: 24, degraded: 1, fails: 0, slashedTotal: "0.00", hoursDelivered: "142" },
  { name: "MonadGPU-Alpha", passes: 19, degraded: 0, fails: 0, slashedTotal: "0.00", hoursDelivered: "96" },
  { name: "FastCloud-Delhi", passes: 12, degraded: 3, fails: 1, slashedTotal: "4.20", hoursDelivered: "58" },
  { name: "Rogue-Compute", passes: 2, degraded: 1, fails: 4, slashedTotal: "16.80", hoursDelivered: "14" },
];

export default function ProvidersLeaderboardPage() {
  const [providers, setProviders] = useState(FALLBACK_PROVIDERS);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await fetchProviderLeaderboard();
      if (data && data.length > 0) {
        setProviders(data);
        setIsLive(true);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Provider Reputation Leaderboard</h1>
          <p className="text-gray-400 text-sm">Indexed in real-time by Envio from DeliveryEscrow events on Monad</p>
        </div>
        {isLive && (
          <span className="px-3 py-1 bg-grid-pass/20 text-grid-pass text-xs font-semibold rounded-full border border-grid-pass/30 animate-pulse">
            Live Envio GraphQL
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-grid-700 bg-grid-800/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-grid-800 text-gray-400 text-xs uppercase border-b border-grid-700">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Provider</th>
              <th className="p-4 text-center">Passes</th>
              <th className="p-4 text-center">Degraded</th>
              <th className="p-4 text-center">Fails</th>
              <th className="p-4 text-right">Hours Delivered</th>
              <th className="p-4 text-right">Total Slashed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grid-700">
            {providers.map((p, idx) => (
              <tr key={p.name} className="hover:bg-grid-700/40 transition">
                <td className="p-4 font-bold text-gray-400">#{idx + 1}</td>
                <td className="p-4 font-semibold text-white">{p.name}</td>
                <td className="p-4 text-center text-grid-pass font-bold">{p.passes}</td>
                <td className="p-4 text-center text-grid-degraded font-bold">{p.degraded}</td>
                <td className="p-4 text-center text-grid-fail font-bold">{p.fails}</td>
                <td className="p-4 text-right font-mono text-gray-300">{p.hoursDelivered} hrs</td>
                <td className="p-4 text-right font-mono text-grid-fail font-semibold">{p.slashedTotal} gUSD</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

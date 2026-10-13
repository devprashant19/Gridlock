"use client";

import React, { useState } from "react";
import { DEPLOYMENTS } from "../../lib/contracts";

export default function ProviderPage() {
  const [hoursToMint, setHoursToMint] = useState(10);
  const [selectedSeries, setSelectedSeries] = useState("gT4-NOW");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Provider Console</h1>
        <p className="text-gray-400 text-sm">Register, mint GPU forwards against 120% bond, and provision machine access</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Minting */}
        <div className="bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Mint GPU Hours (120% Bond)</h2>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-gray-400 block mb-1">Series</label>
              <select
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value)}
                className="w-full bg-grid-900 border border-grid-700 rounded-lg p-2.5 text-white"
              >
                {Object.keys(DEPLOYMENTS.series).map((sym) => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Hours to Mint</label>
              <input
                type="number"
                value={hoursToMint}
                onChange={(e) => setHoursToMint(Number(e.target.value))}
                min={1}
                className="w-full bg-grid-900 border border-grid-700 rounded-lg p-2.5 text-white"
              />
            </div>
            <div className="p-3 rounded-lg bg-grid-900 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Index Price:</span>
                <span className="font-mono">$0.35 / hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Required Bond (120%):</span>
                <span className="font-mono text-grid-monad font-bold">
                  {(hoursToMint * 0.35 * 1.2).toFixed(2)} gUSD
                </span>
              </div>
            </div>
            <button className="w-full py-3 rounded-lg bg-grid-monad text-black font-bold hover:opacity-95 transition">
              Deposit Bond & Mint HourTokens
            </button>
          </div>
        </div>

        {/* Pending Provisioning */}
        <div className="bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Provision Assigned Deliveries</h2>
          <div className="space-y-3 text-sm">
            <div className="p-4 rounded-lg bg-grid-900 border border-grid-700 space-y-2">
              <div className="flex justify-between font-bold">
                <span>Delivery #1 (gT4-NOW)</span>
                <span className="text-grid-degraded text-xs">Awaiting Provisioning</span>
              </div>
              <p className="text-xs text-gray-400">Buyer requested 1 hour. Provision credentials within 2h or bond is slashed.</p>
              <div>
                <label className="text-xs text-gray-400 block mb-1">SSH Credentials (JSON)</label>
                <textarea
                  rows={3}
                  placeholder='{"host":"1.2.3.4","port":22,"username":"root","authType":"ssh-key","keyOrPassword":"..."}'
                  className="w-full font-mono text-xs bg-grid-800 border border-grid-700 rounded p-2 text-white"
                />
              </div>
              <button className="w-full py-2 rounded bg-grid-monad text-black text-xs font-bold hover:opacity-90">
                Encrypt with Buyer PRF Key & Post Onchain
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

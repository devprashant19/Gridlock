"use client";

import React, { useState } from "react";
import { DEPLOYMENTS } from "../../lib/contracts";

export default function HoursPage() {
  const [redeemSeries, setRedeemSeries] = useState("gT4-NOW");
  const [redeemHours, setRedeemHours] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Compute Hours & Redemptions</h1>
        <p className="text-gray-400 text-sm">Redeem HourTokens for physical GPU machine access credentials</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token balances */}
        <div className="bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Your HourTokens</h2>
          <div className="divide-y divide-grid-700">
            {Object.keys(DEPLOYMENTS.series).map((symbol) => (
              <div key={symbol} className="py-3 flex justify-between items-center text-sm">
                <span className="font-semibold">{symbol}</span>
                <span className="font-mono text-gray-300">5.00 Hours</span>
              </div>
            ))}
          </div>
        </div>

        {/* Redeem form */}
        <div className="bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Redeem for Physical Pod</h2>
          <p className="text-xs text-gray-400">
            Redeeming uses your Mera passkey PRF to derive a confidential X25519 public key.
            Only the assigned provider can encrypt credentials to it, and only your passkey can decrypt them.
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-gray-400 block mb-1">Select Series</label>
              <select
                value={redeemSeries}
                onChange={(e) => setRedeemSeries(e.target.value)}
                className="w-full bg-grid-900 border border-grid-700 rounded-lg p-2.5 text-white"
              >
                {Object.keys(DEPLOYMENTS.series).map((sym) => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Hours to Redeem</label>
              <input
                type="number"
                value={redeemHours}
                onChange={(e) => setRedeemHours(Number(e.target.value))}
                min={1}
                className="w-full bg-grid-900 border border-grid-700 rounded-lg p-2.5 text-white"
              />
            </div>
            <button
              onClick={() => setSubmitted(true)}
              className="w-full py-3 rounded-lg bg-grid-monad text-black font-bold hover:opacity-95 transition"
            >
              Redeem & Generate Delivery
            </button>
            {submitted && (
              <div className="p-3 rounded-lg bg-grid-pass/10 border border-grid-pass/30 text-grid-pass text-xs">
                Delivery #1 created! Assigned provider has 2 hours to provision. Go to <a href="/delivery/1" className="underline font-bold">Delivery #1</a>.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

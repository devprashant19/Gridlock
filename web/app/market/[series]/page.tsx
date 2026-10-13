"use client";

import React, { use } from "react";
import { DEPLOYMENTS } from "../../../lib/contracts";

export default function MarketPage({ params }: { params: Promise<{ series: string }> }) {
  const { series } = use(params);
  const seriesInfo = DEPLOYMENTS.series[series as keyof typeof DEPLOYMENTS.series];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{series}</h1>
          <p className="text-gray-400 text-sm">Kuru Order Book &bull; Physically Delivered Forward</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Market Contract</div>
          <div className="font-mono text-xs text-grid-monad">{seriesInfo?.kuruMarket || "Not deployed"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Book Column */}
        <div className="lg:col-span-2 bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Kuru Level-2 Order Book</h2>
          <div className="space-y-2">
            <div className="text-xs uppercase text-gray-400 grid grid-cols-3 py-1 border-b border-grid-700">
              <span>Price (gUSD)</span>
              <span className="text-right">Size (Hours)</span>
              <span className="text-right">Total (gUSD)</span>
            </div>
            {/* Mock Asks */}
            <div className="space-y-1 text-sm font-mono text-red-400">
              <div className="grid grid-cols-3 hover:bg-red-950/20 px-1 py-0.5 rounded">
                <span>0.380</span>
                <span className="text-right">10</span>
                <span className="text-right">3.80</span>
              </div>
              <div className="grid grid-cols-3 hover:bg-red-950/20 px-1 py-0.5 rounded">
                <span>0.365</span>
                <span className="text-right">5</span>
                <span className="text-right">1.82</span>
              </div>
            </div>
            <div className="py-2 border-y border-grid-700 text-center font-bold text-white font-mono">
              Last Price: 0.355 gUSD
            </div>
            {/* Mock Bids */}
            <div className="space-y-1 text-sm font-mono text-green-400">
              <div className="grid grid-cols-3 hover:bg-green-950/20 px-1 py-0.5 rounded">
                <span>0.350</span>
                <span className="text-right">8</span>
                <span className="text-right">2.80</span>
              </div>
              <div className="grid grid-cols-3 hover:bg-green-950/20 px-1 py-0.5 rounded">
                <span>0.340</span>
                <span className="text-right">15</span>
                <span className="text-right">5.10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trade Form Column */}
        <div className="bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold">Place Order</h2>
          <div className="flex rounded-lg bg-grid-900 p-1 text-sm">
            <button className="flex-1 py-1.5 font-semibold rounded bg-grid-monad text-black">Buy (IOC)</button>
            <button className="flex-1 py-1.5 font-semibold text-gray-400 hover:text-white">Sell (GTC)</button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-gray-400 block mb-1">Hours</label>
              <input
                type="number"
                defaultValue={1}
                className="w-full bg-grid-900 border border-grid-700 rounded-lg p-2.5 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Max Price (gUSD)</label>
              <input
                type="number"
                defaultValue={0.38}
                className="w-full bg-grid-900 border border-grid-700 rounded-lg p-2.5 text-white"
              />
            </div>
            <button className="w-full py-3 rounded-lg bg-grid-monad text-black font-bold hover:opacity-95 transition">
              Buy {series} Hours
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { use, useState } from "react";

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [decrypted, setDecrypted] = useState(false);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Delivery #{id}</h1>
          <p className="text-gray-400 text-sm">Series: gT4-NOW &bull; Allocated: 1 GPU-Hour</p>
        </div>
        <div className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-grid-pass/20 text-grid-pass border border-grid-pass/30">
          Provisioned
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-bold">Delivery Lifecycle</h2>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-3 rounded-lg bg-grid-900 border border-grid-monad text-grid-monad font-semibold">
            1. Requested
          </div>
          <div className="p-3 rounded-lg bg-grid-900 border border-grid-monad text-grid-monad font-semibold">
            2. Provisioned
          </div>
          <div className="p-3 rounded-lg bg-grid-900 border border-grid-700 text-gray-500 font-medium">
            3. Settled / Slashed
          </div>
        </div>
      </div>

      {/* Decrypt Credentials */}
      <div className="bg-grid-800 border border-grid-700 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-bold">Pod Access Credentials</h2>
        <p className="text-xs text-gray-400">
          Ciphertext posted onchain by provider. Decrypted locally in browser using your Mera Passkey PRF seed.
        </p>

        {!decrypted ? (
          <button
            onClick={() => setDecrypted(true)}
            className="w-full py-3 rounded-lg bg-grid-monad text-black font-bold hover:opacity-95 transition"
          >
            Decrypt Credentials with Passkey
          </button>
        ) : (
          <div className="space-y-3 font-mono text-xs bg-grid-900 p-4 rounded-lg border border-grid-700">
            <div><span className="text-gray-500">Host:</span> 34.125.82.10</div>
            <div><span className="text-gray-500">Port:</span> 22</div>
            <div><span className="text-gray-500">User:</span> root</div>
            <div><span className="text-gray-500">SSH Command:</span> ssh -p 22 root@34.125.82.10</div>
            <div className="pt-2">
              <span className="text-gray-500 block mb-1">In-Pod Verification Command:</span>
              <div className="bg-grid-800 p-2 rounded text-grid-monad select-all">
                gridlock-verify --api https://verifier.gridlock.network --delivery {id} --class T4
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

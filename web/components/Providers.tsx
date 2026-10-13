"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/lib/toast";
import { WalletProvider } from "@/lib/wallet/WalletProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WalletProvider>{children}</WalletProvider>
    </ToastProvider>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Gridlock | Physically Delivered GPU Forwards on Monad",
  description: "Institutional compute forwards exchange. Mint, trade, redeem and verify physically delivered GPU-hour forwards on Monad with 1-block bond slashing.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#06080D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-obsidian bg-cyber-grid text-white min-h-screen flex flex-col font-sans antialiased selection:bg-grid-monad selection:text-black">
        <Providers>
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
            {children}
          </main>
          <footer className="border-t border-white/[0.08] bg-obsidian/80 backdrop-blur-md py-6 px-4 text-center text-xs text-gray-500 font-mono">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-grid-monad animate-pulse" />
                <span className="text-gray-400 font-bold">GRIDLOCK PROTOCOL</span>
                <span>— Physically Delivered GPU Forwards</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-gray-500">
                <span>Monad (10143)</span>
                <span>·</span>
                <span>Kuru DEX</span>
                <span>·</span>
                <span>Mera PRF</span>
                <span>·</span>
                <span>Chainlink CRE</span>
                <span>·</span>
                <span>Envio</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Gridlock | Physically Delivered GPU Forwards on Monad",
  description:
    "Institutional compute forwards exchange. Mint, trade, redeem and verify physically delivered GPU-hour forwards on Monad with 1-block bond slashing.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#FEF08A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#FFFDF7] text-black min-h-screen flex flex-col font-sans antialiased selection:bg-neo-yellow selection:text-black">
        <Providers>
          <Header />
          <main className="flex-1 w-full pb-16">
            {children}
          </main>
          <footer className="border-t-2 border-black bg-black text-white py-10 px-4">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-neo-yellow text-black font-black flex items-center justify-center border border-black">
                  G
                </div>
                <span className="font-bold tracking-wider text-sm">GRIDLOCK PROTOCOL</span>
                <span className="text-gray-400">— Physically Delivered GPU Forwards</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400 font-bold uppercase">
                <span>Monad (10143)</span>
                <span>•</span>
                <span>Kuru DEX</span>
                <span>•</span>
                <span>Mera PRF</span>
                <span>•</span>
                <span>Chainlink CRE</span>
                <span>•</span>
                <span>Envio HyperIndex</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

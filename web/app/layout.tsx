import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gridlock | Physically Delivered GPU Forwards on Monad",
  description: "Mint, trade, redeem and verify physically delivered GPU-hour forwards on Monad",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-grid-900 text-white min-h-screen flex flex-col">
        <header className="border-b border-grid-700 bg-grid-800/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center space-x-6">
            <a href="/" className="flex items-center space-x-2 font-bold text-xl tracking-tight text-white">
              <span className="w-8 h-8 rounded-lg bg-grid-monad flex items-center justify-center font-black text-black">G</span>
              <span>GRIDLOCK</span>
            </a>
            <nav className="hidden md:flex space-x-6 text-sm text-gray-300">
              <a href="/" className="hover:text-white transition">Forward Curve</a>
              <a href="/market/gT4-NOW" className="hover:text-white transition">Trade</a>
              <a href="/hours" className="hover:text-white transition">My Hours & Delivery</a>
              <a href="/provider" className="hover:text-white transition">Provider Console</a>
              <a href="/providers" className="hover:text-white transition">Leaderboard</a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-xs px-2.5 py-1 rounded-full bg-grid-monad/20 text-grid-monad border border-grid-monad/40">
              Monad Testnet (10143)
            </div>
            <button id="mera-login-btn" className="px-4 py-2 text-sm font-semibold rounded-lg bg-grid-monad text-black hover:opacity-90 transition">
              Passkey Sign In
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6">
          {children}
        </main>

        <footer className="border-t border-grid-700 p-6 text-center text-xs text-gray-500">
          Gridlock &copy; 2026 &bull; Physically Delivered GPU Forwards &bull; Powered by Monad, Kuru, Mera & Chainlink CRE
        </footer>
      </body>
    </html>
  );
}

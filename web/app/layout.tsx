import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Gridlock | Physically delivered GPU forwards on Monad",
  description: "Mint, trade, redeem and verify physically delivered GPU-hour forwards on Monad",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = { themeColor: "#0b0e14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-grid-900 text-white min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">{children}</main>
          <footer className="border-t border-grid-700 p-6 text-center text-xs text-gray-500">
            Gridlock · Physically delivered GPU forwards · Monad · Kuru · Mera · Chainlink CRE · Envio
          </footer>
        </Providers>
      </body>
    </html>
  );
}

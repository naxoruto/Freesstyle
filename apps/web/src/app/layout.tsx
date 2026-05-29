import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Freestyle Battle Arena",
  description: "Plataforma de batallas de freestyle con jueces y palabras aleatorias",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a0a1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-arena-950">
        <header className="border-b border-red-900/30 bg-arena-900/50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎤</span>
              <span className="text-xl font-battle text-red-500 tracking-wider">
                FREESTYLE ARENA
              </span>
            </a>
            <nav className="flex items-center gap-4 text-sm text-gray-400">
              <a href="/" className="hover:text-white transition">Inicio</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

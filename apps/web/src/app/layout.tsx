import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Freestyle Arena",
  description: "Plataforma de batallas de freestyle con jueces y palabras aleatorias",
  manifest: "/manifest.json",
  icons: {
    icon: "/brand/fa-symbol.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#050509",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen" style={{ background: "#050509" }}>
        <div className="broadcast-bar" />
        <header className="border-b border-white/5 bg-black/40 backdrop-blur-sm">
          <div className="w-full px-4 sm:px-8 lg:px-10 py-3 flex items-center justify-between">
            <a href="/" className="brand-wordmark" aria-label="Freestyle Arena">
              <Image src="/brand/fa-wordmark.svg" alt="" width={170} height={50} priority />
            </a>
            <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-white/30">
              <a href="/" className="hover:text-white transition">Inicio</a>
              <a href="/juegos/freestyler" className="hover:text-white transition">Jugar</a>
              <a href="/tournament" className="hover:text-white transition">Torneos</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

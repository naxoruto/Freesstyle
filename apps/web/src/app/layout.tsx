import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Freestyle Battle Arena",
  description: "Plataforma de batallas de freestyle con jueces y palabras aleatorias",
  manifest: "/manifest.json",
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
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <a href="/" className="font-battle font-black italic text-xl tracking-wide text-white uppercase">
              Freestyle<span style={{ color: "#e30613" }}> Arena</span>
            </a>
            <nav className="flex items-center gap-6 text-sm text-white/30">
              <a href="/" className="hover:text-white transition">Inicio</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

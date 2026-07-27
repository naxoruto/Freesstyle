"use client";

interface WordDisplayProps {
  word: string | null;
  category: string;
  isActive: boolean;
}

export function WordDisplay({ word, category, isActive }: WordDisplayProps) {
  if (!word) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/20">
        <p className="text-sm font-semibold tracking-[0.3em] uppercase">
          {isActive ? "Esperando palabra..." : "Batalla no iniciada"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {category && (
        <p
          className="text-xs font-semibold tracking-[0.4em] uppercase mb-3"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          Categoría · {category}
        </p>
      )}
      <h2
        className={`font-battle font-black italic uppercase leading-none transition-all duration-300 ${
          isActive ? "text-glow" : "opacity-60"
        }`}
        style={{
          fontSize: "clamp(72px, 14vw, 144px)",
          letterSpacing: "-0.02em",
          color: "white",
        }}
      >
        {word.toUpperCase()}
      </h2>
    </div>
  );
}

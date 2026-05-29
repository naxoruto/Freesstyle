"use client";

interface WordDisplayProps {
  word: string | null;
  category: string;
  isActive: boolean;
}

export function WordDisplay({ word, category, isActive }: WordDisplayProps) {
  return (
    <div className={`p-8 rounded-2xl border-2 text-center transition-all duration-500 ${
      isActive && word
        ? "border-red-500 animate-pulse-glow bg-red-500/5"
        : "border-gray-800 bg-arena-800/30"
    }`}>
      {word ? (
        <div className="animate-bounce-in">
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">
            {category}
          </p>
          <h2 className="text-5xl md:text-7xl font-battle text-white tracking-wider text-glow">
            {word.toUpperCase()}
          </h2>
        </div>
      ) : (
        <div className="text-gray-600">
          <span className="text-4xl block mb-3">🎤</span>
          <p className="text-lg">
            {isActive ? "Esperando palabra..." : "Batalla no iniciada"}
          </p>
        </div>
      )}
    </div>
  );
}

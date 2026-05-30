"use client";

interface TimerProps {
  seconds: number;
  total: number;
  isMyTurn: boolean;
}

export function Timer({ seconds, total, isMyTurn }: TimerProps) {
  const percentage = total > 0 ? (seconds / total) * 100 : 100;
  const isLow = seconds <= 10 && seconds > 0;
  const isCritical = seconds <= 5 && seconds > 0;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-sm mx-auto">
      {/* Big number */}
      <div
        className={`font-battle font-black tabular-nums leading-none transition-colors ${
          isCritical ? "animate-shake" : ""
        }`}
        style={{
          fontSize: 80,
          color: isCritical ? "#e30613" : isLow ? "#f59e0b" : "white",
        }}
      >
        {seconds}
      </div>

      {/* Thin progress bar */}
      <div className="w-full h-1 bg-white/5">
        <div
          className="h-full transition-all duration-1000"
          style={{
            width: `${percentage}%`,
            background: isCritical ? "#e30613" : isLow ? "#f59e0b" : "#e30613",
          }}
        />
      </div>

      <p
        className="text-xs font-semibold tracking-[0.3em] uppercase"
        style={{ color: "rgba(255,255,255,0.2)" }}
      >
        {seconds}s / {total}s
      </p>
    </div>
  );
}

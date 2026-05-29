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
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">⏱️ Tiempo</span>
        <span className={`font-mono font-bold ${
          isCritical ? "text-red-400 animate-pulse" :
          isLow ? "text-yellow-400" : "text-white"
        }`}>
          {seconds}s / {total}s
        </span>
      </div>
      <div className="h-3 bg-arena-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isCritical ? "bg-red-500" :
            isLow ? "bg-yellow-500" :
            "bg-green-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

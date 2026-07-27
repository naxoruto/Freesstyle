"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JudgePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alias = searchParams.get("alias") || "Juez";

  useEffect(() => {
    router.replace(`/battle/${params.id}?role=judge&alias=${encodeURIComponent(alias)}`);
  }, [alias, params.id, router]);

  return (
    <div className="min-h-[calc(100vh-57px)] flex items-center justify-center">
      <p className="text-gray-400">Redirigiendo a la arena...</p>
    </div>
  );
}

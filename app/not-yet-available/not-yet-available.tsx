// app/not-yet-available/not-yet-available-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function formatMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function NotYetAvailableClient() {
  const searchParams = useSearchParams();
  const until = searchParams.get("until"); // ISO string

  const untilMs = useMemo(() => {
    if (!until) return null;
    const t = Date.parse(until);
    return Number.isFinite(t) ? t : null;
  }, [until]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = untilMs ? untilMs - now : null;
  const isReady = remainingMs !== null && remainingMs <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Not yet available</h1>

        {!untilMs && (
          <p className="mt-2 text-sm opacity-80">
            This link isn’t available yet. No availability timestamp was provided.
          </p>
        )}

        {untilMs && !isReady && (
          <>
            <p className="mt-2 text-sm opacity-80">
              This link will unlock soon.
            </p>
            <div className="mt-4 text-3xl font-bold">
              {formatMs(remainingMs!)}
            </div>
            <p className="mt-2 text-xs opacity-70 break-all">
              Unlocks at: {new Date(untilMs).toLocaleString()}
            </p>
          </>
        )}

        {untilMs && isReady && (
          <p className="mt-2 text-sm opacity-80">
            It should be available now. Refresh the link.
          </p>
        )}
      </div>
    </div>
  );
}

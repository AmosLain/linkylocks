"use client";

import { useSearchParams } from "next/navigation";

export default function NotYetAvailablePage() {
  const sp = useSearchParams();
  const until = sp.get("until");

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">Not yet available</h1>
      <p className="mt-3 text-gray-600">
        This link is delayed. Please try again later.
      </p>

      {until && (
        <p className="mt-2 text-sm text-gray-500">
          Available at: <span className="font-mono">{until}</span>
        </p>
      )}
    </main>
  );
}

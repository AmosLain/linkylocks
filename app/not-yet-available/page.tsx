// app/not-yet-available/page.tsx
import { Suspense } from "react";
import NotYetAvailableClient from "./not-yet-available-client";

export const dynamic = "force-dynamic";

export default function NotYetAvailablePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <NotYetAvailableClient />
    </Suspense>
  );
}

import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto py-8 px-4">{children}</div>
    </div>
  );
}

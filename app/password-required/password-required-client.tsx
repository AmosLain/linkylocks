// app/password-required/password-required-client.tsx
"use client";

import { useState } from "react";

export default function PasswordRequiredClient({
  token,
  bad,
}: {
  token: string;
  bad: boolean;
}) {
  const [pw, setPw] = useState("");

  // Keep your current approach for now (query param) so MVP works.
  // Next step: replace with POST + HttpOnly cookie.
  const submitUrl = token ? `/l/${encodeURIComponent(token)}?pw=${encodeURIComponent(pw)}` : "#";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Password required</h1>

        {bad && (
          <p className="mt-2 text-sm text-red-600">
            Wrong password. Try again.
          </p>
        )}

        {!token && (
          <p className="mt-2 text-sm opacity-80">
            Missing token. Please open the link again.
          </p>
        )}

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!token) return;
            window.location.href = submitUrl;
          }}
        >
          <input
            className="w-full rounded-xl border px-3 py-2"
            type="password"
            placeholder="Enter password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={!token}
          />

          <button
            className="w-full rounded-xl border px-3 py-2 font-medium"
            type="submit"
            disabled={!token || !pw}
          >
            Unlock
          </button>
        </form>

        <p className="mt-4 text-xs opacity-70">
          Tip: next upgrade will make this secure with POST + HttpOnly cookie.
        </p>
      </div>
    </div>
  );
}

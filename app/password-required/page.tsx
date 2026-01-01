"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function PasswordRequiredPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = sp.get("token") || "";
  const bad = sp.get("bad") === "1";

  const [pw, setPw] = useState("");

  function submit() {
    if (!token) return;
    // send the password back to /l/[token] (simple MVP approach)
    router.replace(`/l/${token}?pw=${encodeURIComponent(pw)}`);
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">Password required</h1>
      <p className="mt-3 text-gray-600">Enter the password to open this link.</p>

      {bad && <p className="mt-2 text-sm text-red-600">Wrong password.</p>}

      <input
        className="mt-4 w-full rounded border px-3 py-2"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="Password"
      />

      <button
        onClick={submit}
        className="mt-4 w-full rounded bg-indigo-600 px-4 py-2 font-semibold text-white"
      >
        Continue
      </button>
    </main>
  );
}

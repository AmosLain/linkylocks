"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function toIsoOrNull(datetimeLocal: string): string | null {
  if (!datetimeLocal) return null;
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseMaxClicksOrNull(v: string): number | null {
  const raw = v.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const intN = Math.floor(n);
  if (intN < 1) return null;
  return intN;
}

function genToken(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function NewLinkPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [label, setLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    setErr(null);

    const url = targetUrl.trim();
    if (!url) return setErr("Please enter a target URL.");
    if (!/^https?:\/\//i.test(url)) return setErr("URL must start with http:// or https://");

    const maxClicksNum = parseMaxClicksOrNull(maxClicks);
    if (maxClicks.trim() !== "" && maxClicksNum === null) {
      return setErr("Max clicks must be a whole number (1 or more).");
    }

    const expiresIso = toIsoOrNull(expiresAtLocal);

    setLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not logged in.");

      let lastError: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const token = genToken(10);

        const { error: insErr } = await supabase.from("links").insert({
          user_id: userId,
          label: label.trim() || null,
          token,
          target_url: url,
          is_active: true,
          click_count: 0,
          max_clicks: maxClicksNum,
          expires_at: expiresIso,
        });

        if (!insErr) {
          router.push("/app/links");
          router.refresh();
          return;
        }
        lastError = insErr;
      }

      throw lastError ?? new Error("Failed to create link.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-600">New Link</h1>
        <a
          href="/app/links"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900"
        >
          ← Back
        </a>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. YouTube video, Landing page, etc."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">Target URL</label>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-800">Max clicks (optional)</label>
              <input
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
                placeholder="e.g. 2"
                inputMode="numeric"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty = unlimited</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-800">Expiry (optional)</label>
              <input
                type="datetime-local"
                value={expiresAtLocal}
                onChange={(e) => setExpiresAtLocal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty = never expires</p>
            </div>
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {err}
            </div>
          )}

          <button
            onClick={onCreate}
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Link"}
          </button>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function genToken(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeUrl(input: string) {
  const s = input.trim();
  return s;
}

function toIsoOrNull(datetimeLocal: string): string | null {
  // datetime-local is: "YYYY-MM-DDTHH:MM"
  if (!datetimeLocal || !datetimeLocal.trim()) return null;
  
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) return null;
  
  // Check if the date is in the past
  if (d.getTime() < Date.now()) {
    return null; // Return null for past dates
  }
  
  return d.toISOString();
}

function toIntOrNull(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1) return null;
  return i;
}

// Get current datetime in local format for min attribute
function getMinDateTime(): string {
  const now = new Date();
  // Format: YYYY-MM-DDTHH:MM
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function NewLinkPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [label, setLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  // Keep as STRING in state so empty stays empty (not 0)
  const [maxClicks, setMaxClicks] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    setErr(null);

    const url = normalizeUrl(targetUrl);
    if (!url) return setErr("Please enter a target URL.");
    if (!/^https?:\/\//i.test(url)) return setErr("URL must start with http:// or https://");

    // FORCE: if user typed something invalid, block the submit (no silent NULL)
    const maxClicksNum = toIntOrNull(maxClicks);
    if (maxClicks.trim() !== "" && maxClicksNum === null) {
      return setErr("Max clicks must be a whole number (1 or more).");
    }

    const expiresIso = toIsoOrNull(expiresAtLocal);
    // FORCE: if user typed a value but it couldn't parse, block submit
    if (expiresAtLocal.trim() !== "" && !expiresIso) {
      return setErr("Expiry date is invalid or in the past. Please choose a future date.");
    }

    setLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not logged in.");

      // Try a few times in case of token collision
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const token = genToken(10);

        // IMPORTANT: we ALWAYS send max_clicks + expires_at keys (never undefined)
        const payload = {
          user_id: userId,
          label: label.trim() || null,
          token,
          target_url: url,
          is_active: true,
          click_count: 0,
          max_clicks: maxClicksNum, // integer or null
          expires_at: expiresIso,   // iso or null
        };

        // Debug logging
        console.log("CREATE LINK payload:", payload);
        console.log("Current time:", new Date().toISOString());
        console.log("Expires at:", payload.expires_at);
        if (payload.expires_at) {
          const timeUntilExpiry = new Date(payload.expires_at).getTime() - Date.now();
          console.log("Time until expiry (hours):", (timeUntilExpiry / (1000 * 60 * 60)).toFixed(2));
        }

        const { error: insErr } = await supabase.from("links").insert(payload);
        if (!insErr) {
          console.log("Link created successfully with token:", token);
          router.push("/app/links");
          router.refresh();
          return;
        }

        console.error("Insert error:", insErr);
        lastErr = insErr;
      }

      throw lastErr ?? new Error("Failed to create link.");
    } catch (e: any) {
      console.error("Create link error:", e);
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
              placeholder="e.g. YouTube video, Landing page..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">Target URL</label>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-800">Max clicks (optional)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
                placeholder="e.g. 2"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20"
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty = unlimited</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-800">Expiry (optional)</label>
              <input
                type="datetime-local"
                value={expiresAtLocal}
                onChange={(e) => setExpiresAtLocal(e.target.value)}
                min={getMinDateTime()}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
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
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
  if (!datetimeLocal || !datetimeLocal.trim()) return null;
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() < Date.now()) return null;
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

function getMinDateTime(): string {
  const now = new Date();
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
  const [maxClicks, setMaxClicks] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  
  // NEW FEATURES
  const [isPhantom, setIsPhantom] = useState(false);
  const [password, setPassword] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [revealAtLocal, setRevealAtLocal] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    setErr(null);

    const url = normalizeUrl(targetUrl);
    if (!url) return setErr("Please enter a target URL.");
    if (!/^https?:\/\//i.test(url)) return setErr("URL must start with http:// or https://");

    // Validate max clicks
    const maxClicksNum = toIntOrNull(maxClicks);
    if (maxClicks.trim() !== "" && maxClicksNum === null) {
      return setErr("Max clicks must be a whole number (1 or more).");
    }

    // Validate expiry
    const expiresIso = toIsoOrNull(expiresAtLocal);
    if (expiresAtLocal.trim() !== "" && !expiresIso) {
      return setErr("Expiry date is invalid or in the past. Please choose a future date.");
    }

    // Validate reveal time
    const revealAtIso = toIsoOrNull(revealAtLocal);
    if (revealAtLocal.trim() !== "" && !revealAtIso) {
      return setErr("Reveal date is invalid or in the past. Please choose a future date.");
    }

    // Validate delay seconds
    const delaySecondsNum = toIntOrNull(delaySeconds);
    if (delaySeconds.trim() !== "" && delaySecondsNum === null) {
      return setErr("Delay must be a whole number (1 or more).");
    }

    // Validate phantom mode
    if (isPhantom && maxClicksNum && maxClicksNum !== 1) {
      return setErr("Phantom links must have max clicks set to 1 (or leave empty for auto-set).");
    }

    setLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not logged in.");

      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const token = genToken(10);

        const payload = {
          user_id: userId,
          label: label.trim() || null,
          token,
          target_url: url,
          is_active: true,
          click_count: 0,
          max_clicks: isPhantom ? 1 : maxClicksNum, // Force 1 for phantom
          expires_at: expiresIso,
          is_phantom: isPhantom,
          password: password.trim() || null,
          delay_seconds: delaySecondsNum,
          reveal_at: revealAtIso,
        };

        const { error: insErr } = await supabase.from("links").insert(payload);
        if (!insErr) {
          router.push("/app/links");
          router.refresh();
          return;
        }

        lastErr = insErr;
      }

      throw lastErr ?? new Error("Failed to create link.");
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
          {/* Basic Fields */}
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

          {/* Expiry Options */}
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
                disabled={isPhantom}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 disabled:bg-gray-100"
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

          {/* NEW: Phantom Mode */}
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPhantom}
                onChange={(e) => setIsPhantom(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="font-semibold text-purple-900">🔥 Phantom Link (Self-Destruct)</span>
                <p className="text-xs text-purple-700">Link automatically deletes after first use</p>
              </div>
            </label>
          </div>

          {/* NEW: Password Protection */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">🔒 Password Protection (optional)</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to protect this link"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20"
            />
            <p className="mt-1 text-xs text-gray-500">Visitors must enter this password to access the link</p>
          </div>

          {/* NEW: Delayed Reveal */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-3 font-semibold text-blue-900">⏱️ Delayed Reveal (choose one)</h3>
            
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-blue-800">Delay by seconds</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-blue-700">Link shows "unavailable" message for this many seconds</p>
              </div>

              <div className="text-center text-xs text-blue-700 font-semibold">OR</div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-blue-800">Reveal at specific time</label>
                <input
                  type="datetime-local"
                  value={revealAtLocal}
                  onChange={(e) => setRevealAtLocal(e.target.value)}
                  min={getMinDateTime()}
                  className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-blue-700">Link becomes available at this exact time</p>
              </div>
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
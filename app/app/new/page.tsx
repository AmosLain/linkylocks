"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function genToken(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeUrl(input: string) {
  return input.trim();
}

function toIsoOrNull(datetimeLocal: string): string | null {
  if (!datetimeLocal || !datetimeLocal.trim()) return null;
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function getMinDateTime() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function NewLinkPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [label, setLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [revealAtLocal, setRevealAtLocal] = useState("");
  const [isPhantom, setIsPhantom] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [upgradeHint, setUpgradeHint] = useState<string | null>(null);

  const [plan, setPlan] = useState<"free" | "pro">("free");

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return;

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profErr && alive) {
        setPlan(profile?.plan === "pro" ? "pro" : "free");
      }
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const maxClicksNum = useMemo(() => toIntOrNull(maxClicks), [maxClicks]);

  // UI paywall checks (DB still enforces)
  const paywallReason = useMemo(() => {
    if (plan !== "free") return null;
    if (isPhantom) return null; // phantom forces 1 click, always allowed

    // free plan: max clicks must be 1–3
    if (maxClicks.trim() === "") return null; // will default to 3
    if (maxClicksNum === null) return "Max clicks must be a whole number (1 or more).";
    if (maxClicksNum > 3) return "More than 3 clicks is a Pro feature.";
    return null;
  }, [plan, isPhantom, maxClicks, maxClicksNum]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setUpgradeHint(null);

    const url = normalizeUrl(targetUrl);
    if (!url) return setErr("Target URL is required.");
    if (!/^https?:\/\//i.test(url)) return setErr("URL must start with http:// or https://");

    // Hard-stop attempts that will violate RLS for free plan
    if (paywallReason) {
      setUpgradeHint(paywallReason);
      return;
    }

    if (maxClicks.trim() !== "" && maxClicksNum === null) {
      return setErr("Max clicks must be a whole number (1 or more).");
    }

    const expiresAtIso = toIsoOrNull(expiresAtLocal);
    if (expiresAtLocal.trim() !== "" && !expiresAtIso) {
      return setErr("Expiry date is invalid. Please choose a valid date/time.");
    }
    if (expiresAtIso) {
      const ts = new Date(expiresAtIso).getTime();
      if (Number.isNaN(ts) || ts <= Date.now()) return setErr("Expiry date must be in the future.");
    }

    const revealAtIso = toIsoOrNull(revealAtLocal);
    if (revealAtLocal.trim() !== "" && !revealAtIso) {
      return setErr("Reveal date is invalid. Please choose a valid date/time.");
    }
    if (revealAtIso) {
      const ts = new Date(revealAtIso).getTime();
      if (Number.isNaN(ts) || ts <= Date.now()) return setErr("Reveal date must be in the future.");
    }

    if (revealAtIso && expiresAtIso) {
      const r = new Date(revealAtIso).getTime();
      const x = new Date(expiresAtIso).getTime();
      if (r >= x) return setErr("Reveal time must be before expiry time.");
    }

    // Final enforcement consistent with RLS:
    // - phantom -> 1
    // - free -> default to 3 if empty; must be 1–3 if provided
    // - pro -> allow null (unlimited)
    const finalMaxClicks = isPhantom ? 1 : plan === "pro" ? maxClicksNum : maxClicksNum ?? 3;

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
          token,
          label: label.trim() || null,
          target_url: url,
          user_id: userId,
          is_active: true,
          is_phantom: isPhantom,
          max_clicks: finalMaxClicks,
          expires_at: expiresAtIso,
          reveal_at: revealAtIso,
        };

        const { error: insErr } = await supabase.from("links").insert(payload);

        if (!insErr) {
          router.push("/app/links");
          router.refresh();
          return;
        }

        // If RLS blocks it anyway, show a clean upsell message instead of scary error
        if (
          typeof insErr?.message === "string" &&
          insErr.message.toLowerCase().includes("row-level security")
        ) {
          setUpgradeHint("This rule is restricted on the Free plan. Upgrade to Pro to unlock it.");
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-indigo-600">New Link</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a link that expires by time, clicks, or both. (Plan:{" "}
            <span className="font-semibold">{plan}</span>)
          </p>
        </div>
        <a
          href="/app/links"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900"
        >
          ← Back
        </a>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={onCreate} className="space-y-4">
          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {upgradeHint && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              <div className="font-semibold">Pro feature</div>
              <div className="mt-1">{upgradeHint}</div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. My offer link"
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-800">Max Clicks (optional)</label>
              <input
                value={maxClicks}
                onChange={(e) => {
                  setMaxClicks(e.target.value);
                  setUpgradeHint(null);
                }}
                inputMode="numeric"
                placeholder={plan === "free" ? "1–3" : "Leave empty = unlimited"}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-gray-900 ${
                  paywallReason && plan === "free" ? "border-indigo-400" : "border-gray-300"
                }`}
              />
              <p className="mt-1 text-xs text-gray-500">
                {plan === "pro"
                  ? "Leave empty = unlimited clicks"
                  : "Free plan: 1–3 clicks. Leave empty defaults to 3."}
              </p>
              {paywallReason && plan === "free" && (
                <p className="mt-1 text-xs font-semibold text-indigo-700">{paywallReason}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-800">Expiry (optional)</label>
              <input
                type="datetime-local"
                value={expiresAtLocal}
                onChange={(e) => setExpiresAtLocal(e.target.value)}
                min={getMinDateTime()}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty = never expires</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isPhantom}
                onChange={(e) => {
                  setIsPhantom(e.target.checked);
                  setUpgradeHint(null);
                }}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">Self-destruct link (1 click)</div>
                <div className="text-xs text-gray-500">Overrides max clicks to 1.</div>
              </div>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">Reveal At (optional)</label>
            <input
              type="datetime-local"
              value={revealAtLocal}
              onChange={(e) => setRevealAtLocal(e.target.value)}
              min={getMinDateTime()}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">Leave empty = available immediately</p>
          </div>

          <button
            type="submit"
            disabled={loading || (plan === "free" && !!paywallReason)}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Creating..." : plan === "free" && paywallReason ? "Upgrade required" : "Create Link"}
          </button>
        </form>
      </div>
    </main>
  );
}

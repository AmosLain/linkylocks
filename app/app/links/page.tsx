"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LinkRow = {
  id: string;
  token: string;
  target_url: string;
  is_active: boolean | null;
  expires_at: string | null;
  max_clicks: number | null;
  click_count: number | null;
  created_at?: string;
};

function statusOf(l: LinkRow) {
  if (l.is_active !== true) return { label: "Disabled", cls: "border-gray-200 bg-gray-50 text-gray-800" };

  const now = Date.now();
  if (l.expires_at) {
    const t = new Date(l.expires_at).getTime();
    if (Number.isFinite(t) && t <= now) return { label: "Expired", cls: "border-amber-200 bg-amber-50 text-amber-900" };
  }

  if (l.max_clicks != null) {
    const clicks = l.click_count ?? 0;
    if (clicks >= l.max_clicks) return { label: "Max reached", cls: "border-red-200 bg-red-50 text-red-900" };
  }

  return { label: "Active", cls: "border-green-200 bg-green-50 text-green-900" };
}

export default function LinksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<LinkRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const userId = u.user?.id;
      if (!userId) throw new Error("Not logged in.");

      const { data, error } = await supabase
        .from("links")
        .select("id,token,target_url,is_active,expires_at,max_clicks,click_count,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems((data as LinkRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load links.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    // ✅ realtime: refresh when link rows update (click_count changes)
    const channel = supabase
      .channel("links-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "links" },
        () => {
          load();
        }
      )
      .subscribe();

    // ✅ fallback polling (in case realtime isn’t enabled)
    const timer = setInterval(load, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your links</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900"
          >
            Refresh
          </button>
          <Link className="rounded-lg bg-black px-4 py-2 text-white" href="/app/new">
            New link
          </Link>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-gray-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-gray-600">No links yet. Create one.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((l) => {
            const st = statusOf(l);
            const shortPath = `/l/${l.token}`;
            const clicks = l.click_count ?? 0;

            return (
              <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${st.cls}`}>
                        {st.label}
                      </span>

                      <span className="text-sm text-gray-700">
                        clicks: <b>{clicks}</b>
                        {l.max_clicks != null ? ` / ${l.max_clicks}` : ""}
                      </span>

                      {l.expires_at && (
                        <span className="text-sm text-gray-600">
                          expires: {new Date(l.expires_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 break-all text-sm">
                      <span className="font-medium text-gray-900">Short:</span>{" "}
                      <a className="text-blue-600 underline" href={shortPath} target="_blank" rel="noreferrer">
                        {shortPath}
                      </a>
                    </div>

                    <div className="mt-1 break-all text-xs text-gray-500">
                      <span className="font-medium">Target:</span> {l.target_url}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`${window.location.origin}${shortPath}`);
                      }}
                    >
                      Copy
                    </button>

                    <a
                      className="rounded-lg bg-black px-3 py-2 text-sm text-white"
                      href={shortPath}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

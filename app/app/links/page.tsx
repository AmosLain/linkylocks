"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LinkRow = {
  id: string;
  token: string;
  target_url: string;
  label?: string | null;
  is_active: boolean | null;
  expires_at: string | null;
  max_clicks: number | null;
  click_count: number | null;
  created_at?: string | null;
};

function isExpired(expires_at: string | null) {
  if (!expires_at) return false;
  const t = new Date(expires_at).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

function statusOf(l: LinkRow) {
  if (l.is_active !== true) return { text: "Disabled", cls: "bg-gray-100 text-gray-800" };
  if (isExpired(l.expires_at)) return { text: "Expired", cls: "bg-amber-50 text-amber-900" };
  if (l.max_clicks != null && (l.click_count ?? 0) >= l.max_clicks)
    return { text: "Max reached", cls: "bg-red-50 text-red-900" };
  return { text: "Active", cls: "bg-green-50 text-green-900" };
}

export default function LinksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("links")
        .select("id,token,target_url,label,is_active,expires_at,max_clicks,click_count,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data as LinkRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load links");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-600">My Links</h1>

        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900"
          >
            Refresh
          </button>

          <a
            href="/app/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            ＋ New Link
          </a>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-700">
          <div className="col-span-5">Label</div>
          <div className="col-span-3">Short Link</div>
          <div className="col-span-2">Opens</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="px-6 py-6 text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-6 text-gray-600">No links yet.</div>
        ) : (
          rows.map((l) => {
            const clicks = l.click_count ?? 0;
            const max = l.max_clicks;
            const st = statusOf(l);
            const shortPath = `/l/${l.token}`;
            const fullShort = `${window.location.origin}${shortPath}`;

            return (
              <div key={l.id} className="grid grid-cols-12 gap-2 border-b border-gray-100 px-6 py-4">
                <div className="col-span-5">
                  <div className="font-semibold text-gray-900">{l.label?.trim() || "Untitled"}</div>
                  <div className="text-sm text-gray-500 break-all">{l.target_url}</div>
                </div>

                <div className="col-span-3 flex items-center">
                  <a
                    href={shortPath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-gray-900 hover:underline"
                  >
                    {shortPath}
                  </a>
                </div>

                <div className="col-span-2 flex items-center text-sm text-gray-900">
                  {max != null ? `${clicks} / ${max}` : `${clicks}`}
                </div>

                <div className="col-span-1 flex items-center">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${st.cls}`}>{st.text}</span>
                </div>

                <div className="col-span-1 flex items-center justify-end gap-3">
                  <button
                    className="text-gray-700 hover:text-black"
                    title="Copy"
                    onClick={async () => {
                      await navigator.clipboard.writeText(fullShort);
                    }}
                  >
                    ⧉
                  </button>

                  {/* <a> avoids Next prefetch */}
                  <a
                    href={shortPath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 hover:text-black"
                    title="Open"
                  >
                    ↗
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}

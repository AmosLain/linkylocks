"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LinkRow = {
  id: string;
  token: string;
  label: string | null;
  target_url: string;
  click_count: number | null;
  max_clicks: number | null;
  expires_at: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

function isExpired(expires_at: string | null) {
  if (!expires_at) return false;
  const t = new Date(expires_at).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

function statusOf(l: LinkRow) {
  const clicks = l.click_count ?? 0;

  if (l.is_active !== true) return { text: "Disabled", cls: "bg-gray-100 text-gray-800" };
  if (isExpired(l.expires_at)) return { text: "Expired", cls: "bg-amber-50 text-amber-900" };
  if (l.max_clicks != null && clicks >= l.max_clicks) return { text: "Max reached", cls: "bg-red-50 text-red-900" };
  return { text: "Active", cls: "bg-green-50 text-green-900" };
}

export default function LinksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [links, setLinks] = useState<LinkRow[]>([]);
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
        .select("id,token,label,target_url,click_count,max_clicks,expires_at,is_active,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLinks((data as LinkRow[]) ?? []);
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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-600">My Links v2.0</h1>

        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
          >
            Refresh
          </button>

          <a
            href="/app/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Add New Link
          </a>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-700">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Short</th>
              <th className="px-4 py-3">Clicks</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-gray-600" colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : links.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-600" colSpan={6}>
                  No links yet.
                </td>
              </tr>
            ) : (
              links.map((l) => {
                const clicks = l.click_count ?? 0;
                const max = l.max_clicks == null ? "∞" : String(l.max_clicks);
                const st = statusOf(l);

                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {l.label?.trim() || "—"}
                      <div className="text-xs font-normal text-gray-500 break-all">{l.target_url}</div>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-gray-900">
                      /l/{l.token}
                    </td>

                    <td className="px-4 py-3 text-gray-900">
                      {clicks} / {max}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700">
                      {l.expires_at ? new Date(l.expires_at).toLocaleString() : "No expiry"}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${st.cls}`}>
                        {st.text}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/l/${l.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LinkRow = {
  id?: string;
  token: string;
  target_url: string;
  label: string | null;
  is_active: boolean;
  click_count: number | null;
  max_clicks: number | null;
  expires_at: string | null;
  created_at?: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function statusOf(row: LinkRow) {
  if (row.is_active !== true) return "Inactive";

  const now = Date.now();

  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (!Number.isNaN(exp) && now >= exp) return "Expired";
  }

  const clicks = row.click_count ?? 0;
  if (row.max_clicks != null && clicks >= row.max_clicks) return "Max clicks reached";

  return "Active";
}

export default function MyLinksPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<LinkRow[]>([]);

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userRes.user?.id;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("links")
        .select("id,token,target_url,label,is_active,click_count,max_clicks,expires_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as LinkRow[]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load links.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-indigo-600">My Links</h1>
          <p className="text-gray-500 mt-1">All your short links, click counts, and expiry rules.</p>
        </div>

        <div className="flex gap-2">
          <a
            href="/app/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New Link
          </a>
          <button
            onClick={load}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-gray-600">
            You don’t have any links yet.{" "}
            <a className="text-indigo-600 underline" href="/app/new">
              Create your first link
            </a>
            .
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Label</th>
                  <th className="px-4 py-3 text-left font-medium">Short Link</th>
                  <th className="px-4 py-3 text-left font-medium">Clicks</th>
                  <th className="px-4 py-3 text-left font-medium">Expires</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const shortUrl = `${origin}/l/${r.token}`;
                  const st = statusOf(r);

                  return (
                    <tr key={r.id ?? r.token} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.label ?? "—"}</div>
                        <div className="text-xs text-gray-500">{r.created_at ? fmtDate(r.created_at) : ""}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/l/${r.token}`}
                            className="text-indigo-600 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            /l/{r.token}
                          </a>
                          {origin && (
                            <button
                              onClick={() => copy(shortUrl)}
                              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {r.click_count ?? 0}
                        {r.max_clicks != null ? (
                          <span className="text-gray-500"> / {r.max_clicks}</span>
                        ) : (
                          <span className="text-gray-500"> / ∞</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {r.expires_at ? fmtDate(r.expires_at) : <span className="text-gray-500">No expiry</span>}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            st === "Active"
                              ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"
                              : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-800"
                          }
                        >
                          {st}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <a
                          href={r.target_url}
                          className="text-gray-700 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

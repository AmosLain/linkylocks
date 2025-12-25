"use client";

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

function getStatus(l: LinkRow) {
  if (l.is_active !== true) {
    return { label: "Disabled", cls: "bg-gray-100 text-gray-800 border-gray-300" };
  }

  const now = Date.now();

  if (l.expires_at) {
    const t = new Date(l.expires_at).getTime();
    if (!Number.isNaN(t) && t <= now) {
      return { label: "Expired", cls: "bg-amber-50 text-amber-900 border-amber-300" };
    }
  }

  if (l.max_clicks != null) {
    const clicks = l.click_count ?? 0;
    if (clicks >= l.max_clicks) {
      return { label: "Max clicks reached", cls: "bg-red-50 text-red-900 border-red-300" };
    }
  }

  return { label: "Active", cls: "bg-green-50 text-green-900 border-green-300" };
}

export default function LinksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLinks() {
    setLoading(true);
    setError(null);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("links")
        .select("id, token, target_url, is_active, expires_at, max_clicks, click_count, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLinks((data as LinkRow[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load links");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLinks();

    // Poll every 5 seconds so click counts update
    const timer = setInterval(loadLinks, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your links</h1>

        <div className="flex gap-2">
          <button
            onClick={loadLinks}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900"
          >
            Refresh
          </button>

          <a
            href="/app/new"
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            New link
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-gray-600">No links yet.</p>
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const status = getStatus(l);
            const shortPath = `/l/${l.token}`;
            const clicks = l.click_count ?? 0;

            return (
              <div
                key={l.id}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${status.cls}`}
                      >
                        {status.label}
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
                      <span className="font-medium">Short:</span>{" "}
                      <a
                        href={shortPath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        {shortPath}
                      </a>
                    </div>

                    <div className="mt-1 break-all text-xs text-gray-500">
                      <span className="font-medium">Target:</span>{" "}
                      {l.target_url}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}${shortPath}`
                        );
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      Copy
                    </button>

                    {/* IMPORTANT: normal <a>, no Next prefetch */}
                    <a
                      href={shortPath}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-black px-3 py-2 text-sm text-white"
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

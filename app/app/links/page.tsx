"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LinkRow = {
  id: string;
  token: string;
  label: string | null;
  target_url: string;
  click_count: number | null;
  max_clicks: number | null;
  expires_at: string | null;
  is_active: boolean;
};

export default function LinksPage() {
  const supabase = createClient();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("links")
        .select(
          "id, token, label, target_url, click_count, max_clicks, expires_at, is_active"
        )
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (!error && data) setLinks(data);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-gray-600">Loading links…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-extrabold text-indigo-600">Your Links</h1>

      {links.length === 0 ? (
        <p className="text-gray-600">No links yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Short</th>
                <th className="px-4 py-3">Clicks</th>
                <th className="px-4 py-3">Limits</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {links.map((l) => {
                const clicks = l.click_count ?? 0;
                const max =
                  l.max_clicks === null ? "∞" : String(l.max_clicks);

                let expired = false;
                if (l.expires_at) {
                  expired = Date.now() >= new Date(l.expires_at).getTime();
                }
                if (
                  l.max_clicks !== null &&
                  clicks >= l.max_clicks
                ) {
                  expired = true;
                }

                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      {l.label || "—"}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs">
                      /l/{l.token}
                    </td>

                    <td className="px-4 py-3">
                      {clicks} / {max}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600">
                      {l.expires_at
                        ? new Date(l.expires_at).toLocaleString()
                        : "No expiry"}
                    </td>

                    <td className="px-4 py-3">
                      {expired || !l.is_active ? (
                        <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                          Expired
                        </span>
                      ) : (
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                          Active
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {/* ✅ CRITICAL PART: PLAIN <a>, NOT Next <Link> */}
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

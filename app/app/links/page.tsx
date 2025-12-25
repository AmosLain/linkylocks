"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Plus, ExternalLink, Trash2 } from "lucide-react";

type LinkRecord = {
  id: string;
  label: string | null;
  token: string;
  target_url: string;
  is_active: boolean;
  expires_at: string | null;
  max_opens: number | null;
  opens_count: number;
};

export default function LinksPage() {
  const supabase = createClient();
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLinks = async () => {
    const { data } = await supabase
      .from("links")
      .select("*")
      .order("created_at", { ascending: false });

    setLinks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleRevoke = async (id: string) => {
    await supabase.from("links").update({ is_active: false }).eq("id", id);
    loadLinks();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-indigo-700">My Links</h1>
        <Link
          href="/app/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Link
        </Link>
      </div>

      {links.length === 0 ? (
        <div className="bg-white p-10 rounded-xl shadow text-center">
          <p className="text-gray-700 mb-4">You haven't created any links yet.</p>
          <Link
            href="/app/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Create Your First Link
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-6">
          <table className="w-full">
            <thead className="border-b text-gray-600 text-sm">
              <tr>
                <th className="py-2 text-left">Label</th>
                <th className="py-2 text-left">Short Link</th>
                <th className="py-2 text-left">Opens</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>

            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-b last:border-none">
                  <td className="py-3">
                    <div className="font-medium">{link.label || "Untitled"}</div>
                    <div className="text-xs text-gray-500 truncate w-60">
                      {link.target_url}
                    </div>
                  </td>

                  <td className="py-3">
                    <Link
                      href={`/l/${link.token}`}
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      /l/{link.token}
                    </Link>
                  </td>

                  <td className="py-3 text-sm">
                    {link.opens_count}
                    {link.max_opens ? ` / ${link.max_opens}` : ""}
                  </td>

                  <td className="py-3">
                    {link.is_active ? (
                      <span className="px-2 py-1 text-xs bg-green-200 text-green-800 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-300 text-gray-800 rounded">
                        Disabled
                      </span>
                    )}
                  </td>

                  <td className="py-3 text-right space-x-3">
                    <Link
                      href={`/l/${link.token}`}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      <ExternalLink className="w-4 h-4 inline" />
                    </Link>

                    {link.is_active && (
                      <button
                        onClick={() => handleRevoke(link.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { nanoid } from "nanoid";

export default function NewLinkPage() {
  const router = useRouter();
  const supabase = createClient();

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [expiryType, setExpiryType] = useState<"none" | "time" | "opens">("none");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxOpens, setMaxOpens] = useState("");
  const [error, setError] = useState("");

  const createLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return setError("URL must start with http:// or https://");
    }

    const token = nanoid(10);

    // Get user_id
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return setError("Not logged in.");
    }

    const { error: insertError } = await supabase.from("links").insert({
      user_id: user.id,
      label,
      token,
      target_url: url,
      expires_at: expiryType === "time" ? expiresAt : null,
      max_opens: expiryType === "opens" ? parseInt(maxOpens) : null,
    });

    if (insertError) {
      return setError(insertError.message);
    }

    router.push("/app/links");
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-indigo-700 mb-6">Create New Link</h1>

      <form onSubmit={createLink} className="space-y-4">
        <div>
          <label className="block mb-1">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block mb-1">Target URL *</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium mb-2">Expiry Settings</label>

          <label className="block">
            <input
              type="radio"
              checked={expiryType === "none"}
              onChange={() => setExpiryType("none")}
            />
            <span className="ml-2">No expiry</span>
          </label>

          <label className="block mt-2">
            <input
              type="radio"
              checked={expiryType === "time"}
              onChange={() => setExpiryType("time")}
            />
            <span className="ml-2">Expire at date & time</span>
          </label>

          {expiryType === "time" && (
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full border p-2 rounded mt-2"
              required
            />
          )}

          <label className="block mt-2">
            <input
              type="radio"
              checked={expiryType === "opens"}
              onChange={() => setExpiryType("opens")}
            />
            <span className="ml-2">Expire after X opens</span>
          </label>

          {expiryType === "opens" && (
            <input
              type="number"
              min="1"
              value={maxOpens}
              onChange={(e) => setMaxOpens(e.target.value)}
              className="w-full border p-2 rounded mt-2"
              required
            />
          )}
        </div>

        {error && <p className="text-red-600">{error}</p>}

        <button
          type="submit"
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Create Link
        </button>
      </form>
    </div>
  );
}

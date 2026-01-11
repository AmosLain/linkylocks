import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function expired(req: Request) {
  return NextResponse.redirect(new URL("/expired", req.url), 307);
}

function isPrefetch(req: Request) {
  const h = req.headers;
  const purpose = (h.get("purpose") || "").toLowerCase();
  const secPurpose = (h.get("sec-purpose") || "").toLowerCase();
  const nextRouterPrefetch = h.get("next-router-prefetch");
  const middlewarePrefetch = h.get("x-middleware-prefetch");
  const fetchMode = (h.get("sec-fetch-mode") || "").toLowerCase();

  return (
    purpose === "prefetch" ||
    secPurpose === "prefetch" ||
    !!nextRouterPrefetch ||
    !!middlewarePrefetch ||
    fetchMode === "prefetch"
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> | { token: string } }
) {
  // ✅ Works in both Next behaviors (params object OR params Promise)
  const params = await Promise.resolve(ctx.params);
  const token = params?.token;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!token) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[linkylocks] Missing token param");
      }
      return expired(req);
    }

    if (!url || !serviceKey) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[linkylocks] Missing env vars", {
          hasUrl: !!url,
          hasServiceKey: !!serviceKey,
          token,
        });
      }
      return expired(req);
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: link, error: readErr } = await supabase
      .from("links")
      .select(
        "token,target_url,is_active,expires_at,max_clicks,click_count,created_at,reveal_at"
      )
      .eq("token", token)
      .maybeSingle();

    if (readErr || !link) return expired(req);
    if (link.is_active !== true) return expired(req);

    const now = Date.now();

    if (link.reveal_at) {
      const revealAt = new Date(link.reveal_at).getTime();
      if (!Number.isNaN(revealAt) && now < revealAt) return expired(req);
    }

    if (link.expires_at) {
      const expiresAt = new Date(link.expires_at).getTime();
      if (!Number.isNaN(expiresAt) && now >= expiresAt) return expired(req);
    }

    if (isPrefetch(req)) {
      if (!link.target_url) return expired(req);
      return NextResponse.redirect(link.target_url, 307);
    }

    const { data, error } = await supabase.rpc("resolve_link", { p_token: token });

    if (error || !data || data.length === 0) return expired(req);

    const row = data[0] as { ok: boolean; target_url: string | null };
    if (!row.ok || !row.target_url) return expired(req);

    return NextResponse.redirect(row.target_url, 307);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[linkylocks] Unexpected route error", e);
    }
    return expired(req);
  }
}

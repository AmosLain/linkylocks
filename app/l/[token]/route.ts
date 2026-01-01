import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

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
    fetchMode === "no-cors"
  );
}

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function expired(req: Request) {
  return NextResponse.redirect(new URL("/expired", req.url), 307);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey || !token) return expired(req);

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Read link row (needed for password/delay/reveal checks)
    const { data: link, error: readErr } = await supabase
      .from("links")
      .select(
        "token,target_url,is_active,expires_at,max_clicks,click_count,created_at,password,delay_seconds,reveal_at"
      )
      .eq("token", token)
      .maybeSingle<{
        token: string;
        target_url: string;
        is_active: boolean;
        expires_at: string | null;
        max_clicks: number | null;
        click_count: number | null;
        created_at: string | null;
        password: string | null; // we will store HASH here (see create page)
        delay_seconds: number | null;
        reveal_at: string | null;
      }>();

    if (readErr || !link) return expired(req);
    if (link.is_active !== true) return expired(req);

    const now = Date.now();

    // 2) Reveal at specific time (absolute)
    if (link.reveal_at) {
      const revealAt = new Date(link.reveal_at).getTime();
      if (!Number.isNaN(revealAt) && now < revealAt) {
        const u = new URL("/not-yet-available", req.url);
        u.searchParams.set("until", new Date(revealAt).toISOString());
        return NextResponse.redirect(u, 307);
      }
    }

    // 3) Delay by seconds (relative to created_at)
    if (link.delay_seconds != null && link.delay_seconds > 0 && link.created_at) {
      const created = new Date(link.created_at).getTime();
      const availableAt = created + link.delay_seconds * 1000;
      if (now < availableAt) {
        const u = new URL("/not-yet-available", req.url);
        u.searchParams.set("until", new Date(availableAt).toISOString());
        return NextResponse.redirect(u, 307);
      }
    }

    // 4) Password protection
    // We store HASH in `password` column (not plain text).
    if (link.password) {
      const reqUrl = new URL(req.url);
      const pw = reqUrl.searchParams.get("pw") || "";

      if (!pw) {
        const u = new URL("/password-required", req.url);
        u.searchParams.set("token", token);
        return NextResponse.redirect(u, 307);
      }

      if (sha256(pw) !== link.password) {
        const u = new URL("/password-required", req.url);
        u.searchParams.set("token", token);
        u.searchParams.set("bad", "1");
        return NextResponse.redirect(u, 307);
      }
    }

    // 5) Prefetch: don't count clicks (but you CAN redirect)
    if (isPrefetch(req)) {
      // still respect expiry/max_clicks checks for prefetch
      if (link.expires_at) {
        const exp = new Date(link.expires_at).getTime();
        if (Number.isFinite(exp) && now >= exp) return expired(req);
      }
      if (link.max_clicks != null && (link.click_count ?? 0) >= link.max_clicks) {
        return expired(req);
      }
      return NextResponse.redirect(link.target_url, 302);
    }

    // 6) Real click: atomic enforcement + increment
    const { data, error } = await supabase.rpc("resolve_link", { p_token: token });

    if (error || !data || data.length === 0) return expired(req);

    const row = data[0] as { ok: boolean; target_url: string | null };
    if (!row.ok || !row.target_url) return expired(req);

    return NextResponse.redirect(row.target_url, 307);
  } catch {
    return expired(req);
  }
}

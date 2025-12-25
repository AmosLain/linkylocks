// app/l/[token]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LinkRow = {
  token: string;
  target_url: string;
  is_active: boolean | null;
  expires_at: string | null;
  click_count: number | null;
  max_clicks?: number | null;
};

function isExpired(expires_at: string | null): boolean {
  if (!expires_at) return false;
  const t = new Date(expires_at).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

function reachedMaxClicks(max_clicks: number | null | undefined, click_count: number | null): boolean {
  if (max_clicks == null) return false;
  return (click_count ?? 0) >= max_clicks;
}

function expiredRedirect(req: Request) {
  return NextResponse.redirect(new URL("/expired", req.url));
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey || !token) return expiredRedirect(req);

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Fetch (tolerate schemas without max_clicks)
    let link: LinkRow | null = null;

    const first = await supabase
      .from("links")
      .select("token,target_url,is_active,expires_at,click_count,max_clicks")
      .eq("token", token)
      .maybeSingle<LinkRow>();

    if (first.error) {
      const msg = String(first.error.message || "").toLowerCase();
      if (msg.includes("max_clicks") && msg.includes("does not exist")) {
        const retry = await supabase
          .from("links")
          .select("token,target_url,is_active,expires_at,click_count")
          .eq("token", token)
          .maybeSingle<LinkRow>();
        if (retry.error) return expiredRedirect(req);
        link = retry.data ?? null;
      } else {
        return expiredRedirect(req);
      }
    } else {
      link = first.data ?? null;
    }

    if (!link) return expiredRedirect(req);

    const inactive = link.is_active !== true;
    const expired = isExpired(link.expires_at);
    const maxed = reachedMaxClicks(link.max_clicks, link.click_count);

    if (inactive || expired || maxed) return expiredRedirect(req);
    if (!link.target_url) return expiredRedirect(req);

    // ✅ Reliable increment via RPC (atomic)
    await supabase.rpc("increment_click_count", { p_token: token });

    return NextResponse.redirect(link.target_url, 302);
  } catch {
    return expiredRedirect(req);
  }
}

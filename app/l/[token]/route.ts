// app/l/[token]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LinkRow = {
  token: string;
  target_url: string;
  is_active: boolean | null;
  expires_at: string | null;
  max_clicks?: number | null;
  click_count: number | null;
};

function isExpired(expires_at: string | null): boolean {
  if (!expires_at) return false;
  const exp = new Date(expires_at).getTime();
  return Number.isFinite(exp) && exp <= Date.now();
}

function reachedMaxClicks(max_clicks: number | null | undefined, click_count: number | null): boolean {
  if (max_clicks == null) return false;
  return (click_count ?? 0) >= max_clicks;
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.redirect(new URL("/expired", req.url));
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Try selecting max_clicks; if column doesn't exist, retry without it
    let link: LinkRow | null = null;

    const attempt = await supabase
      .from("links")
      .select("token,target_url,is_active,expires_at,click_count,max_clicks")
      .eq("token", token)
      .maybeSingle<LinkRow>();

    if (attempt.error) {
      const msg = String(attempt.error.message || "").toLowerCase();
      if (msg.includes("max_clicks") && msg.includes("does not exist")) {
        const retry = await supabase
          .from("links")
          .select("token,target_url,is_active,expires_at,click_count")
          .eq("token", token)
          .maybeSingle<LinkRow>();
        if (retry.error) return NextResponse.redirect(new URL("/expired", req.url));
        link = retry.data ?? null;
      } else {
        return NextResponse.redirect(new URL("/expired", req.url));
      }
    } else {
      link = attempt.data ?? null;
    }

    if (!link) return NextResponse.redirect(new URL("/expired", req.url));

    const click_count = link.click_count ?? 0;
    const inactive = link.is_active === false || link.is_active == null;
    const expired = isExpired(link.expires_at);
    const maxed = reachedMaxClicks(link.max_clicks, click_count);

    if (inactive || expired || maxed) return NextResponse.redirect(new URL("/expired", req.url));

    // increment click count (best-effort)
    await supabase.from("links").update({ click_count: click_count + 1 }).eq("token", token);

    return NextResponse.redirect(link.target_url);
  } catch {
    return NextResponse.redirect(new URL("/expired", req.url));
  }
}

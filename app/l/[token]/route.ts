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

    // 🔥 Minimal sanity: service_role keys are long JWTs (usually 150+ chars) and start with eyJ
    if (!url || !serviceKey || serviceKey.length < 100 || !serviceKey.startsWith("eyJ")) {
      console.error("BAD_SUPABASE_SERVICE_ROLE_KEY", {
        hasUrl: !!url,
        keyLen: serviceKey?.length,
        keyStart: serviceKey ? serviceKey.slice(0, 8) : null,
      });
      return expiredRedirect(req);
    }

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
        if (retry.error) {
          console.error("FETCH_ERROR_RETRY", retry.error);
          return expiredRedirect(req);
        }
        link = retry.data ?? null;
      } else {
        console.error("FETCH_ERROR", first.error);
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

    // ✅ update click_count and LOG if it fails
    const nextCount = (link.click_count ?? 0) + 1;

    const upd = await supabase
      .from("links")
      .update({ click_count: nextCount })
      .eq("token", token);

    if (upd.error) {
      console.error("CLICK_COUNT_UPDATE_FAILED", upd.error);
      // Still redirect, but now you'll see the reason in Vercel logs
    }

    return NextResponse.redirect(link.target_url, 302);
  } catch (e) {
    console.error("ROUTE_CRASH", e);
    return expiredRedirect(req);
  }
}

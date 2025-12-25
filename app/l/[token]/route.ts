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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> } // IMPORTANT: params is a Promise in your setup
) {
  try {
    // ✅ Correct: await params
    const { token } = await ctx.params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("HIT /l/[token]", token);
    console.log("ENV CHECK", {
      url,
      serviceLen: serviceKey?.length,
      serviceStart: serviceKey ? serviceKey.slice(0, 10) : null, // safe snippet
    });

    if (!url || !serviceKey) {
      console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.redirect(new URL("/expired", req.url));
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // ✅ Select only columns that exist safely:
    // We'll request max_clicks but tolerate if it's not there by catching error.
    let link: LinkRow | null = null;

    const attempt = await supabase
      .from("links")
      .select("token,target_url,is_active,expires_at,click_count,max_clicks")
      .eq("token", token)
      .maybeSingle<LinkRow>();

    if (attempt.error) {
      // If max_clicks doesn't exist, retry without it
      const msg = String(attempt.error.message || "");
      console.error("Supabase fetch error (first attempt):", attempt.error);

      if (msg.toLowerCase().includes("max_clicks") && msg.toLowerCase().includes("does not exist")) {
        const retry = await supabase
          .from("links")
          .select("token,target_url,is_active,expires_at,click_count")
          .eq("token", token)
          .maybeSingle<LinkRow>();

        if (retry.error) {
          console.error("Supabase fetch error (retry):", retry.error);
          return NextResponse.redirect(new URL("/expired", req.url));
        }
        link = retry.data ?? null;
      } else {
        return NextResponse.redirect(new URL("/expired", req.url));
      }
    } else {
      link = attempt.data ?? null;
    }

    console.log("DB RESULT", link);

    if (!link) {
      console.warn("FAIL: token not found");
      return NextResponse.redirect(new URL("/expired", req.url));
    }

    const click_count = link.click_count ?? 0;
    const inactive = link.is_active === false || link.is_active == null;
    const expired = isExpired(link.expires_at);
    const maxed = reachedMaxClicks(link.max_clicks, click_count);

    console.log("VALIDATION", {
      exists: true,
      is_active: link.is_active,
      expires_at: link.expires_at,
      max_clicks: link.max_clicks ?? null,
      click_count,
      now: new Date().toISOString(),
      inactive,
      expired,
      maxed,
    });

    if (inactive || expired || maxed) {
      console.warn("FAIL: inactive/expired/maxed");
      return NextResponse.redirect(new URL("/expired", req.url));
    }

    // Increment click count (don't block redirect if update fails)
    const upd = await supabase.from("links").update({ click_count: click_count + 1 }).eq("token", token);
    if (upd.error) console.error("Supabase update error:", upd.error);

    return NextResponse.redirect(link.target_url);
  } catch (err) {
    console.error("REDIRECT ROUTE CRASH:", err);
    return NextResponse.redirect(new URL("/expired", req.url));
  }
}

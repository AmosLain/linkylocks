import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function isPrefetch(req: Request) {
  const h = req.headers;
  const purpose = (h.get("purpose") || "").toLowerCase();
  const secPurpose = (h.get("sec-purpose") || "").toLowerCase();

  // Next/Chrome style prefetch hints
  const nextRouterPrefetch = h.get("next-router-prefetch");
  const middlewarePrefetch = h.get("x-middleware-prefetch");

  // Some browsers send fetch-mode hints; not always reliable, but helpful
  const fetchMode = (h.get("sec-fetch-mode") || "").toLowerCase();

  return (
    purpose === "prefetch" ||
    secPurpose === "prefetch" ||
    !!nextRouterPrefetch ||
    !!middlewarePrefetch ||
    fetchMode === "no-cors" // often used in speculative/prefetch
  );
}

function expired(req: Request) {
  return NextResponse.redirect(new URL("/expired", req.url));
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey || !token) {
      console.log("Missing required config or token");
      return expired(req);
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // ✅ If this is a prefetch request, DO NOT count it.
    // We still need to know if link exists + is allowed, so we do a read-only check.
    if (isPrefetch(req)) {
      console.log("Prefetch request detected for token:", token);
      
      const { data: link, error } = await supabase
        .from("links")
        .select("target_url,is_active,expires_at,max_clicks,click_count")
        .eq("token", token)
        .maybeSingle<{
          target_url: string;
          is_active: boolean;
          expires_at: string | null;
          max_clicks: number | null;
          click_count: number | null;
        }>();

      if (error || !link) {
        console.log("Prefetch: Link not found or error:", error);
        return expired(req);
      }

      if (link.is_active !== true) {
        console.log("Prefetch: Link is not active");
        return expired(req);
      }

      if (link.expires_at) {
        const exp = new Date(link.expires_at).getTime();
        const now = Date.now();
        console.log("Prefetch: Checking expiry", {
          expires_at: link.expires_at,
          exp_timestamp: exp,
          now_timestamp: now,
          is_expired: now >= exp
        });
        if (Number.isFinite(exp) && now >= exp) {
          console.log("Prefetch: Link has expired");
          return expired(req);
        }
      }

      if (link.max_clicks != null && (link.click_count ?? 0) >= link.max_clicks) {
        console.log("Prefetch: Max clicks reached");
        return expired(req);
      }

      console.log("Prefetch: Link valid, redirecting without counting");
      // Option A: redirect but don't increment
      return NextResponse.redirect(link.target_url, 302);

      // Option B (stricter): don't redirect on prefetch at all
      // return new NextResponse(null, { status: 204 });
    }

    // ✅ Real click: atomic enforcement + increment
    console.log("Real click for token:", token);
    const { data, error } = await supabase.rpc("resolve_link", { p_token: token });

    if (error) {
      console.error("RPC resolve_link error:", error);
      return expired(req);
    }

    if (!data || data.length === 0) {
      console.log("No data returned from resolve_link");
      return expired(req);
    }

    const row = data[0] as { ok: boolean; target_url: string | null };
    
    console.log("resolve_link result:", row);
    
    if (!row.ok || !row.target_url) {
      console.log("Link not ok or no target_url");
      return expired(req);
    }

    console.log("Redirecting to:", row.target_url);
    return NextResponse.redirect(row.target_url, 307);
  } catch (error) {
    console.error("Unexpected error in GET handler:", error);
    return expired(req);
  }
}
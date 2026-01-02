// app/l/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// --- Supabase admin client (service role) ---
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// --- Helpers ---
function isPrefetchLike(req: NextRequest) {
  const purpose = req.headers.get("purpose") || "";
  const secPurpose = req.headers.get("sec-purpose") || "";
  const xMiddlewarePrefetch = req.headers.get("x-middleware-prefetch") || "";
  const nextRouterPrefetch = req.headers.get("next-router-prefetch") || "";
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();

  if (purpose.toLowerCase().includes("prefetch")) return true;
  if (secPurpose.toLowerCase().includes("prefetch")) return true;
  if (xMiddlewarePrefetch === "1") return true;
  if (nextRouterPrefetch === "1") return true;

  // Bots/crawlers shouldn't burn clicks
  if (userAgent.includes("vercelbot")) return true;
  if (userAgent.includes("node")) return true;

  return false;
}

function redirectTo(req: NextRequest, path: string, params?: Record<string, string>) {
  const url = new URL(path, req.url);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

function safeDateMs(value: unknown): number | null {
  if (!value) return null;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : null;
}

export async function GET(req: NextRequest, ctx: { params: { token: string } }) {
  const token = ctx.params.token;

  if (!token || token.length < 3) {
    return redirectTo(req, "/");
  }

  const sb = supabaseAdmin();

  // IMPORTANT: your DB stores the password hash in `password` (NOT password_hash)
  const { data: link, error } = await sb
    .from("links")
    .select("token, created_at, delay_seconds, reveal_at, password")
    .eq("token", token)
    .single();

  if (error || !link) {
    return redirectTo(req, "/");
  }

  const nowMs = Date.now();

  // 1) reveal_at gate
  const revealAtMs = safeDateMs(link.reveal_at);
  if (revealAtMs && nowMs < revealAtMs) {
    return redirectTo(req, "/not-yet-available", {
      until: new Date(revealAtMs).toISOString(),
    });
  }

  // 2) delay_seconds gate (created_at + delay_seconds)
  const delay = Number(link.delay_seconds || 0);
  if (delay > 0) {
    const createdAtMs = safeDateMs(link.created_at);
    if (createdAtMs) {
      const untilMs = createdAtMs + delay * 1000;
      if (nowMs < untilMs) {
        return redirectTo(req, "/not-yet-available", {
          until: new Date(untilMs).toISOString(),
        });
      }
    }
  }

  // 3) password gate (cookie-based)
  if (link.password) {
    const cookieName = `llpw_${token}`;
    const cookieVal = cookies().get(cookieName)?.value;

    if (cookieVal !== link.password) {
      return redirectTo(req, "/password-required", { token });
    }
  }

  // 4) Prefetch-like requests should NOT count clicks
  if (isPrefetchLike(req)) {
    return new NextResponse("OK", { status: 200 });
  }

  // 5) Atomic click count + resolve
  const { data: resolved, error: rpcErr } = await sb.rpc("resolve_link", {
    p_token: token,
  });

  const row = Array.isArray(resolved) ? resolved?.[0] : resolved;

  if (rpcErr || !row || row.ok !== true || !row.target_url) {
    return redirectTo(req, "/expired");
  }

  return NextResponse.redirect(row.target_url);
}

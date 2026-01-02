// app/l/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

function redirectTo(req: NextRequest, path: string, params?: Record<string, string>) {
  const url = new URL(path, req.url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
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
  if (!token) return redirectTo(req, "/");

  const sb = supabaseAdmin();

  const { data: link, error } = await sb
    .from("links")
    .select("token, created_at, delay_seconds, reveal_at, password")
    .eq("token", token)
    .single();

  if (error || !link) return redirectTo(req, "/");

  const now = Date.now();

  // 1) reveal_at
  const revealAtMs = safeDateMs(link.reveal_at);
  if (revealAtMs && now < revealAtMs) {
    return redirectTo(req, "/not-yet-available", {
      until: new Date(revealAtMs).toISOString(),
    });
  }

  // 2) delay_seconds
  const delay = Number(link.delay_seconds || 0);
  if (delay > 0) {
    const createdAtMs = safeDateMs(link.created_at);
    if (createdAtMs) {
      const untilMs = createdAtMs + delay * 1000;
      if (now < untilMs) {
        return redirectTo(req, "/not-yet-available", {
          until: new Date(untilMs).toISOString(),
        });
      }
    }
  }

  // 3) password gate (FIXED — token is passed)
  if (link.password) {
    const cookieName = `llpw_${token}`;
    const cookieVal = cookies().get(cookieName)?.value;

    if (cookieVal !== link.password) {
      return redirectTo(req, "/password-required", { token });
    }
  }

  // 4) resolve link + count click
  const { data, error: rpcErr } = await sb.rpc("resolve_link", { p_token: token });
  const row = Array.isArray(data) ? data[0] : data;

  if (rpcErr || !row || row.ok !== true || !row.target_url) {
    return redirectTo(req, "/expired");
  }

  return NextResponse.redirect(row.target_url);
}

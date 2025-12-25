// app/l/[token]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const { data, error } = await supabase.rpc("resolve_link", { p_token: token });

    if (error || !data || data.length === 0) return expiredRedirect(req);

    const row = data[0] as { ok: boolean; target_url: string | null };

    if (!row.ok || !row.target_url) return expiredRedirect(req);

    return NextResponse.redirect(row.target_url, 302);
  } catch {
    return expiredRedirect(req);
  }
}

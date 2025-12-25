import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Service-role Supabase client for server-side redirect logic
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Next.js 16 sometimes gives params as a Promise, so we support both.
type Params =
  | { token: string }
  | Promise<{ token: string }>;

export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  // Normalize params (await if needed)
  const params =
    "then" in context.params
      ? await context.params
      : context.params;

  const token = params.token;

  // 1️⃣ Fetch link by token
  const { data: link, error } = await supabase
    .from("links")
    .select(
      "id, target_url, expires_at, max_clicks, click_count, is_active"
    )
    .eq("token", token)
    .single();

  if (error || !link) {
    // Unknown token → treat as expired/unavailable
    return NextResponse.redirect(new URL("/expired", request.url));
  }

  const now = new Date();

  const isTimeExpired =
    link.expires_at && new Date(link.expires_at) < now;

  const isMaxed =
    link.max_clicks !== null &&
    link.click_count !== null &&
    link.click_count >= link.max_clicks;

  // 2️⃣ If expired / maxed / inactive → redirect to expired page
  if (!link.is_active || isTimeExpired || isMaxed) {
    try {
      await supabase
        .from("links")
        .update({ is_active: false })
        .eq("id", link.id);
    } catch {
      // ignore update errors
    }

    return NextResponse.redirect(new URL("/expired", request.url));
  }

  // 3️⃣ Increment click counter (best effort)
  try {
    await supabase
      .from("links")
      .update({ click_count: (link.click_count ?? 0) + 1 })
      .eq("id", link.id);
  } catch {
    // ignore analytics errors
  }

  // 4️⃣ Redirect to the actual destination
  return NextResponse.redirect(link.target_url);
}

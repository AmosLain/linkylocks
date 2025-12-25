import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

// ---- Supabase admin client (service role) ----
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  throw new Error(
    "Supabase URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables."
  );
}

const supabase = createClient<Database>(url, serviceKey);

// ---- GET /l/[token] ----
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> } // Next.js 16: params is a Promise
) {
  try {
    const { token } = await context.params; // ✅ unwrap params

    // 1) Fetch the matching link (first row only)
    const { data: link, error } = await supabase
      .from("links")
      .select("*")
      .eq("token", token)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Link lookup error:", error);
      return NextResponse.json(
        { error: "Link lookup failed" },
        { status: 500 }
      );
    }

    if (!link) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }

    const now = new Date();

    // 2) Disabled?
    if (!link.is_active) {
      return NextResponse.json(
        { error: "Link disabled" },
        { status: 410 }
      );
    }

    // 3) Time-based expiry
    if (link.expires_at) {
      const expiry = new Date(link.expires_at);
      if (now >= expiry) {
        return NextResponse.json(
          { error: "Link expired (time)" },
          { status: 410 }
        );
      }
    }

    // 4) Max-opens expiry
    if (link.max_opens && link.opens_count >= link.max_opens) {
      return NextResponse.json(
        { error: "Link expired (max opens reached)" },
        { status: 410 }
      );
    }

    // 5) Increment opens_count (best effort, don't block redirect)
    const newCount = (link.opens_count ?? 0) + 1;
    supabase
      .from("links")
      .update({ opens_count: newCount })
      .eq("id", link.id)
      .then(({ error: incError }) => {
        if (incError) {
          console.error("Error incrementing opens_count:", incError);
        }
      })
      .catch((e) => console.error("Unexpected increment error:", e));

    // 6) Redirect to the target URL
    return NextResponse.redirect(link.target_url, { status: 302 });
  } catch (err: any) {
    console.error("Redirect handler error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}

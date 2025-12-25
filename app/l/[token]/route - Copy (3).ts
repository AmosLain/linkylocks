import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

// Create a Supabase admin client using the service role key
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables."
    );
  }

  return createClient<Database>(url, serviceKey);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const supabase = getSupabaseAdmin();

    // 1️⃣ Find the link by token
    const { data: link, error } = await supabase
      .from("links")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !link) {
      console.error("Link lookup error:", error);
      return NextResponse.json(
        { error: "Link not found", details: error?.message },
        { status: 404 }
      );
    }

    // 2️⃣ Disabled?
    if (!link.is_active) {
      return NextResponse.json(
        { error: "Link disabled" },
        { status: 410 }
      );
    }

    // 3️⃣ Max opens reached?
    if (link.max_opens && link.opens_count >= link.max_opens) {
      return NextResponse.json(
        { error: "Link expired (max opens reached)" },
        { status: 410 }
      );
    }

    // 4️⃣ Time expired?
    if (link.expires_at) {
      const now = new Date();
      const expiry = new Date(link.expires_at);
      if (now > expiry) {
        return NextResponse.json(
          { error: "Link expired (time)" },
          { status: 410 }
        );
      }
    }

    // 5️⃣ Increment opens_count (best effort)
    await supabase
      .from("links")
      .update({ opens_count: (link.opens_count || 0) + 1 })
      .eq("id", link.id);

    // Redirect to the target URL
    return NextResponse.redirect(link.target_url, { status: 302 });
  } catch (err: any) {
    console.error("Redirect handler error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

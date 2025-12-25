import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  // Create the server-side Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get() {
          return "";
        },
        set() {},
        remove() {},
      },
    }
  );

  // 1️⃣ Look up the link
  const { data: link, error } = await supabase
    .from("links")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  // 2️⃣ Disabled?
  if (!link.is_active) {
    return NextResponse.json({ error: "Link disabled" }, { status: 410 });
  }

  // 3️⃣ Max opens expiry
  if (link.max_opens && link.opens_count >= link.max_opens) {
    return NextResponse.json(
      { error: "Link expired (max opens)" },
      { status: 410 }
    );
  }

  // 4️⃣ Time expiry
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

  // 5️⃣ Increment open count
  await supabase
    .from("links")
    .update({ opens_count: link.opens_count + 1 })
    .eq("id", link.id);

  // 6️⃣ Redirect to target URL
  return NextResponse.redirect(link.target_url);
}

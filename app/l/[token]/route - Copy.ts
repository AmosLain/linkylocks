import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createClient();

  const token = params.token;

  // 1️⃣ Find link by token
  const { data: link, error } = await supabase
    .from("links")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  // 2️⃣ Check if disabled
  if (!link.is_active) {
    return NextResponse.json({ error: "Link disabled" }, { status: 410 });
  }

  // 3️⃣ Check max opens
  if (link.max_opens && link.opens_count >= link.max_opens) {
    return NextResponse.json({ error: "Link expired (max opens)" }, { status: 410 });
  }

  // 4️⃣ Check time expiry
  if (link.expires_at) {
    const now = new Date();
    const expiry = new Date(link.expires_at);
    if (now > expiry) {
      return NextResponse.json({ error: "Link expired (time)" }, { status: 410 });
    }
  }

  // 5️⃣ Increment opens_count
  await supabase
    .from("links")
    .update({ opens_count: link.opens_count + 1 })
    .eq("id", link.id);

  // 6️⃣ Redirect
  return NextResponse.redirect(link.target_url);
}

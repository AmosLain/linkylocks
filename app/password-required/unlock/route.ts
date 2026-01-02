// app/password-required/unlock/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") || "").trim();
  const password = String(form.get("password") || "");

  if (!token) {
    return NextResponse.redirect(new URL("/password-required?bad=1", req.url));
  }

  const sb = supabaseAdmin();

  // IMPORTANT: your DB column is `password` (hash)
  const { data: link, error } = await sb
    .from("links")
    .select("token, password")
    .eq("token", token)
    .single();

  if (error || !link) {
    return NextResponse.redirect(
      new URL(`/password-required?token=${encodeURIComponent(token)}&bad=1`, req.url)
    );
  }

  // If no password is set, just continue
  if (!link.password) {
    return NextResponse.redirect(new URL(`/l/${encodeURIComponent(token)}`, req.url));
  }

  const inputHash = sha256(password.trim());
  if (inputHash !== link.password) {
    return NextResponse.redirect(
      new URL(`/password-required?token=${encodeURIComponent(token)}&bad=1`, req.url)
    );
  }

  // Token-scoped cookie (HttpOnly)
  const cookieName = `llpw_${token}`;
  cookies().set(cookieName, link.password, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/l/${token}`,
    maxAge: 60 * 60, // 1 hour
  });

  return NextResponse.redirect(new URL(`/l/${encodeURIComponent(token)}`, req.url));
}

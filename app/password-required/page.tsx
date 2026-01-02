// app/password-required/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: { token?: string; bad?: string };
};

export default function PasswordRequiredPage({ searchParams }: Props) {
  const token = searchParams?.token ?? "";
  const bad = searchParams?.bad === "1";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #ddd", borderRadius: 16, padding: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Password required</h1>

        {bad && (
          <div style={{ marginBottom: 10, color: "#b91c1c", fontSize: 14 }}>
            Wrong password. Try again.
          </div>
        )}

        {!token ? (
          <div style={{ fontSize: 14, opacity: 0.8 }}>
            Missing token. Please open the link again.
          </div>
        ) : (
          <form action="/password-required/unlock" method="POST" style={{ marginTop: 14 }}>
            <input type="hidden" name="token" value={token} />

            <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.85 }}>
              Enter password
            </label>

            <input
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ccc",
                fontSize: 16,
                outline: "none",
              }}
            />

            <button
              type="submit"
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #111",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                background: "white",
              }}
            >
              Unlock
            </button>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Token: {token}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

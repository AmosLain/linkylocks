// app/expired/page.tsx
export default function ExpiredPage() {
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Link unavailable</h1>
      <p style={{ lineHeight: 1.6 }}>
        This link is expired, disabled, or has reached its click limit.
      </p>
    </main>
  );
}

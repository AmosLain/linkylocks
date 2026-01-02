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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Password required</h1>

        {bad && (
          <p className="mt-2 text-sm text-red-600">
            Wrong password. Try again.
          </p>
        )}

        {!token ? (
          <p className="mt-2 text-sm opacity-80">Missing token. Open the link again.</p>
        ) : (
          <form className="mt-4 space-y-3" action="/password-required/unlock" method="POST">
            <input type="hidden" name="token" value={token} />
            <input
              className="w-full rounded-xl border px-3 py-2"
              type="password"
              name="password"
              placeholder="Enter password"
              required
            />
            <button className="w-full rounded-xl border px-3 py-2 font-medium" type="submit">
              Unlock
            </button>
          </form>
        )}

        <p className="mt-4 text-xs opacity-70">
          This unlock uses an HttpOnly cookie (no password in the URL).
        </p>
      </div>
    </div>
  );
}

// app/not-yet-available/page.tsx
export const dynamic = "force-dynamic";

type Props = {
  searchParams?: { until?: string };
};

export default function NotYetAvailablePage({ searchParams }: Props) {
  const until = searchParams?.until || null;

  let untilMs: number | null = null;
  if (until) {
    const t = Date.parse(until);
    untilMs = Number.isFinite(t) ? t : null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Not yet available</h1>

        {!untilMs ? (
          <p className="mt-2 text-sm opacity-80">
            This link isn’t available yet, but no unlock time was provided.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm opacity-80">
              This link will unlock at:
            </p>
            <div className="mt-3 text-lg font-semibold">
              {new Date(untilMs).toLocaleString()}
            </div>
            <p className="mt-2 text-xs opacity-70 break-all">until={until}</p>
          </>
        )}

        <p className="mt-4 text-sm opacity-80">
          Refresh the original link when the time arrives.
        </p>
      </div>
    </div>
  );
}

// app/password-required/page.tsx
import PasswordRequiredClient from "./password-required-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    token?: string;
    bad?: string;
  };
};

export default function PasswordRequiredPage({ searchParams }: Props) {
  const token = searchParams?.token ?? "";
  const bad = searchParams?.bad === "1";

  return <PasswordRequiredClient token={token} bad={bad} />;
}

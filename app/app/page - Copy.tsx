"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type User = {
  id: string;
  email?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? undefined });
      }
    };
    loadUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-2xl font-bold text-indigo-700">
          <Lock className="w-7 h-7" />
          <span>LinkyLocks Dashboard</span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>

      <p className="text-gray-700 mb-2">
        Logged in as:{" "}
        <span className="font-semibold">
          {user?.email ?? "Loading..."}
        </span>
      </p>

      <p className="text-gray-500">
        This is the starting point. Next we’ll add your **links table**
        and **Create Link** form here.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClientSafely } from "../src/lib/supabase-browser";

export function AuthStatus() {
  const supabase = getSupabaseBrowserClientSafely();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (!supabase) {
    return (
      <div className="status-pill">
        <span className="status-dot" />
        Auth env missing
      </div>
    );
  }

  const authClient = supabase;

  async function handleSignOut() {
    setPending(true);

    try {
      await authClient.auth.signOut();
      router.push("/");
      router.refresh();
      window.location.assign("/");
    } finally {
      setPending(false);
    }
  }

  if (session) {
    return (
      <div className="status-actions">
        <div className="status-pill">
          <span className="status-dot online" />
          {session.user.email ?? "Signed in"}
        </div>
        <button className="status-button" onClick={handleSignOut} disabled={pending} type="button">
          {pending ? "Signing out..." : "Log out"}
        </button>
      </div>
    );
  }

  return (
    <div className="status-pill">
      <span className="status-dot" />
      Not signed in
    </div>
  );
}

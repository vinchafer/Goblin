"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Creates a new chat session and redirects to it
export default function NewChatPage() {
  const router = useRouter();

  useEffect(() => {
    const create = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { router.push("/login"); return; }

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      try {
        const res = await fetch(`${apiBase}/api/chat-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error();
        const newSession = await res.json() as { id: string };
        router.replace(`/dashboard/chat/${newSession.id}`);
      } catch {
        router.push("/dashboard");
      }
    };
    create();
  }, [router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--paper)" }}>
      <div style={{ width: 28, height: 28, border: "2px solid var(--div)", borderTopColor: "var(--brand-green)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

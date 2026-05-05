import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StandaloneChat } from "@/components/chat/standalone-chat";

interface StandaloneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  has_code: boolean;
  created_at: string;
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ChatSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Verify session belongs to user and fetch messages
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) notFound();

  const { data: messages } = await supabase
    .from("standalone_messages")
    .select("id, role, content, has_code, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(50);

  return (
    <div style={{ height: "100%" }}>
      <StandaloneChat
        sessionId={sessionId}
        initialMessages={(messages ?? []) as StandaloneMessage[]}
      />
    </div>
  );
}

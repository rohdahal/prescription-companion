"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { askAssistant, fetchChatHistory, fetchLatestPrescription } from "../../src/lib/api";
import { getSupabaseBrowserClientSafely } from "../../src/lib/supabase-browser";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ChatThread = {
  id: string;
  title: string;
  subtitle: string;
  messages: ChatMessage[];
};

export function ChatAssistant() {
  const supabase = getSupabaseBrowserClientSafely();
  const [question, setQuestion] = useState("");
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [historyThreads, setHistoryThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("current");
  const [session, setSession] = useState<Session | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  function upsertHistoryThread(thread: ChatThread) {
    setHistoryThreads((prev) => {
      const filtered = prev.filter((existingThread) => existingThread.id !== thread.id);
      return [thread, ...filtered];
    });
  }

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

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    void fetchLatestPrescription(session.access_token)
      .then((prescription) => {
        setPrescriptionId(prescription?.id ?? null);
      })
      .catch(() => {
        setPrescriptionId(null);
      });
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token || !prescriptionId) {
      setCurrentMessages([]);
      setCurrentThreadId(null);
      setHistoryThreads([]);
      return;
    }

    setHistoryLoading(true);

    void fetchChatHistory(session.access_token, prescriptionId)
      .then((history) => {
        setCurrentMessages([]);
        setCurrentThreadId(null);
        setHistoryThreads(
          history.map((thread) => ({
            id: thread.id,
            title: thread.title,
            subtitle: thread.subtitle ?? "Conversation",
            messages: thread.messages.map((entry) => ({
              id: entry.id,
              role: entry.role,
              text: `${entry.role === "user" ? "You" : "Assistant"}: ${entry.message}`
            }))
          }))
        );
        setSelectedThreadId("current");
      })
      .catch(() => {
        setCurrentMessages([]);
        setCurrentThreadId(null);
        setHistoryThreads([]);
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [prescriptionId, session?.access_token]);

  const submitQuestion = async () => {
    if (!question.trim() || !prescriptionId || !session?.access_token) {
      return;
    }

    const userMessage = `You: ${question}`;
    const optimisticUserMessage = { id: crypto.randomUUID(), role: "user" as const, text: userMessage };
    setSelectedThreadId("current");
    setCurrentMessages((prev) => [...prev, optimisticUserMessage]);
    setLoading(true);

    try {
      const result = await askAssistant(
        question,
        prescriptionId,
        session?.access_token ?? "",
        currentThreadId,
        session?.user.id ?? "demo-user"
      );
      setCurrentMessages((prev) => {
        const next = [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant" as const, text: `Assistant: ${result.response ?? ""}` }
        ];
        const nextThreadId = result.threadId ?? currentThreadId ?? crypto.randomUUID();
        setCurrentThreadId(nextThreadId);
        upsertHistoryThread({
          id: nextThreadId,
          title: next[0]?.text.replace(/^You:\s*/, "") ?? question,
          subtitle: `Assistant: ${result.response ?? ""}`.replace(/^Assistant:\s*/, ""),
          messages: next
        });
        return next;
      });
    } catch {
      setCurrentMessages((prev) => {
        const next = [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant" as const, text: "Assistant: Sorry, something went wrong." }
        ];
        if (currentThreadId) {
          upsertHistoryThread({
            id: currentThreadId,
            title: next[0]?.text.replace(/^You:\s*/, "") ?? question,
            subtitle: "Sorry, something went wrong.",
            messages: next
          });
        }
        return next;
      });
    } finally {
      setLoading(false);
      setQuestion("");
    }
  };

  const displayedMessages =
    selectedThreadId === "current"
      ? currentMessages
      : historyThreads.find((thread) => thread.id === selectedThreadId)?.messages ?? [];

  return (
    <section className="companion-layout">
      <aside className="history-rail">
        <div className="history-header">
          <p className="eyebrow">History</p>
          <h3>Previous chats</h3>
        </div>
        <button
          className={selectedThreadId === "current" ? "history-item active" : "history-item"}
          onClick={() => {
            setSelectedThreadId("current");
          }}
          type="button"
        >
          <strong>Current conversation</strong>
          <span>Show the full running thread</span>
        </button>
        {historyThreads.map((thread) => (
          <button
            key={thread.id}
            className={selectedThreadId === thread.id ? "history-item active" : "history-item"}
            onClick={() => setSelectedThreadId(thread.id)}
            type="button"
          >
            <strong>{thread.title}</strong>
            <span>{thread.subtitle}</span>
          </button>
        ))}
      </aside>

      <section className="chat-card companion-main">
        <div className="chat-header">
          <div>
            <p className="eyebrow">Ask me anything</p>
            <h2>Food, timing, interactions, missed doses.</h2>
          </div>
          <span className="badge">Prescription-aware</span>
        </div>
        <p className="section-copy">Click an earlier prompt on the left to load it, or keep working in the current thread.</p>
        <div className="chat-log">
          {!prescriptionId && !historyLoading ? (
            <p className="chat-meta">No prescription found for the current user. Seed data or upload a prescription first.</p>
          ) : null}
          {historyLoading ? <p className="chat-meta">Loading previous chat history...</p> : null}
          {!historyLoading && prescriptionId && displayedMessages.length === 0 ? (
            <p className="chat-meta">
              {selectedThreadId === "current"
                ? "Start a new conversation. Previous chats stay in the history rail."
                : "No messages found for this history thread."}
            </p>
          ) : null}
          {displayedMessages.map((message) => (
            <p key={message.id} className={message.role === "user" ? "chat-bubble user" : "chat-bubble assistant"}>
              {message.text}
            </p>
          ))}
        </div>
        <div className="ask-surface">
          <div className="ask-prompt">
            <span className="ask-label">Ask me anything</span>
            <input
              className="chat-input"
              placeholder="Can I take this with food?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </div>
          <button
            className="primary-button"
            disabled={loading || !prescriptionId}
            onClick={submitQuestion}
          >
            {loading ? "Asking..." : "Send"}
          </button>
        </div>
      </section>
    </section>
  );
}

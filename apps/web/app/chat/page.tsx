import { ChatAssistant } from "./ChatAssistant.client";

export default function ChatPage() {
  return (
    <section className="companion-page">
      <div className="companion-intro">
        <p className="eyebrow">Companion</p>
        <h2 className="section-title">Ask anything about your medication plan.</h2>
        <p className="section-copy">
          Review prior questions from the sidebar, click one to reload it, or start a fresh ask-anything thread.
        </p>
      </div>
      <ChatAssistant />
    </section>
  );
}

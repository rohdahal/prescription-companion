import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { AuthStatus } from "./AuthStatus.client";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-body">
        <main className="app-shell">
          <header className="app-header">
            <div>
              <p className="eyebrow">Prescription Companion</p>
              <h1 className="app-title">Medication clarity, adherence, and AI guidance in one place.</h1>
            </div>
            <AuthStatus />
          </header>

          <nav className="app-nav">
            <Link href="/">Home</Link>
            <Link href="/schedule">Schedule</Link>
            <Link href="/care">Care</Link>
            <Link href="/chat">Companion</Link>
          </nav>

          <section className="page-frame">{children}</section>
        </main>
      </body>
    </html>
  );
}

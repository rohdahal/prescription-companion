"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchDashboard } from "../../src/lib/api";
import { getSupabaseBrowserClientSafely } from "../../src/lib/supabase-browser";

type DashboardData = {
  activePrescriptions: number;
  nextMedicationDose: string | null;
  followUpReminders: number;
  adherenceScore: number;
  flagForAttention: boolean;
  latestPrescriptionId: string | null;
};

export function DashboardClient() {
  const supabase = getSupabaseBrowserClientSafely();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
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

    void fetchDashboard(session.access_token)
      .then((nextData) => {
        setData(nextData);
        setError(null);
      })
      .catch(() => {
        setError("Unable to load dashboard data for the current user.");
      });
  }, [session?.access_token]);

  if (!session) {
    return <p className="empty-state">Sign in to load your dashboard data.</p>;
  }

  if (error) {
    return <p className="empty-state">{error}</p>;
  }

  if (!data) {
    return <p className="empty-state">Loading dashboard...</p>;
  }

  return (
    <section className="dashboard-grid">
      <article className="hero-card wide">
        <p className="eyebrow">Today</p>
        <h2 className="section-title">Medication overview</h2>
        <p className="section-copy">
          {data.latestPrescriptionId
            ? "This dashboard is reading the latest prescription seeded for your authenticated user."
            : "No prescription found yet for this account. Seed data or upload a prescription to populate it."}
        </p>
        {data.latestPrescriptionId ? (
          <Link className="primary-link" href="/prescriptions/latest">
            Open latest prescription
          </Link>
        ) : null}
      </article>

      <article className="metric-card">
        <span>Active prescriptions</span>
        <strong>{data.activePrescriptions}</strong>
      </article>
      <article className="metric-card">
        <span>Next dose</span>
        <strong>{data.nextMedicationDose ?? "--"}</strong>
      </article>
      <article className="metric-card">
        <span>Follow-up reminders</span>
        <strong>{data.followUpReminders}</strong>
      </article>
      <article className="metric-card">
        <span>Adherence score</span>
        <strong>{data.adherenceScore}%</strong>
        <em>{data.flagForAttention ? "Needs attention" : "On track"}</em>
      </article>
    </section>
  );
}

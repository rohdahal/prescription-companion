"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "./AuthPanel.client";
import { fetchCare, fetchDashboard, fetchPrescriptions } from "../src/lib/api";
import { getSupabaseBrowserClientSafely } from "../src/lib/supabase-browser";

type DashboardData = {
  activePrescriptions: number;
  nextMedicationDose: string | null;
  followUpReminders: number;
  adherenceScore: number;
  flagForAttention: boolean;
  latestPrescriptionId: string | null;
};

type Prescription = {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  created_at: string;
};

type CareVisit = {
  id: string;
  visit_type: string;
  provider_name: string;
  location: string;
  visit_date: string;
  summary: string;
  next_steps: string[];
};

export function HomeWorkspace() {
  const supabase = getSupabaseBrowserClientSafely();
  const [session, setSession] = useState<Session | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [recentVisit, setRecentVisit] = useState<CareVisit | null>(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);

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
      setDashboard(null);
      setPrescriptions([]);
      setRecentVisit(null);
      setSelectedPrescriptionId(null);
      return;
    }

    void Promise.all([
      fetchDashboard(session.access_token),
      fetchPrescriptions(session.access_token),
      fetchCare(session.access_token)
    ])
      .then(([dashboardData, userPrescriptions, careData]) => {
        setDashboard(dashboardData);
        setPrescriptions(userPrescriptions);
        setRecentVisit(careData.visits[0] ?? null);
        setSelectedPrescriptionId(userPrescriptions[0]?.id ?? null);
      })
      .catch(() => {
        setDashboard(null);
        setPrescriptions([]);
        setRecentVisit(null);
        setSelectedPrescriptionId(null);
      });
  }, [session?.access_token]);

  const selectedPrescription = prescriptions.find((item) => item.id === selectedPrescriptionId) ?? prescriptions[0] ?? null;

  if (!session) {
    return (
      <section className="home-grid">
        <div className="home-hero">
          <p className="eyebrow">Home</p>
          <h2 className="hero-title">A clearer way to manage prescriptions, follow-up care, and medication questions.</h2>
          <p className="hero-description">
            Prescription Companion brings your medication details, schedule, recent care context, and conversational
            guidance into one focused workspace.
          </p>

          <div className="preview-grid">
            <article className="preview-panel">
              <span>Adherence snapshot</span>
              <strong>82%</strong>
              <p>See attention flags, next dose timing, and follow-up reminders at a glance.</p>
            </article>
            <article className="preview-panel">
              <span>Prescription clarity</span>
              <strong>3 meds</strong>
              <p>Bring dosage, schedule, and instructions into a readable format.</p>
            </article>
            <article className="preview-panel">
              <span>Ask me anything</span>
              <strong>Food, timing, missed doses</strong>
              <p>The companion chat is designed for medication questions, not a generic chatbot shell.</p>
            </article>
          </div>
        </div>

        <AuthPanel />
      </section>
    );
  }

  return (
    <section className="workspace-grid">
      <article className="workspace-hero">
        <div>
          <p className="eyebrow">Home</p>
          <h2 className="section-title">Your latest prescription, dashboard, and companion entry point in one place.</h2>
        </div>
        <div className="workspace-actions">
          <Link className="primary-link" href="/chat">
            Open companion
          </Link>
        </div>
      </article>

      <section className="dashboard-grid compact">
        <article className="metric-card">
          <span>Active prescriptions</span>
          <strong>{dashboard?.activePrescriptions ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Next dose</span>
          <strong>{dashboard?.nextMedicationDose ?? "--"}</strong>
        </article>
        <article className="metric-card">
          <span>Follow-up reminders</span>
          <strong>{dashboard?.followUpReminders ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Adherence score</span>
          <strong>{dashboard?.adherenceScore ?? 0}%</strong>
          <em>{dashboard?.flagForAttention ? "Needs attention" : "On track"}</em>
        </article>
      </section>

      <section className="workspace-columns">
        <article className="detail-card">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Prescriptions</p>
              <h2>{selectedPrescription?.medication_name ?? "No prescription yet"}</h2>
            </div>
            {selectedPrescription ? (
              <Link className="primary-link" href="/care">
                Go to care
              </Link>
            ) : null}
          </div>

          {selectedPrescription ? (
            <>
              <div className="prescription-selector">
                {prescriptions.map((item) => (
                  <button
                    key={item.id}
                    className={item.id === selectedPrescription.id ? "prescription-chip active" : "prescription-chip"}
                    onClick={() => setSelectedPrescriptionId(item.id)}
                    type="button"
                  >
                    <strong>{item.medication_name}</strong>
                    <span>{item.frequency}</span>
                  </button>
                ))}
              </div>

              <div className="detail-grid">
              <article>
                <span>Dosage</span>
                <strong>{selectedPrescription.dosage}</strong>
              </article>
              <article>
                <span>Schedule</span>
                <strong>{selectedPrescription.frequency}</strong>
              </article>
              <article className="full-width">
                <span>Instructions</span>
                <p>{selectedPrescription.instructions}</p>
              </article>
              </div>
            </>
          ) : (
            <p className="empty-state">Seed data or upload a prescription to populate this panel.</p>
          )}
        </article>

        <div className="workspace-stack">
          {recentVisit ? (
            <article className="recent-visit-card">
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Recent visit</p>
                  <h3>{recentVisit.provider_name}</h3>
                </div>
                <span className="badge">{new Date(recentVisit.visit_date).toLocaleDateString()}</span>
              </div>
              <p className="section-copy">{recentVisit.visit_type}</p>
              <p className="section-copy">{recentVisit.location}</p>
              <p className="section-copy">
                Discussed {selectedPrescription?.medication_name ?? "your medication plan"} during the latest follow-up.
              </p>
            </article>
          ) : null}

          <article className="companion-teaser">
            <p className="eyebrow">Companion</p>
            <h2 className="section-title">Ask me anything about timing, food, interactions, and missed doses.</h2>
            <p className="section-copy">
              The companion view includes clickable history threads on the left and a focused ask-anything composer on the
              right.
            </p>
            <div className="teaser-stack">
              <div className="teaser-question">Can I take this with dinner?</div>
              <div className="teaser-question">What if I missed last night&apos;s dose?</div>
              <div className="teaser-question">When is my next refill reminder?</div>
            </div>
            <Link className="primary-link" href="/chat">
              Go to companion
            </Link>
          </article>
        </div>
      </section>
    </section>
  );
}

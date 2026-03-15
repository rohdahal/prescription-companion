"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchCare } from "../../src/lib/api";
import { getSupabaseBrowserClientSafely } from "../../src/lib/supabase-browser";

type CareVisit = {
  id: string;
  visit_type: string;
  provider_name: string;
  location: string;
  visit_date: string;
  summary: string;
  next_steps: string[];
  prescriptions: Array<{
    id: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    instructions: string;
    follow_up_recommendation: string;
    created_at: string;
  }>;
};

export default function CarePage() {
  const supabase = getSupabaseBrowserClientSafely();
  const [session, setSession] = useState<Session | null>(null);
  const [visits, setVisits] = useState<CareVisit[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setVisits([]);
      setSelectedVisitId(null);
      setError(null);
      return;
    }

    void fetchCare(session.access_token)
      .then((data) => {
        setVisits(data.visits);
        setSelectedVisitId(data.visits[0]?.id ?? null);
        setError(null);
      })
      .catch(() => {
        setError("Unable to load care details for this user.");
      });
  }, [session?.access_token]);

  if (!session) {
    return <p className="empty-state">Sign in to view recent visits and prescription details.</p>;
  }

  if (error) {
    return <p className="empty-state">{error}</p>;
  }

  const selectedVisit = visits.find((visit) => visit.id === selectedVisitId) ?? visits[0] ?? null;

  return (
    <section className="care-grid">
      <article className="hero-card wide">
        <p className="eyebrow">Care</p>
        <h2 className="section-title">Recent visits, follow-up notes, and the prescription details tied to your care plan.</h2>
        <p className="section-copy">
          Use this view to remember what was discussed at the last visit and how those recommendations map back to your
          current medications.
        </p>
      </article>

      <section className="care-column">
        <article className="detail-card">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Recent visits</p>
              <h2>{visits.length > 0 ? `${visits.length} on record` : "No visits yet"}</h2>
            </div>
          </div>

          {visits.length > 0 ? (
            <div className="care-visit-list">
              {visits.map((visit) => (
                <button
                  key={visit.id}
                  className={visit.id === selectedVisit?.id ? "care-card care-card-button active" : "care-card care-card-button"}
                  onClick={() => setSelectedVisitId(visit.id)}
                  type="button"
                >
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">{new Date(visit.visit_date).toLocaleDateString()}</p>
                      <h3>{visit.visit_type}</h3>
                    </div>
                    <span className="badge">{visit.provider_name}</span>
                  </div>
                  <p className="section-copy">{visit.location}</p>
                  <div className="care-card-meta">
                    <span>
                      {visit.prescriptions.length} prescription{visit.prescriptions.length === 1 ? "" : "s"}
                    </span>
                    <span>{visit.next_steps.length} next step{visit.next_steps.length === 1 ? "" : "s"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">No care visits found yet. Re-run the seed after updating your schema.</p>
          )}
        </article>
      </section>

      <section className="care-column">
        <article className="detail-card">
          <div className="detail-header">
            <div>
              <p className="eyebrow">Prescription details</p>
              <h2>
                {selectedVisit
                  ? `${selectedVisit.prescriptions.length} linked to this visit`
                  : "Select a visit"}
              </h2>
            </div>
          </div>

          {selectedVisit ? (
            <>
              <article className="care-card care-summary-card">
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">Selected visit</p>
                    <h3>{selectedVisit.visit_type}</h3>
                  </div>
                  <span className="badge">{selectedVisit.provider_name}</span>
                </div>
                <p className="section-copy">{selectedVisit.location}</p>
                <p className="section-copy">{selectedVisit.summary}</p>
                <div className="care-tags">
                  {selectedVisit.next_steps.map((step) => (
                    <span key={step} className="care-tag">
                      {step}
                    </span>
                  ))}
                </div>
              </article>

              {selectedVisit.prescriptions.length > 0 ? (
                <div className="care-prescription-list">
                  {selectedVisit.prescriptions.map((prescription) => (
                    <article key={prescription.id} className="care-card">
                      <div className="detail-header">
                        <div>
                          <p className="eyebrow">{new Date(prescription.created_at).toLocaleDateString()}</p>
                          <h3>{prescription.medication_name}</h3>
                        </div>
                        <span className="badge">{prescription.frequency}</span>
                      </div>
                      <div className="care-tags">
                        <span className="care-tag">{prescription.dosage}</span>
                      </div>
                      <p className="section-copy">{prescription.instructions}</p>
                      <p className="section-copy">{prescription.follow_up_recommendation}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No prescriptions are linked to this visit yet.</p>
              )}
            </>
          ) : (
            <p className="empty-state">No care visits found yet. Seed data or create a visit first.</p>
          )}
        </article>
      </section>
    </section>
  );
}

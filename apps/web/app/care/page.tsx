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
};

type CarePrescription = {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  follow_up_recommendation: string;
  created_at: string;
};

export default function CarePage() {
  const supabase = getSupabaseBrowserClientSafely();
  const [session, setSession] = useState<Session | null>(null);
  const [visits, setVisits] = useState<CareVisit[]>([]);
  const [prescriptions, setPrescriptions] = useState<CarePrescription[]>([]);
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
      setPrescriptions([]);
      setError(null);
      return;
    }

    void fetchCare(session.access_token)
      .then((data) => {
        setVisits(data.visits);
        setPrescriptions(data.prescriptions);
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
            visits.map((visit) => (
              <article key={visit.id} className="care-card">
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">{new Date(visit.visit_date).toLocaleDateString()}</p>
                    <h3>{visit.visit_type}</h3>
                  </div>
                  <span className="badge">{visit.provider_name}</span>
                </div>
                <p className="section-copy">{visit.location}</p>
                <p className="section-copy">{visit.summary}</p>
                <div className="care-tags">
                  {visit.next_steps.map((step) => (
                    <span key={step} className="care-tag">
                      {step}
                    </span>
                  ))}
                </div>
              </article>
            ))
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
              <h2>{prescriptions.length > 0 ? `${prescriptions.length} active records` : "No prescriptions yet"}</h2>
            </div>
          </div>

          {prescriptions.length > 0 ? (
            prescriptions.map((prescription) => (
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
            ))
          ) : (
            <p className="empty-state">No prescriptions found yet. Seed data or upload a prescription first.</p>
          )}
        </article>
      </section>
    </section>
  );
}

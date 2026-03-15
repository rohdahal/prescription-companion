"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchLatestPrescription } from "../../../src/lib/api";
import { getSupabaseBrowserClientSafely } from "../../../src/lib/supabase-browser";

type Prescription = {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  instructions: string;
};

export default function LatestPrescriptionPage() {
  const supabase = getSupabaseBrowserClientSafely();
  const [session, setSession] = useState<Session | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
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
      return;
    }

    void fetchLatestPrescription(session.access_token)
      .then((data) => {
        setPrescription(data);
        setError(null);
      })
      .catch(() => {
        setError("Unable to load the latest prescription for this user.");
      });
  }, [session?.access_token]);

  if (!session) {
    return <p className="empty-state">Sign in to load your prescription.</p>;
  }

  if (error) {
    return <p className="empty-state">{error}</p>;
  }

  if (!prescription) {
    return <p className="empty-state">No seeded or uploaded prescription found for this user.</p>;
  }

  return (
    <section className="detail-card">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Prescription viewer</p>
          <h2>{prescription.medication_name}</h2>
        </div>
        <span className="badge">ID {prescription.id}</span>
      </div>

      <div className="detail-grid">
        <article>
          <span>Dosage</span>
          <strong>{prescription.dosage}</strong>
        </article>
        <article>
          <span>Schedule</span>
          <strong>{prescription.frequency}</strong>
        </article>
        <article>
          <span>Instructions</span>
          <p>{prescription.instructions}</p>
        </article>
        <article>
          <span>Next dose</span>
          <strong>08:00</strong>
        </article>
      </div>
    </section>
  );
}

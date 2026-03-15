"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchSchedule } from "../../src/lib/api";
import { getSupabaseBrowserClientSafely } from "../../src/lib/supabase-browser";

type ScheduleItem = {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  doseTimes: string[];
  adherenceScore: number;
  flagForAttention: boolean;
  reminders: Array<{
    id: string;
    reminder_type: string;
    scheduled_for: string;
    status: string;
  }>;
};

export default function SchedulePage() {
  const supabase = getSupabaseBrowserClientSafely();
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
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

    void fetchSchedule(session.access_token)
      .then((data) => {
        setItems(data.items);
        setError(null);
      })
      .catch(() => {
        setError("Unable to load schedule data for this user.");
      });
  }, [session?.access_token]);

  if (!session) {
    return <p className="empty-state">Sign in to view your schedule.</p>;
  }

  if (error) {
    return <p className="empty-state">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="empty-state">No schedules found yet. Seed data or generate a schedule first.</p>;
  }

  return (
    <section className="schedule-grid">
      <article className="hero-card wide">
        <p className="eyebrow">Schedule</p>
        <h2 className="section-title">Dose timing, reminders, and adherence across your prescriptions.</h2>
        <p className="section-copy">Use this view to scan upcoming doses and spot any prescription that needs attention.</p>
      </article>

      {items.map((item) => (
        <article key={item.id} className="schedule-card">
          <div className="detail-header">
            <div>
              <p className="eyebrow">{item.frequency}</p>
              <h2>{item.medicationName}</h2>
            </div>
            <span className="badge">{item.adherenceScore}%</span>
          </div>

          <div className="schedule-times">
            {item.doseTimes.map((time) => (
              <span key={time} className="schedule-time">
                {time}
              </span>
            ))}
          </div>

          <p className="section-copy">{item.dosage}</p>
          <p className="schedule-flag">{item.flagForAttention ? "Needs attention" : "On track"}</p>

          <div className="schedule-reminders">
            {item.reminders.map((reminder) => (
              <div key={reminder.id} className="reminder-row">
                <strong>{reminder.reminder_type.replace("_", " ")}</strong>
                <span>{new Date(reminder.scheduled_for).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import type { AppServices } from "./lib/services";

type CurrentUser = Awaited<ReturnType<AppServices["getCurrentSupabaseUser"]>>;
type CachedSeedSession = NonNullable<Awaited<ReturnType<AppServices["loadSeedSession"]>>>;
type DemoSeedResult = Awaited<ReturnType<AppServices["seedDemoDataForUser"]>>;

type DatabaseState = {
  prescriptions: Array<Record<string, any>>;
  medication_schedules: Array<Record<string, any>>;
  adherence_logs: Array<Record<string, any>>;
  reminder_events: Array<Record<string, any>>;
  chat_threads: Array<Record<string, any>>;
  chat_history_messages: Array<Record<string, any>>;
  care_visits: Array<Record<string, any>>;
  care_visit_prescriptions: Array<Record<string, any>>;
};

function createBaseState(): DatabaseState {
  return {
    prescriptions: [
      {
        id: "rx-1",
        patient_id: "user-1",
        raw_text: "Use with food",
        medication_name: "Metformin",
        dosage: "500 mg",
        frequency: "Twice daily",
        instructions: "Take with food",
        follow_up_recommendation: "Follow up in 2 weeks",
        created_at: "2026-03-14T10:00:00.000Z"
      },
      {
        id: "rx-2",
        patient_id: "user-1",
        raw_text: "At bedtime",
        medication_name: "Atorvastatin",
        dosage: "20 mg",
        frequency: "Once daily",
        instructions: "Take at bedtime",
        follow_up_recommendation: "Lipid panel in 30 days",
        created_at: "2026-03-15T10:00:00.000Z"
      }
    ],
    medication_schedules: [
      {
        id: "sched-1",
        prescription_id: "rx-2",
        frequency: "Once daily",
        dose_times: ["09:00"],
        created_at: "2026-03-15T10:05:00.000Z"
      },
      {
        id: "sched-2",
        prescription_id: "rx-1",
        frequency: "Twice daily",
        dose_times: ["08:00", "20:00"],
        created_at: "2026-03-14T10:05:00.000Z"
      }
    ],
    adherence_logs: [
      { id: "adh-1", prescription_id: "rx-2", dose_time: "2026-03-15T09:00:00.000Z", taken: true },
      { id: "adh-2", prescription_id: "rx-2", dose_time: "2026-03-16T09:00:00.000Z", taken: false },
      { id: "adh-3", prescription_id: "rx-1", dose_time: "2026-03-14T08:00:00.000Z", taken: true }
    ],
    reminder_events: [
      {
        id: "rem-1",
        prescription_id: "rx-2",
        reminder_type: "follow_up",
        scheduled_for: "2026-03-20T12:00:00.000Z",
        status: "pending"
      },
      {
        id: "rem-2",
        prescription_id: "rx-1",
        reminder_type: "dose",
        scheduled_for: "2026-03-15T20:00:00.000Z",
        status: "sent"
      }
    ],
    chat_threads: [
      {
        id: "thread-1",
        patient_id: "user-1",
        prescription_id: "rx-2",
        title: "Can I take this at night?",
        subtitle: "Yes, bedtime is appropriate.",
        created_at: "2026-03-15T08:00:00.000Z",
        updated_at: "2026-03-15T08:01:00.000Z"
      }
    ],
    chat_history_messages: [
      {
        id: "msg-1",
        thread_id: "thread-1",
        patient_id: "user-1",
        prescription_id: "rx-2",
        role: "assistant",
        message: "Yes, bedtime is appropriate.",
        created_at: "2026-03-15T08:01:00.000Z"
      },
      {
        id: "msg-2",
        thread_id: "thread-1",
        patient_id: "user-1",
        prescription_id: "rx-2",
        role: "user",
        message: "Can I take this at night?",
        created_at: "2026-03-15T08:00:00.000Z"
      }
    ],
    care_visits: [
      {
        id: "visit-1",
        patient_id: "user-1",
        visit_type: "Primary care",
        provider_name: "Dr. Rivera",
        location: "Austin Clinic",
        visit_date: "2026-03-15T07:30:00.000Z",
        summary: "Reviewed medications",
        next_steps: ["Lab follow-up"]
      }
    ],
    care_visit_prescriptions: [{ id: "cvp-1", visit_id: "visit-1", prescription_id: "rx-2" }]
  };
}

class MockSupabaseClient {
  storage = {
    from: (_bucket: string) => ({
      upload: async () => ({ data: { path: "mock" }, error: null })
    })
  };

  constructor(private readonly state: DatabaseState) {}

  from(table: keyof DatabaseState | "audit_logs") {
    return new QueryBuilder(this.state, table);
  }
}

class QueryBuilder {
  private mode: "select" | "insert" | "update" | "upsert" = "select";
  private filters: Array<{ type: "eq"; field: string; value: unknown } | { type: "in"; field: string; values: unknown[] }> = [];
  private orderBy: { field: string; ascending: boolean } | null = null;
  private limitBy: number | null = null;
  private payload: Record<string, any> | Array<Record<string, any>> | null = null;
  private selectOptions: { count?: "exact"; head?: boolean } | undefined;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(
    private readonly state: DatabaseState,
    private readonly table: keyof DatabaseState | "audit_logs"
  ) {}

  select(_columns?: string, options?: { count?: "exact"; head?: boolean }) {
    this.selectOptions = options;
    return this;
  }

  insert(payload: Record<string, any> | Array<Record<string, any>>) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, any>) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: Record<string, any> | Array<Record<string, any>>) {
    this.mode = "upsert";
    this.payload = payload;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ type: "eq", field, value });
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push({ type: "in", field, values });
    return this;
  }

  order(field: string, options: { ascending: boolean }) {
    this.orderBy = { field, ascending: options.ascending };
    return this;
  }

  limit(value: number) {
    this.limitBy = value;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this.execute();
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this.execute();
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (this.table === "audit_logs") {
      return { data: null, error: null };
    }

    if (this.mode === "insert") {
      const inserted = this.normalizePayload().map((row) => this.insertRow(row));
      return this.finish(inserted);
    }

    if (this.mode === "update") {
      const rows = this.getRows();
      const updatedRows = rows.map((row) => Object.assign(row, this.payload ?? {}));
      return this.finish(updatedRows);
    }

    if (this.mode === "upsert") {
      const upserted = this.normalizePayload().map((row) => this.insertRow(row));
      return this.finish(upserted);
    }

    return this.finish(this.selectRows());
  }

  private finish(rows: Array<Record<string, any>>) {
    if (this.selectOptions?.head) {
      return { data: null, error: null, count: rows.length };
    }

    if (this.singleMode === "single") {
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "not_found" } };
    }

    if (this.singleMode === "maybeSingle") {
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null, count: rows.length };
  }

  private normalizePayload() {
    return Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
  }

  private insertRow(row: Record<string, any>) {
    const id = row.id ?? `${String(this.table)}-${this.getRows().length + 1}`;
    const timestamp = new Date("2026-03-15T12:00:00.000Z").toISOString();
    const record = {
      ...row,
      id,
      created_at: row.created_at ?? timestamp,
      updated_at: row.updated_at ?? row.created_at ?? timestamp
    };
    this.getRows().push(record);
    return record;
  }

  private selectRows() {
    const rows = this.getRows().map((row) => this.projectRow(row));
    const filtered = rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.field] === filter.value;
        }
        return filter.values.includes(row[filter.field]);
      })
    );

    if (this.orderBy) {
      filtered.sort((left, right) => {
        const leftValue = left[this.orderBy!.field];
        const rightValue = right[this.orderBy!.field];
        const comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
        return this.orderBy!.ascending ? comparison : comparison * -1;
      });
    }

    if (this.limitBy !== null) {
      return filtered.slice(0, this.limitBy);
    }

    return filtered;
  }

  private projectRow(row: Record<string, any>) {
    if (this.table === "chat_threads") {
      return {
        ...row,
        messages: this.state.chat_history_messages.filter((message) => message.thread_id === row.id)
      };
    }

    if (this.table === "care_visit_prescriptions") {
      return {
        ...row,
        prescription: this.state.prescriptions.find((prescription) => prescription.id === row.prescription_id) ?? null
      };
    }

    return row;
  }

  private getRows() {
    return this.state[this.table as keyof DatabaseState];
  }
}

async function createHarness() {
  const state = createBaseState();
  const savedSessions: CachedSeedSession[] = [];
  const auditEvents: Array<Record<string, any>> = [];
  const seededUsers: Array<Record<string, any>> = [];
  const uploadedFiles: Array<Record<string, any>> = [];
  const extractedTexts: string[] = [];

  const usersByToken = new Map<string, CurrentUser>([
    ["good-token", { id: "user-1", email: "patient@example.com" } as CurrentUser],
    ["dev-token", { id: "user-1", email: "patient@example.com" } as CurrentUser]
  ]);

  const app = buildApp({
    askMedicationAssistant: (async ({ question, prescriptionId }) => ({
      response: `Answer for ${prescriptionId}: ${question}`,
      model: "mock-model",
      toolCalls: []
    })) as AppServices["askMedicationAssistant"],
    createSupabaseAdminClient: () => new MockSupabaseClient(state) as never,
    extractPrescription: async (text: string) => ({
      medicationName: text.includes("Lisinopril") ? "Lisinopril" : "Parsed Medication",
      dosage: "10 mg",
      frequency: "Once daily",
      instructions: "Take in the morning",
      followUpRecommendation: "Review in 30 days"
    }),
    extractTextFromUpload: async ({ providedText, fileBuffer }) => {
      const text = providedText?.trim() || fileBuffer?.toString("utf8") || "";
      extractedTexts.push(text);
      if (!text) {
        throw new Error("missing_prescription_content");
      }
      return text;
    },
    getCurrentSupabaseUser: (async (authorization?: string) => {
      const token = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
      const user = usersByToken.get(token);
      if (!user) {
        throw new Error("invalid_auth_token");
      }
      return user;
    }) as AppServices["getCurrentSupabaseUser"],
    loadSeedSession: (async () => savedSessions.at(-1) ?? null) as AppServices["loadSeedSession"],
    logAuditEvent: async (event) => {
      auditEvents.push(event);
    },
    maskPhi: (input) => input.replace("patient@example.com", "[email]"),
    saveSeedSession: async (session) => {
      savedSessions.push(session);
    },
    seedDemoDataForUser: (async (params) => {
      seededUsers.push(params);
      return {
        userId: params.userId,
        email: params.email ?? null,
        prescriptionId: "rx-seeded",
        scheduleId: null,
        counts: {
          prescriptions: 1,
          careVisits: 0,
          careVisitPrescriptions: 0,
          schedules: 0,
          adherenceLogs: 0,
          reminderEvents: 0,
          chatHistoryMessages: 0,
          guidanceDocuments: 0
        }
      } satisfies DemoSeedResult;
    }) as AppServices["seedDemoDataForUser"],
    uploadPrescriptionFile: async (params) => {
      uploadedFiles.push(params);
      return { bucket: "prescriptions", key: params.key };
    }
  });

  await app.ready();

  return { app, state, savedSessions, auditEvents, seededUsers, uploadedFiles, extractedTexts };
}

async function closeApp(app: FastifyInstance) {
  await app.close();
}

function registerCleanup(t: TestContext, app: FastifyInstance) {
  t.after(async () => {
    await closeApp(app);
  });
}

test("GET /health returns ok", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

test("GET /v1/auth/me returns current user", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { id: "user-1", email: "patient@example.com" });
});

test("POST /v1/auth/dev-session caches the dev session", async (t) => {
  const { app, savedSessions } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/dev-session",
    payload: { accessToken: "dev-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(savedSessions.length, 1);
  assert.equal(savedSessions[0].accessToken, "dev-token");
});

test("GET /v1/auth/dev-session returns the cached session", async (t) => {
  const { app, savedSessions } = await createHarness();
  registerCleanup(t, app);
  savedSessions.push({
    accessToken: "dev-token",
    userId: "user-1",
    email: "patient@example.com",
    updatedAt: "2026-03-15T12:00:00.000Z"
  });

  const response = await app.inject({ method: "GET", url: "/v1/auth/dev-session" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().userId, "user-1");
});

test("POST /v1/demo/seed seeds demo data for the current user", async (t) => {
  const { app, seededUsers } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "POST",
    url: "/v1/demo/seed",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().userId, "user-1");
  assert.deepEqual(seededUsers, [{ userId: "user-1", email: "patient@example.com" }]);
});

test("GET /v1/prescriptions returns the patient's prescriptions", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/prescriptions",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().length, 2);
});

test("GET /v1/prescriptions/latest returns the most recent prescription", async (t) => {
  const { app, auditEvents } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/prescriptions/latest",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, "rx-2");
  assert.equal(auditEvents[0].action, "view_prescription");
});

test("POST /v1/prescriptions/ingest stores a parsed prescription", async (t) => {
  const { app, state, uploadedFiles, extractedTexts, auditEvents } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "POST",
    url: "/v1/prescriptions/ingest",
    payload: {
      patientId: "user-1",
      actorId: "user-1",
      fileName: "rx.txt",
      fileBase64: Buffer.from("Lisinopril for patient@example.com").toString("base64")
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().medication_name, "Lisinopril");
  assert.equal(uploadedFiles.length, 1);
  assert.equal(extractedTexts[0], "Lisinopril for patient@example.com");
  assert.equal(state.prescriptions.length, 3);
  assert.equal(state.prescriptions[2].raw_text, "Lisinopril for [email]");
  assert.equal(auditEvents[0].action, "upload_prescription");
});

test("GET /v1/prescriptions/:id returns the requested prescription", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/prescriptions/rx-1?actorId=caregiver-1"
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, "rx-1");
});

test("GET /v1/chat/history returns sorted messages", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/chat/history?prescriptionId=rx-2",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  const [thread] = response.json();
  assert.equal(thread.messages[0].role, "user");
  assert.equal(thread.messages[1].role, "assistant");
});

test("POST /v1/chat creates a thread and persists messages", async (t) => {
  const { app, state, auditEvents } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "POST",
    url: "/v1/chat",
    headers: { authorization: "Bearer good-token" },
    payload: {
      question: "When should I take this?",
      prescriptionId: "rx-2"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().threadId, "chat_threads-2");
  assert.equal(state.chat_threads.length, 2);
  assert.equal(state.chat_history_messages.length, 4);
  assert.equal(auditEvents[0].action, "ai_query");
});

test("GET /v1/schedule returns medication schedule items", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/schedule",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 2);
  assert.equal(response.json().items[0].doseTimes[0], "09:00");
});

test("GET /v1/dashboard returns a dashboard summary", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/dashboard",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    activePrescriptions: 2,
    nextMedicationDose: "09:00",
    followUpReminders: 1,
    adherenceScore: 50,
    flagForAttention: true,
    latestPrescriptionId: "rx-2"
  });
});

test("POST /v1/schedules/generate creates a schedule", async (t) => {
  const { app, state } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "POST",
    url: "/v1/schedules/generate",
    payload: {
      prescriptionId: "rx-1",
      frequency: "Twice daily"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().dose_times, ["08:00", "20:00"]);
  assert.equal(state.medication_schedules.length, 3);
});

test("POST /v1/schedules/adherence records a dose event", async (t) => {
  const { app, state } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "POST",
    url: "/v1/schedules/adherence",
    payload: {
      prescriptionId: "rx-1",
      doseTime: "2026-03-16T08:00:00.000Z",
      taken: true
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(state.adherence_logs.length, 4);
  assert.deepEqual(response.json(), {
    prescriptionId: "rx-1",
    adherenceScore: 100,
    flagForAttention: false
  });
});

test("GET /v1/schedules/adherence/:prescriptionId returns the adherence summary", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/schedules/adherence/rx-2"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    prescriptionId: "rx-2",
    adherenceScore: 50,
    flagForAttention: true
  });
});

test("GET /v1/care returns care visits with linked prescriptions", async (t) => {
  const { app } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "GET",
    url: "/v1/care",
    headers: { authorization: "Bearer good-token" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().visits.length, 1);
  assert.equal(response.json().visits[0].prescriptions[0].id, "rx-2");
});

test("POST /v1/reminders/events creates a reminder event", async (t) => {
  const { app, state } = await createHarness();
  registerCleanup(t, app);

  const response = await app.inject({
    method: "POST",
    url: "/v1/reminders/events",
    payload: {
      prescriptionId: "rx-2",
      reminderType: "refill",
      scheduledFor: "2026-03-18T12:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().reminder_type, "refill");
  assert.equal(state.reminder_events.length, 3);
});

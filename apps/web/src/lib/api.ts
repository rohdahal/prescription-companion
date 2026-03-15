const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function syncDevSeedSession(accessToken: string) {
  await fetch(`${apiBaseUrl}/v1/auth/dev-session`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      accessToken
    })
  });
}

export async function fetchCurrentAuthUser(accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/auth/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("current_user_failed");
  }

  return response.json() as Promise<{ id: string; email: string | null }>;
}

export async function fetchChatHistory(accessToken: string, prescriptionId: string) {
  const response = await fetch(`${apiBaseUrl}/v1/chat/history?prescriptionId=${encodeURIComponent(prescriptionId)}`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("chat_history_failed");
  }

  return response.json() as Promise<
    Array<{
      id: string;
      title: string;
      subtitle: string | null;
      created_at: string;
      updated_at: string;
      messages: Array<{ id: string; role: "user" | "assistant"; message: string; created_at: string }>;
    }>
  >;
}

export async function fetchDashboard(accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/dashboard`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("dashboard_failed");
  }

  return response.json() as Promise<{
    activePrescriptions: number;
    nextMedicationDose: string | null;
    followUpReminders: number;
    adherenceScore: number;
    flagForAttention: boolean;
    latestPrescriptionId: string | null;
  }>;
}

export async function fetchPrescriptions(accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/prescriptions`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("prescriptions_failed");
  }

  return response.json() as Promise<
    Array<{
      id: string;
      medication_name: string;
      dosage: string;
      frequency: string;
      instructions: string;
      created_at: string;
    }>
  >;
}

export async function fetchSchedule(accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/schedule`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("schedule_failed");
  }

  return response.json() as Promise<{
    items: Array<{
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
    }>;
  }>;
}

export async function fetchCare(accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/care`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("care_failed");
  }

  return response.json() as Promise<{
    visits: Array<{
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
    }>;
  }>;
}

export async function fetchLatestPrescription(accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/v1/prescriptions/latest`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("latest_prescription_failed");
  }

  return response.json();
}

export async function fetchPrescription(id: string) {
  const response = await fetch(`${apiBaseUrl}/v1/prescriptions/${encodeURIComponent(id)}?actorId=demo`, {
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function askAssistant(
  question: string,
  prescriptionId: string,
  accessToken: string,
  threadId?: string | null,
  actorId = "demo-user"
) {
  const response = await fetch(`${apiBaseUrl}/v1/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      actorId,
      question,
      prescriptionId,
      threadId
    })
  });

  if (!response.ok) {
    throw new Error("chat_failed");
  }

  return response.json();
}

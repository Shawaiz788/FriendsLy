import type { IntentPreferences } from "@/modules/intent-aura/services/intentPreferences";

const API_BASE = "http://localhost:3001";

export async function getMyIntentPreferences(token: string) {
  const res = await fetch(`${API_BASE}/api/user/intent-preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const responseText = await res.text();
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      data: null,
      error: responseText || `Request failed with status ${res.status}`,
    };
  }
}

export async function upsertMyIntentPreferences(preferences: IntentPreferences, token: string) {
  const res = await fetch(`${API_BASE}/api/user/intent-preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      active_intent: preferences.activeIntent,
      enabled_intents: preferences.enabledIntents,
      inner_radius_km: preferences.innerRadiusKm,
      outer_radius_km: preferences.outerRadiusKm,
      auto_expire: preferences.autoExpire,
    }),
  });

  const responseText = await res.text();
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: responseText || `Request failed with status ${res.status}`,
    };
  }
}

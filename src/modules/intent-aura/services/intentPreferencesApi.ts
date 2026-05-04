import type { IntentPreferences } from "@/modules/intent-aura/services/intentPreferences";
import { API_BASE } from "@/lib/apiBase";

export async function getMyIntentPreferences(token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/user/intent-preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const responseText = await res.text();
    
    if (!res.ok) {
      console.error(`Intent preferences API error (${res.status}):`, responseText);
    }
    
    try {
      return JSON.parse(responseText);
    } catch {
      return {
        data: null,
        error: responseText || `Request failed with status ${res.status}`,
      };
    }
  } catch (err) {
    console.error('Intent preferences fetch error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error fetching intent preferences',
    };
  }
}

export async function upsertMyIntentPreferences(preferences: IntentPreferences, token: string) {
  try {
    const sanitizedActive = Array.isArray(preferences.activeIntents)
      ? preferences.activeIntents.filter((v): v is string => typeof v === "string")
      : [];

    if (sanitizedActive.length === 0) {
      console.error('Cannot upsert intent preferences: activeIntents is empty or invalid', preferences);
      return {
        success: false,
        error: 'active_intents must be a non-empty array of strings',
      };
    }

    const payload = {
      active_intents: sanitizedActive,
      enabled_intents: sanitizedActive,
      inner_radius_km: preferences.innerRadiusKm,
      outer_radius_km: preferences.outerRadiusKm,
      auto_expire: preferences.autoExpire,
    };

    const res = await fetch(`${API_BASE}/api/user/intent-preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    
    if (!res.ok) {
      console.error(`Upsert intent preferences API error (${res.status}):`, responseText);
    }
    
    try {
      return JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: responseText || `Request failed with status ${res.status}`,
      };
    }
  } catch (err) {
    console.error('Upsert intent preferences fetch error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error updating intent preferences',
    };
  }
}

export interface IntentPreferences {
  activeIntents: string[];
  innerRadiusKm: number;
  outerRadiusKm: number;
  autoExpire: boolean;
}

const STORAGE_KEY = "friendsly.intentPreferences";

export const DEFAULT_INTENT_PREFERENCES: IntentPreferences = {
  activeIntents: ["Free"],
  innerRadiusKm: 1,
  outerRadiusKm: 5,
  autoExpire: true,
};

const coerceNumber = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return value;
};

export const loadIntentPreferences = (): IntentPreferences => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_INTENT_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<IntentPreferences>;
    const parsedActiveIntents = Array.isArray(parsed.activeIntents)
      ? parsed.activeIntents.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [];
    const activeIntents = parsedActiveIntents.length
      ? parsedActiveIntents
      : DEFAULT_INTENT_PREFERENCES.activeIntents;

    return {
      activeIntents,
      innerRadiusKm: coerceNumber(parsed.innerRadiusKm, DEFAULT_INTENT_PREFERENCES.innerRadiusKm),
      outerRadiusKm: coerceNumber(parsed.outerRadiusKm, DEFAULT_INTENT_PREFERENCES.outerRadiusKm),
      autoExpire:
        typeof parsed.autoExpire === "boolean" ? parsed.autoExpire : DEFAULT_INTENT_PREFERENCES.autoExpire,
    };
  } catch {
    return DEFAULT_INTENT_PREFERENCES;
  }
};

export const saveIntentPreferences = (preferences: IntentPreferences) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent("intent-preferences-updated", {
      detail: preferences,
    }),
  );
};

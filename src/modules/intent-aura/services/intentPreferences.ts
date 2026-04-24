export interface IntentPreferences {
  activeIntent: string;
  enabledIntents: string[];
  innerRadiusKm: number;
  outerRadiusKm: number;
  autoExpire: boolean;
}

const STORAGE_KEY = "friendsly.intentPreferences";

export const DEFAULT_INTENT_PREFERENCES: IntentPreferences = {
  activeIntent: "Free",
  enabledIntents: ["Free", "Busy", "Studying", "Hungry", "Working", "Exercising", "Just Chilling"],
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
    const enabledIntents = Array.isArray(parsed.enabledIntents)
      ? parsed.enabledIntents.filter((value): value is string => typeof value === "string")
      : DEFAULT_INTENT_PREFERENCES.enabledIntents;

    return {
      activeIntent:
        typeof parsed.activeIntent === "string" && parsed.activeIntent.trim()
          ? parsed.activeIntent
          : DEFAULT_INTENT_PREFERENCES.activeIntent,
      enabledIntents,
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
};

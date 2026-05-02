export interface AuraPreferences {
  color: string;
  emoji: string;
  glow: "none" | "subtle" | "medium" | "strong";
}

const STORAGE_KEY = "friendsly.auraPreferences";

export const DEFAULT_AURA_PREFERENCES: AuraPreferences = {
  color: "#8b5cf6", // violet
  emoji: "✨",
  glow: "medium",
};

export const AURA_COLORS = [
  { label: "Violet", value: "#8b5cf6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Emerald", value: "#10b981" },
  { label: "Lime", value: "#84cc16" },
  { label: "Yellow", value: "#eab308" },
  { label: "Orange", value: "#f97316" },
  { label: "Red", value: "#ef4444" },
  { label: "Pink", value: "#ec4899" },
  { label: "Rose", value: "#f43f5e" },
];

export const AURA_EMOJIS = [
  "✨",
  "🌟",
  "⭐",
  "💫",
  "🌠",
  "🔮",
  "💎",
  "🎇",
  "🎆",
  "⚡",
  "🔥",
  "💥",
  "✨",
  "🌈",
  "🦋",
  "🌸",
  "🌺",
  "🌻",
  "🌷",
  "🌹",
  "🎨",
  "🎭",
  "🎪",
  "🎯",
];

export const GLOW_OPTIONS = [
  { label: "None", value: "none" as const },
  { label: "Subtle", value: "subtle" as const },
  { label: "Medium", value: "medium" as const },
  { label: "Strong", value: "strong" as const },
];

export const getGlowStyles = (glow: "none" | "subtle" | "medium" | "strong", color: string) => {
  const styles: Record<string, string> = {
    none: "",
    subtle: `0 0 10px ${color}40`,
    medium: `0 0 20px ${color}60, 0 0 30px ${color}40`,
    strong: `0 0 30px ${color}80, 0 0 50px ${color}60`,
  };
  return styles[glow] || styles.medium;
};

export const loadAuraPreferences = (): AuraPreferences => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_AURA_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<AuraPreferences>;
    return {
      color: typeof parsed.color === "string" && parsed.color.match(/^#[0-9A-F]{6}$/i) ? parsed.color : DEFAULT_AURA_PREFERENCES.color,
      emoji: typeof parsed.emoji === "string" && parsed.emoji.length > 0 ? parsed.emoji : DEFAULT_AURA_PREFERENCES.emoji,
      glow:
        typeof parsed.glow === "string" && ["none", "subtle", "medium", "strong"].includes(parsed.glow)
          ? (parsed.glow as "none" | "subtle" | "medium" | "strong")
          : DEFAULT_AURA_PREFERENCES.glow,
    };
  } catch {
    return DEFAULT_AURA_PREFERENCES;
  }
};

export const saveAuraPreferences = (preferences: AuraPreferences) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

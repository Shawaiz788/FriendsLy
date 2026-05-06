export type NotificationPreferences = {
  messages: boolean;
  hangoutInvites: boolean;
  friendRequests: boolean;
};

const NOTIFICATION_PREFERENCES_KEY = "notificationPreferences";
const NOTIFICATION_QUIET_HOURS_KEY = "notificationQuietHours";
const NOTIFICATION_PREFS_BEFORE_QUIET_KEY = "notificationPrefsBeforeQuiet";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  hangoutInvites: true,
  friendRequests: true,
};

export function loadNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_NOTIFICATION_PREFERENCES };

  try {
    const raw = window.localStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      messages: typeof parsed.messages === "boolean" ? parsed.messages : DEFAULT_NOTIFICATION_PREFERENCES.messages,
      hangoutInvites:
        typeof parsed.hangoutInvites === "boolean"
          ? parsed.hangoutInvites
          : DEFAULT_NOTIFICATION_PREFERENCES.hangoutInvites,
      friendRequests:
        typeof parsed.friendRequests === "boolean"
          ? parsed.friendRequests
          : DEFAULT_NOTIFICATION_PREFERENCES.friendRequests,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export function saveNotificationPreferences(preferences: NotificationPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function loadQuietHours(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.localStorage.getItem(NOTIFICATION_QUIET_HOURS_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

export function saveQuietHours(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATION_QUIET_HOURS_KEY, value ? "true" : "false");
}

export function savePreferencesBeforeQuiet(preferences: NotificationPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATION_PREFS_BEFORE_QUIET_KEY, JSON.stringify(preferences));
}

export function loadPreferencesBeforeQuiet(): NotificationPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_PREFS_BEFORE_QUIET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      messages: typeof parsed.messages === "boolean" ? parsed.messages : DEFAULT_NOTIFICATION_PREFERENCES.messages,
      hangoutInvites:
        typeof parsed.hangoutInvites === "boolean"
          ? parsed.hangoutInvites
          : DEFAULT_NOTIFICATION_PREFERENCES.hangoutInvites,
      friendRequests:
        typeof parsed.friendRequests === "boolean"
          ? parsed.friendRequests
          : DEFAULT_NOTIFICATION_PREFERENCES.friendRequests,
    };
  } catch {
    return null;
  }
}

export function clearPreferencesBeforeQuiet() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(NOTIFICATION_PREFS_BEFORE_QUIET_KEY);
}

import { useEffect, useState, useCallback } from "react";
import {
  AuraPreferences,
  loadAuraPreferences,
  saveAuraPreferences,
} from "@/modules/intent-aura/services/auraPreferences";

export const useAuraPreferences = () => {
  const [auraPreferences, setAuraPreferences] = useState<AuraPreferences | null>(null);

  useEffect(() => {
    const prefs = loadAuraPreferences();
    setAuraPreferences(prefs);

    // Listen for storage changes (e.g., from other tabs)
    const handleStorageChange = () => {
      const updated = loadAuraPreferences();
      setAuraPreferences(updated);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const updateAuraPreferences = useCallback((prefs: AuraPreferences) => {
    saveAuraPreferences(prefs);
    setAuraPreferences(prefs);
  }, []);

  return { auraPreferences, updateAuraPreferences };
};

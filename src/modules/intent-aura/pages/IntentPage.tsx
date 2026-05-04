import { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import IntentBadge from "@/components/IntentBadge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import AuraCustomizer from "@/modules/intent-aura/components/AuraCustomizer";
import {
  loadIntentPreferences,
  saveIntentPreferences,
  type IntentPreferences,
} from "@/modules/intent-aura/services/intentPreferences";
import {
  getMyIntentPreferences,
  upsertMyIntentPreferences,
} from "@/modules/intent-aura/services/intentPreferencesApi";

const allIntents = [
  { label: "Free", emoji: "✌️" },
  { label: "Busy", emoji: "💼" },
  { label: "Studying", emoji: "📚" },
  { label: "Hungry", emoji: "🍕" },
  { label: "Working", emoji: "💻" },
  { label: "Exercising", emoji: "🏃" },
  { label: "Just Chilling", emoji: "😎" },
];

const IntentPage = () => {
  const initialPreferences = useMemo(() => loadIntentPreferences(), []);
  const [activeIntents, setActiveIntents] = useState(initialPreferences.activeIntents);
  const [innerRadius, setInnerRadius] = useState([initialPreferences.innerRadiusKm]);
  const [outerRadius, setOuterRadius] = useState([initialPreferences.outerRadiusKm]);
  const [autoExpire, setAutoExpire] = useState(initialPreferences.autoExpire);
  const [token, setToken] = useState("");
  const hasHydratedFromBackend = useRef(false);
  const hasLocalChanges = useRef(false);

  const toggleActiveIntent = (label: string) => {
    hasLocalChanges.current = true;
    setActiveIntents((prev) => {
      if (prev.length === 1 && prev[0] === label) return prev;
      return [label];
    });
  };



  useEffect(() => {
    setToken(localStorage.getItem("supabaseToken") || "");
  }, []);

  useEffect(() => {
    if (!token) {
      hasHydratedFromBackend.current = true;
      return;
    }

    const loadFromBackend = async () => {
      const result = await getMyIntentPreferences(token);
      if (result?.data && !hasLocalChanges.current) {
        setActiveIntents(result.data.active_intents || initialPreferences.activeIntents);
        setInnerRadius([result.data.inner_radius_km ?? initialPreferences.innerRadiusKm]);
        setOuterRadius([result.data.outer_radius_km ?? initialPreferences.outerRadiusKm]);
        setAutoExpire(
          typeof result.data.auto_expire === "boolean"
            ? result.data.auto_expire
            : initialPreferences.autoExpire,
        );
      }
      hasHydratedFromBackend.current = true;
    };

    void loadFromBackend();
  }, [token]);

  useEffect(() => {
    const nextPreferences: IntentPreferences = {
      activeIntents,
      innerRadiusKm: innerRadius[0],
      outerRadiusKm: outerRadius[0],
      autoExpire,
    };
    saveIntentPreferences(nextPreferences);
    if (!token || !hasHydratedFromBackend.current) return;

    const timer = window.setTimeout(() => {
      void upsertMyIntentPreferences(nextPreferences, token);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIntents, autoExpire, innerRadius, outerRadius, token]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Intent & Aura</h1>
        <p className="text-muted-foreground text-sm mb-6">Control how you appear to friends</p>

        {/* Aura Customization */}
        <AuraCustomizer />

        {/* Current Intent */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
            Current Intent
          </p>
          <div className="flex flex-wrap gap-2">
            {allIntents.map((intent) => (
              <IntentBadge
                key={intent.label}
                label={intent.label}
                emoji={intent.emoji}
                active={activeIntents.includes(intent.label)}
                onClick={() => toggleActiveIntent(intent.label)}
              />
            ))}
          </div>
        </div>



        {/* Radius Controls */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">
            Dual Radius Control
          </p>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-medium">Inner Radius (min)</span>
                <span className="text-primary font-semibold">{innerRadius[0]} km</span>
              </div>
              <Slider
                value={innerRadius}
                onValueChange={(value) => {
                  hasLocalChanges.current = true;
                  setInnerRadius(value);
                }}
                min={0}
                max={10}
                step={0.5}
                className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Friends closer than this won't trigger alerts</p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-medium">Outer Radius (max)</span>
                <span className="text-secondary font-semibold">{outerRadius[0]} km</span>
              </div>
              <Slider
                value={outerRadius}
                onValueChange={(value) => {
                  hasLocalChanges.current = true;
                  setOuterRadius(value);
                }}
                min={1}
                max={20}
                step={0.5}
                className="[&_[role=slider]]:bg-secondary [&_[role=slider]]:border-secondary"
              />
              <p className="text-xs text-muted-foreground mt-1">Max distance you'd travel for a meetup</p>
            </div>
          </div>
        </div>

        {/* Auto expire */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-expire intent</p>
              <p className="text-xs text-muted-foreground">Intent resets after 1 hour</p>
            </div>
            <Switch
              checked={autoExpire}
              onCheckedChange={(value) => {
                hasLocalChanges.current = true;
                setAutoExpire(value);
              }}
            />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default IntentPage;

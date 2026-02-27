import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import IntentBadge from "@/components/IntentBadge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

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
  const [activeIntent, setActiveIntent] = useState("Free");
  const [enabledIntents, setEnabledIntents] = useState(
    allIntents.map((i) => i.label)
  );
  const [innerRadius, setInnerRadius] = useState([1]);
  const [outerRadius, setOuterRadius] = useState([5]);
  const [autoExpire, setAutoExpire] = useState(true);

  const toggleEnabled = (label: string) => {
    setEnabledIntents((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Intent & Radius</h1>
        <p className="text-muted-foreground text-sm mb-6">Control how you appear to friends</p>

        {/* Current Intent */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
            Current Intent
          </p>
          <div className="flex flex-wrap gap-2">
            {allIntents
              .filter((i) => enabledIntents.includes(i.label))
              .map((intent) => (
                <IntentBadge
                  key={intent.label}
                  label={intent.label}
                  emoji={intent.emoji}
                  active={activeIntent === intent.label}
                  onClick={() => setActiveIntent(intent.label)}
                />
              ))}
          </div>
        </div>

        {/* Enable/Disable intents */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
            Enabled Intents
          </p>
          <div className="space-y-3">
            {allIntents.map((intent) => (
              <div key={intent.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <span>{intent.emoji}</span>
                  {intent.label}
                </span>
                <Switch
                  checked={enabledIntents.includes(intent.label)}
                  onCheckedChange={() => toggleEnabled(intent.label)}
                />
              </div>
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
                onValueChange={setInnerRadius}
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
                onValueChange={setOuterRadius}
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
            <Switch checked={autoExpire} onCheckedChange={setAutoExpire} />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default IntentPage;

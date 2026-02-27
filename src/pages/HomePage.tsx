import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import RadiusRing from "@/components/RadiusRing";
import IntentBadge from "@/components/IntentBadge";
import SuggestionCard from "@/components/SuggestionCard";
import { Ghost } from "lucide-react";
import { cn } from "@/lib/utils";

const intents = [
  { label: "Free", emoji: "✌️" },
  { label: "Studying", emoji: "📚" },
  { label: "Hungry", emoji: "🍕" },
  { label: "Chilling", emoji: "😎" },
];

const HomePage = () => {
  const [activeIntent, setActiveIntent] = useState("Free");
  const [ghostMode, setGhostMode] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good afternoon</p>
          <h1 className="font-serif text-2xl font-bold text-foreground">Hey there 👋</h1>
        </div>
        <button
          onClick={() => setGhostMode(!ghostMode)}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            ghostMode ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
          )}
          title="Ghost Mode"
        >
          <Ghost className="w-5 h-5" />
        </button>
      </div>

      {/* Current intent */}
      <div className="px-6 py-4">
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">Your intent</p>
        <div className="flex flex-wrap gap-2">
          {intents.map((intent) => (
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

      {/* Radius Ring */}
      <div className="flex justify-center py-6">
        <RadiusRing />
      </div>

      {/* Suggestions */}
      <div className="px-6 space-y-3">
        <h2 className="font-serif text-lg font-semibold text-foreground">Suggested Hangouts</h2>
        <SuggestionCard
          friendName="Sara"
          intent="Free"
          reason="You and Sara are within your 2–5km radius and both marked as 'Free'."
        />
        <SuggestionCard
          friendName="Ali"
          intent="Studying"
          reason="You and Ali are nearby. Ali is also 'Studying' – start a study session?"
        />
      </div>

      <BottomNav />
    </div>
  );
};

export default HomePage;

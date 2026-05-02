import { useAuraPreferences } from "@/hooks/useAuraPreferences";
import { getGlowStyles } from "@/modules/intent-aura/services/auraPreferences";

interface AuraDisplayProps {
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
  label?: string;
}

const sizeClasses = {
  small: "text-2xl",
  medium: "text-4xl",
  large: "text-6xl",
};

const AuraDisplay = ({ size = "medium", showLabel = false, label }: AuraDisplayProps) => {
  const { auraPreferences } = useAuraPreferences();

  if (!auraPreferences) {
    return null;
  }

  const glowShadow = getGlowStyles(auraPreferences.glow, auraPreferences.color);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`${sizeClasses[size]} transition-all duration-300`}
        style={{
          textShadow: glowShadow,
          filter: auraPreferences.glow !== "none" ? `drop-shadow(${glowShadow})` : "none",
        }}
      >
        {auraPreferences.emoji}
      </div>
      {showLabel && label && (
        <p className="text-sm font-medium text-foreground">{label}</p>
      )}
    </div>
  );
};

export default AuraDisplay;

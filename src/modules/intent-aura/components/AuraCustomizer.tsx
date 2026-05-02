import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AuraPreferences,
  AURA_COLORS,
  AURA_EMOJIS,
  GLOW_OPTIONS,
  loadAuraPreferences,
  saveAuraPreferences,
  getGlowStyles,
} from "@/modules/intent-aura/services/auraPreferences";

const AuraCustomizer = () => {
  const initialPreferences = useMemo(() => loadAuraPreferences(), []);
  const [color, setColor] = useState(initialPreferences.color);
  const [emoji, setEmoji] = useState(initialPreferences.emoji);
  const [glow, setGlow] = useState(initialPreferences.glow);

  const handleSave = () => {
    const preferences: AuraPreferences = { color, emoji, glow };
    saveAuraPreferences(preferences);
  };

  const glowShadow = getGlowStyles(glow, color);

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">
        Aura Customization
      </p>

      {/* Aura Preview */}
      <div className="flex items-center justify-center mb-6 py-6">
        <div
          className="text-6xl transition-all duration-300"
          style={{
            textShadow: glowShadow,
            filter: glow !== "none" ? `drop-shadow(${glowShadow})` : "none",
          }}
        >
          {emoji}
        </div>
      </div>

      {/* Color Selection */}
      <div className="mb-4">
        <label className="text-sm font-medium text-foreground block mb-2">Aura Color</label>
        <div className="grid grid-cols-5 gap-2">
          {AURA_COLORS.map((colorOption) => (
            <button
              key={colorOption.value}
              onClick={() => setColor(colorOption.value)}
              className={`w-full aspect-square rounded-lg transition-all border-2 ${
                color === colorOption.value ? "border-foreground" : "border-muted"
              }`}
              style={{ backgroundColor: colorOption.value }}
              title={colorOption.label}
            />
          ))}
        </div>
      </div>

      {/* Emoji Selection */}
      <div className="mb-4">
        <label className="text-sm font-medium text-foreground block mb-2">Aura Emoji</label>
        <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto bg-muted/30 rounded-lg p-3">
          {AURA_EMOJIS.map((emojiOption) => (
            <button
              key={emojiOption}
              onClick={() => setEmoji(emojiOption)}
              className={`text-2xl p-2 rounded transition-all ${
                emoji === emojiOption
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {emojiOption}
            </button>
          ))}
        </div>
      </div>

      {/* Glow Effect Selection */}
      <div className="mb-4">
        <label className="text-sm font-medium text-foreground block mb-2">Glow Effect</label>
        <Select value={glow} onValueChange={(value: any) => setGlow(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select glow effect" />
          </SelectTrigger>
          <SelectContent>
            {GLOW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        className="w-full"
        variant="default"
      >
        Save Aura Customization
      </Button>
    </div>
  );
};

export default AuraCustomizer;

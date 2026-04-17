import { cn } from "@/lib/utils";

interface IntentBadgeProps {
  label: string;
  emoji: string;
  active?: boolean;
  onClick?: () => void;
}

const IntentBadge = ({ label, emoji, active = false, onClick }: IntentBadgeProps) => (
  <button
    onClick={onClick}
    className={cn(
      "intent-badge",
      active ? "intent-badge-active" : "intent-badge-inactive"
    )}
  >
    <span>{emoji}</span>
    <span>{label}</span>
  </button>
);

export default IntentBadge;

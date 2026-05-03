import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BellOff, Info, MessageCircle } from "lucide-react";

interface SuggestionCardProps {
  userId: string;
  friendName: string;
  intent: string;
  reason: string;
  onStartHangout: (userId: string) => void;
  onMessage: (userId: string) => void;
  onSnooze: (userId: string, durationMs: number) => void;
  onCancel: (userId: string) => void;
  isStarting?: boolean;
}

const SNOOZE_PRESETS: { label: string; ms: number }[] = [
  { label: "30 minutes", ms: 30 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "4 hours", ms: 4 * 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
];

const SuggestionCard = ({
  userId,
  friendName,
  intent,
  reason,
  onStartHangout,
  onMessage,
  onSnooze,
  onCancel,
  isStarting = false,
}: SuggestionCardProps) => (
  <div className="glass-card rounded-2xl p-5 space-y-3 animate-float-in">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-serif font-semibold text-lg text-foreground">
          {friendName} is nearby!
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Also marked as "{intent}"
        </p>
      </div>
      <button
        type="button"
        onClick={() => onMessage(userId)}
        className="shrink-0 w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary hover:bg-secondary/30 transition-colors"
        aria-label={`Message ${friendName}`}
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    </div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
      <Info className="w-3.5 h-3.5 shrink-0" />
      <span>{reason}</span>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="hero" size="sm" className="min-w-[120px] flex-1" onClick={() => onStartHangout(userId)} disabled={isStarting}>
        {isStarting ? "Starting..." : "Start Hangout"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" type="button" className="gap-1">
            <BellOff className="w-4 h-4" />
            Snooze
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          {SNOOZE_PRESETS.map(({ label, ms }) => (
            <DropdownMenuItem key={label} onClick={() => onSnooze(userId, ms)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="soft" size="sm" type="button" onClick={() => onCancel(userId)}>
        Cancel
      </Button>
    </div>
  </div>
);

export default SuggestionCard;

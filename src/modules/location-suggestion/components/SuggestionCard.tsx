import { Button } from "@/components/ui/button";
import { Info, MessageCircle } from "lucide-react";

interface SuggestionCardProps {
  userId: string;
  friendName: string;
  intent: string;
  reason: string;
  onStartHangout: (userId: string) => void;
  onLater?: (userId: string) => void;
  isStarting?: boolean;
}

const SuggestionCard = ({
  userId,
  friendName,
  intent,
  reason,
  onStartHangout,
  onLater,
  isStarting = false,
}: SuggestionCardProps) => (
  <div className="glass-card rounded-2xl p-5 space-y-3 animate-float-in">
    <div className="flex items-start justify-between">
      <div>
        <p className="font-serif font-semibold text-lg text-foreground">
          {friendName} is nearby!
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Also marked as "{intent}"
        </p>
      </div>
      <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
        <MessageCircle className="w-5 h-5" />
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
      <Info className="w-3.5 h-3.5 shrink-0" />
      <span>{reason}</span>
    </div>
    <div className="flex gap-2">
      <Button variant="hero" size="sm" className="flex-1" onClick={() => onStartHangout(userId)} disabled={isStarting}>
        {isStarting ? "Starting..." : "Start Hangout"}
      </Button>
      <Button variant="soft" size="sm" onClick={() => onLater?.(userId)}>
        Later
      </Button>
    </div>
  </div>
);

export default SuggestionCard;

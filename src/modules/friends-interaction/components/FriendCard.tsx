import { cn } from "@/lib/utils";

interface FriendCardProps {
  name: string;
  intent: string;
  presence: "nearby" | "city" | "away";
  avatar?: string;
}

const presenceLabels: Record<string, string> = {
  nearby: "Nearby",
  city: "In City",
  away: "Out of Range",
};

const FriendCard = ({ name, intent, presence }: FriendCardProps) => (
  <div className="glass-card rounded-2xl p-4 flex items-center gap-4 animate-float-in">
    <div className={cn(
      "w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold",
      presence === "nearby" ? "bg-primary text-primary-foreground" :
      presence === "city" ? "bg-secondary text-secondary-foreground" :
      "bg-muted text-muted-foreground"
    )}>
      {name[0]}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-foreground truncate">{name}</p>
      <p className="text-sm text-muted-foreground">{intent}</p>
    </div>
    <div className="text-right">
      <span className={cn(
        "text-xs font-medium px-2 py-1 rounded-full",
        presence === "nearby" ? "bg-primary/10 presence-nearby" :
        presence === "city" ? "bg-secondary/10 presence-city" :
        "bg-muted presence-away"
      )}>
        {presenceLabels[presence]}
      </span>
    </div>
  </div>
);

export default FriendCard;

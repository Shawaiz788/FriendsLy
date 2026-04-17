import { cn } from "@/lib/utils";

interface Friend {
  name: string;
  intent: string;
  presence: "nearby" | "city" | "away";
  angle: number;
  distance: number;
}

const mockFriends: Friend[] = [
  { name: "Sara", intent: "Free", presence: "nearby", angle: 45, distance: 0.35 },
  { name: "Ali", intent: "Studying", presence: "nearby", angle: 160, distance: 0.45 },
  { name: "Mia", intent: "Hungry", presence: "city", angle: 250, distance: 0.7 },
  { name: "Zain", intent: "Busy", presence: "away", angle: 320, distance: 0.9 },
];

const presenceColors: Record<string, string> = {
  nearby: "bg-primary shadow-lg shadow-primary/30",
  city: "bg-secondary shadow-lg shadow-secondary/30",
  away: "bg-muted-foreground/40",
};

const RadiusRing = () => {
  const size = 300;
  const center = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-dashed border-border animate-pulse-ring" />
      
      {/* Middle ring */}
      <div className="absolute rounded-full border border-border/60" style={{ width: size * 0.65, height: size * 0.65 }} />
      
      {/* Inner ring (min radius) */}
      <div className="absolute rounded-full border border-border/40 bg-muted/30" style={{ width: size * 0.3, height: size * 0.3 }} />
      
      {/* Center - You */}
      <div className="absolute z-10 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/30">
        You
      </div>

      {/* Friends dots */}
      {mockFriends.map((friend) => {
        const radians = (friend.angle * Math.PI) / 180;
        const radius = (friend.distance * size) / 2;
        const x = center + Math.cos(radians) * radius - 20;
        const y = center + Math.sin(radians) * radius - 20;

        return (
          <div
            key={friend.name}
            className="absolute z-10 animate-fade-in"
            style={{ left: x, top: y }}
          >
            <div className="relative group cursor-pointer">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground transition-transform hover:scale-110", presenceColors[friend.presence])}>
                {friend.name[0]}
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-muted-foreground bg-card px-2 py-0.5 rounded-full shadow-sm">
                {friend.name} · {friend.intent}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RadiusRing;

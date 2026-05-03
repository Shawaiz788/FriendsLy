import { MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TrendingActivity {
  hangout_id: string;
  title: string;
  description?: string;
  creator_id: string;
  location?: {
    x: number;
    y: number;
  };
  scheduled_time?: string;
  status: string;
  participant_count?: number;
  creator?: {
    full_name: string;
    profile_photo_url?: string;
  };
}

interface TrendingActivitiesProps {
  activities: TrendingActivity[];
  onJoin?: (hangoutId: string) => void;
}

const TrendingActivities = ({
  activities,
  onJoin,
}: TrendingActivitiesProps) => {
  if (!activities || activities.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4 text-sm text-muted-foreground">
        No trending activities nearby right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.hangout_id}
          className="glass-card rounded-2xl p-4 space-y-3 hover:bg-muted/50 transition-colors"
        >
          {/* Title and creator */}
          <div>
            <p className="font-semibold text-sm text-foreground line-clamp-1">
              {activity.title || "Local Hangout"}
            </p>
            {activity.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {activity.description}
              </p>
            )}
          </div>

          {/* Creator info */}
          {activity.creator && (
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage
                  src={activity.creator.profile_photo_url || undefined}
                  alt={activity.creator.full_name}
                />
                <AvatarFallback>
                  {(activity.creator.full_name || "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                by {activity.creator.full_name}
              </span>
            </div>
          )}

          {/* Time and participants */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {activity.scheduled_time && (
              <span>
                {new Date(activity.scheduled_time).toLocaleDateString()}
              </span>
            )}
            {activity.participant_count !== undefined && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {activity.participant_count} interested
              </span>
            )}
          </div>

          {/* Action button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onJoin?.(activity.hangout_id)}
          >
            View Details
          </Button>
        </div>
      ))}
    </div>
  );
};

export default TrendingActivities;

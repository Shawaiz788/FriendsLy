import BottomNav from "@/components/BottomNav";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Clock3, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyHangoutInvites, respondToHangoutInvite } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface HangoutInvite {
  hangout_id: string;
  title: string;
  description: string;
  status: string;
  created_at?: string;
  creator: {
    user_id: string;
    full_name: string;
    username: string;
    profile_photo_url?: string;
  } | null;
}

const NotificationsPage = () => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<HangoutInvite[]>([]);
  const [actioningHangoutId, setActioningHangoutId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken") || "";
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchInvites = async () => {
      setLoading(true);
      try {
        const result = await getMyHangoutInvites(token);
        setInvites(Array.isArray(result?.data) ? result.data : []);
      } catch {
        setInvites([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchInvites();
  }, [token]);

  const unreadCount = useMemo(() => invites.length, [invites]);

  const handleInviteAction = async (hangoutId: string, action: "accept" | "decline") => {
    if (!token) return;

    setActioningHangoutId(hangoutId);
    try {
      const result = await respondToHangoutInvite(hangoutId, action, token);
      if (!result?.success) {
        toast({
          title: "Action failed",
          description: result?.error || "Please try again.",
        });
        return;
      }

      setInvites((prev) => prev.filter((invite) => invite.hangout_id !== hangoutId));
      toast({
        title: action === "accept" ? "Joined hangout" : "Invite declined",
        description:
          action === "accept"
            ? "You were added to the temporary group chat and capsule."
            : "You can still join future suggestions.",
      });
    } catch {
      toast({
        title: "Action failed",
        description: "Please try again shortly.",
      });
    } finally {
      setActioningHangoutId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground">Notifications</h1>
          <div className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-secondary border-2 border-background" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          {loading && (
            <div className="glass-card rounded-2xl p-4 text-sm text-muted-foreground">Loading notifications...</div>
          )}

          {!loading && invites.map((invite, i) => (
            <div
              key={invite.hangout_id}
              className="glass-card rounded-2xl p-4 flex items-start gap-3 animate-float-in"
              style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{invite.title || "Hangout invite"}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.creator?.full_name || "A friend"} invited you to join a temporary hangout group.
                </p>
                {invite.description ? (
                  <p className="text-xs text-muted-foreground mt-1">{invite.description}</p>
                ) : null}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="hero"
                    disabled={actioningHangoutId === invite.hangout_id}
                    onClick={() => handleInviteAction(invite.hangout_id, "accept")}
                  >
                    <Check className="w-4 h-4" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={actioningHangoutId === invite.hangout_id}
                    onClick={() => handleInviteAction(invite.hangout_id, "decline")}
                  >
                    <X className="w-4 h-4" /> Decline
                  </Button>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                <Clock3 className="w-3 h-3 inline-block mr-1" />
                New
              </span>
            </div>
          ))}

          {!loading && !invites.length && (
            <div className="glass-card rounded-2xl p-4 text-sm text-muted-foreground">
              No pending notifications right now.
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default NotificationsPage;

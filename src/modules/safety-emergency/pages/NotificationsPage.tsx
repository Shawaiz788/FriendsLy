import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Bell, Check, Clock3, MessageCircle, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acceptFriendRequest,
  getMyNotifications,
  markNotificationRead,
  respondToHangoutInvite,
  rejectFriendRequest,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  loadNotificationPreferences,
  loadQuietHours,
  type NotificationPreferences,
} from "@/modules/user-account/services/notificationPreferences";

type NotificationActor = {
  user_id: string;
  full_name?: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
} | null;

type NotificationHangout = {
  hangout_id: string;
  title?: string | null;
  description?: string | null;
  creator?: NotificationActor;
} | null;

type NotificationMessage = {
  message_id: string;
  group_id: string;
  message_type?: string | null;
  sender?: NotificationActor;
  hangout_id?: string | null;
  counterpart_user_id?: string | null;
} | null;

type NotificationItem = {
  notification_id: string;
  type: string;
  reference_id?: string | null;
  is_read: boolean;
  created_at?: string | null;
  actor?: NotificationActor;
  hangout?: NotificationHangout;
  message?: NotificationMessage;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    loadNotificationPreferences(),
  );
  const [quietHours, setQuietHours] = useState(loadQuietHours());

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken") || "";
    setToken(t);
  }, []);

  useEffect(() => {
    setNotificationPrefs(loadNotificationPreferences());
    setQuietHours(loadQuietHours());
  }, []);

  const refreshNotifications = async (tokenValue: string) => {
    setLoading(true);
    try {
      const result = await getMyNotifications(tokenValue);
      setNotifications(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    void refreshNotifications(token);
  }, [token]);

  const isMuted =
    quietHours ||
    (!notificationPrefs.messages &&
      !notificationPrefs.hangoutInvites &&
      !notificationPrefs.friendRequests);

  const visibleNotifications = useMemo(() => {
    if (isMuted) return [];
    const filtered = notifications.filter((notification) => {
      if (notification.type === "message") return notificationPrefs.messages;
      if (notification.type === "friend_request") return notificationPrefs.friendRequests;
      if (notification.type === "hangout_invite" || notification.type === "hangout_joined") {
        return notificationPrefs.hangoutInvites;
      }
      return true;
    });

    const seenKeys = new Set<string>();
    const deduped: NotificationItem[] = [];

    for (const notification of filtered) {
      let key = notification.notification_id;
      if (notification.type === "message") {
        key = `message:${notification.message?.group_id || notification.message?.counterpart_user_id || notification.reference_id}`;
      } else if (notification.type === "friend_request") {
        key = `friend_request:${notification.actor?.user_id || notification.reference_id}`;
      } else if (notification.type === "hangout_invite") {
        key = `hangout_invite:${notification.hangout?.hangout_id || notification.reference_id}`;
      } else if (notification.type === "hangout_joined") {
        key = `hangout_joined:${notification.hangout?.hangout_id || notification.reference_id}:${notification.actor?.user_id || ""}`;
      }

      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduped.push(notification);
    }

    return deduped;
  }, [isMuted, notificationPrefs, notifications]);

  const unreadCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.is_read).length,
    [visibleNotifications],
  );

  const formatTimestamp = (value?: string | null) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const markRead = async (notificationId: string) => {
    if (!token) return;
    try {
      await markNotificationRead(notificationId, token);
      setNotifications((prev) =>
        prev.map((item) => (item.notification_id === notificationId ? { ...item, is_read: true } : item)),
      );
    } catch {
      // ignore, we still update locally
    }
  };

  const handleInviteAction = async (
    notification: NotificationItem,
    action: "accept" | "decline",
  ) => {
    if (!token) return;
    const hangoutId = notification.hangout?.hangout_id || notification.reference_id;
    if (!hangoutId) return;

    setActioningId(notification.notification_id);
    try {
      const result = await respondToHangoutInvite(String(hangoutId), action, token);
      if (!result?.success) {
        toast({
          title: "Action failed",
          description: result?.error || "Please try again.",
        });
        return;
      }

      setNotifications((prev) => prev.filter((item) => item.notification_id !== notification.notification_id));
      await markRead(notification.notification_id);
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
      setActioningId(null);
    }
  };

  const handleFriendRequest = async (
    notification: NotificationItem,
    action: "accept" | "reject",
  ) => {
    if (!token) return;
    const requesterId = notification.actor?.user_id || notification.reference_id;
    if (!requesterId) return;

    setActioningId(notification.notification_id);
    try {
      const result =
        action === "accept"
          ? await acceptFriendRequest(String(requesterId), token)
          : await rejectFriendRequest(String(requesterId), token);

      if (!result?.success) {
        toast({
          title: "Action failed",
          description: result?.error || "Please try again.",
        });
        return;
      }

      setNotifications((prev) => prev.filter((item) => item.notification_id !== notification.notification_id));
      await markRead(notification.notification_id);
      toast({
        title: action === "accept" ? "Friend request accepted" : "Friend request declined",
      });
    } catch {
      toast({
        title: "Action failed",
        description: "Please try again shortly.",
      });
    } finally {
      setActioningId(null);
    }
  };

  const handleOpenChat = async (notification: NotificationItem) => {
    const message = notification.message;
    if (!message) return;

    if (message.hangout_id) {
      await markRead(notification.notification_id);
      navigate(`/social?tab=chat&hangout=${message.hangout_id}`);
      return;
    }

    if (message.counterpart_user_id) {
      await markRead(notification.notification_id);
      navigate(`/chat/${message.counterpart_user_id}`);
      return;
    }

    toast({
      title: "Chat unavailable",
      description: "Open the chat from the Social page.",
    });
  };

  const renderNotification = (notification: NotificationItem, index: number) => {
    const timeLabel = formatTimestamp(notification.created_at);
    const isUnread = !notification.is_read;

    if (notification.type === "friend_request") {
      const actorName = notification.actor?.full_name || notification.actor?.username || "Someone";
      return (
        <div
          key={notification.notification_id}
          className="glass-card rounded-2xl p-4 flex items-start gap-3 animate-float-in"
          style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-secondary/15 text-secondary">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">Friend request</p>
            <p className="text-xs text-muted-foreground">{actorName} wants to connect.</p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="hero"
                disabled={actioningId === notification.notification_id}
                onClick={() => handleFriendRequest(notification, "accept")}
              >
                <Check className="w-4 h-4" /> Accept
              </Button>
              <Button
                size="sm"
                variant="soft"
                disabled={actioningId === notification.notification_id}
                onClick={() => handleFriendRequest(notification, "reject")}
              >
                <X className="w-4 h-4" /> Decline
              </Button>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
            <Clock3 className="w-3 h-3 inline-block mr-1" />
            {isUnread ? "New" : timeLabel}
          </span>
        </div>
      );
    }

    if (notification.type === "hangout_invite") {
      const creatorName = notification.hangout?.creator?.full_name || "A friend";
      const title = notification.hangout?.title || "Hangout suggestion";
      return (
        <div
          key={notification.notification_id}
          className="glass-card rounded-2xl p-4 flex items-start gap-3 animate-float-in"
          style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              {creatorName} invited you to join a temporary hangout.
            </p>
            {notification.hangout?.description ? (
              <p className="text-xs text-muted-foreground mt-1">{notification.hangout.description}</p>
            ) : null}
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="hero"
                disabled={actioningId === notification.notification_id}
                onClick={() => handleInviteAction(notification, "accept")}
              >
                <Check className="w-4 h-4" /> Accept
              </Button>
              <Button
                size="sm"
                variant="soft"
                disabled={actioningId === notification.notification_id}
                onClick={() => handleInviteAction(notification, "decline")}
              >
                <X className="w-4 h-4" /> Decline
              </Button>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
            <Clock3 className="w-3 h-3 inline-block mr-1" />
            {isUnread ? "New" : timeLabel}
          </span>
        </div>
      );
    }

    if (notification.type === "hangout_joined") {
      const actorName = notification.actor?.full_name || "Someone";
      const title = notification.hangout?.title || "Hangout update";
      return (
        <div
          key={notification.notification_id}
          className="glass-card rounded-2xl p-4 flex items-start gap-3 animate-float-in"
          style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-secondary/10 text-secondary">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{actorName} joined your hangout.</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="soft" onClick={() => markRead(notification.notification_id)}>
                Mark read
              </Button>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
            <Clock3 className="w-3 h-3 inline-block mr-1" />
            {isUnread ? "New" : timeLabel}
          </span>
        </div>
      );
    }

    if (notification.type === "message") {
      const actorName = notification.message?.sender?.full_name || notification.message?.sender?.username || "A friend";
      return (
        <div
          key={notification.notification_id}
          className="glass-card rounded-2xl p-4 flex items-start gap-3 animate-float-in"
          style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">New message</p>
            <p className="text-xs text-muted-foreground">From {actorName}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="hero" onClick={() => handleOpenChat(notification)}>
                Open chat
              </Button>
              <Button size="sm" variant="soft" onClick={() => markRead(notification.notification_id)}>
                Mark read
              </Button>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
            <Clock3 className="w-3 h-3 inline-block mr-1" />
            {isUnread ? "New" : timeLabel}
          </span>
        </div>
      );
    }

    return null;
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

          {!loading && isMuted && (
            <div className="glass-card rounded-2xl p-4 text-sm text-muted-foreground">
              Notifications are muted. Turn off quiet hours or enable categories in Settings.
            </div>
          )}

          {!loading && !isMuted && visibleNotifications.map(renderNotification)}

          {!loading && !isMuted && !visibleNotifications.length && (
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

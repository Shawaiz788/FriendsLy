import BottomNav from "@/components/BottomNav";
import { Bell, Info, MessageCircle, UserPlus } from "lucide-react";

const notifications = [
  {
    id: 1,
    type: "suggestion",
    icon: MessageCircle,
    title: "Sara is nearby and Free!",
    desc: "Want to start a hangout?",
    time: "2 min ago",
  },
  {
    id: 2,
    type: "friend",
    icon: UserPlus,
    title: "Omar sent a friend request",
    desc: "3 mutual friends",
    time: "15 min ago",
  },
  {
    id: 3,
    type: "suggestion",
    icon: MessageCircle,
    title: "Ali is studying nearby",
    desc: "Compatible intent – study session?",
    time: "1 hr ago",
  },
  {
    id: 4,
    type: "info",
    icon: Info,
    title: "Your intent expired",
    desc: "'Studying' reset to default",
    time: "2 hr ago",
  },
];

const NotificationsPage = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground">Notifications</h1>
          <div className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-secondary border-2 border-background" />
          </div>
        </div>

        <div className="space-y-2">
          {notifications.map((n, i) => (
            <div
              key={n.id}
              className="glass-card rounded-2xl p-4 flex items-start gap-3 animate-float-in"
              style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                n.type === "suggestion" ? "bg-primary/10 text-primary" :
                n.type === "friend" ? "bg-secondary/10 text-secondary" :
                "bg-muted text-muted-foreground"
              }`}>
                <n.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">{n.time}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default NotificationsPage;

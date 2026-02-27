import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Ghost, Bell, Shield, LogOut, Trash2, User, MapPin } from "lucide-react";
import { useState } from "react";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [ghostMode, setGhostMode] = useState(false);
  const [quietHours, setQuietHours] = useState(false);

  const settingsGroups = [
    {
      title: "Privacy",
      items: [
        {
          icon: Ghost,
          label: "Ghost Mode",
          desc: "Become invisible to all friends",
          toggle: true,
          checked: ghostMode,
          onToggle: setGhostMode,
        },
        {
          icon: Shield,
          label: "Selective Ghosting",
          desc: "Hide from specific friends",
          chevron: true,
        },
        {
          icon: MapPin,
          label: "Location Settings",
          desc: "Manage presence visibility",
          chevron: true,
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        {
          icon: Bell,
          label: "Quiet Hours",
          desc: "Mute all notifications",
          toggle: true,
          checked: quietHours,
          onToggle: setQuietHours,
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          icon: LogOut,
          label: "Log Out",
          desc: "Sign out of your account",
          action: () => navigate("/"),
        },
        {
          icon: Trash2,
          label: "Delete Account",
          desc: "Permanently remove your data",
          danger: true,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-6">Profile</h1>

        {/* Profile card */}
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4 mb-8 animate-float-in">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
            <User className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg text-foreground">Your Name</p>
            <p className="text-sm text-muted-foreground">you@example.com</p>
            <p className="text-xs text-muted-foreground mt-0.5">📍 San Francisco</p>
          </div>
          <Button variant="soft" size="sm">Edit</Button>
        </div>

        {/* Settings */}
        {settingsGroups.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
              {group.title}
            </p>
            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-border/50">
              {group.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    item.danger ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                  }`}>
                    <item.icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.danger ? "text-destructive" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  {item.toggle && (
                    <Switch
                      checked={item.checked}
                      onCheckedChange={item.onToggle}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  {item.chevron && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;

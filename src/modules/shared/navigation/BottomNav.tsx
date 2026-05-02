import { Home, Users, Target, Clapperboard, Image, Settings, Eye, Users2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Image, label: "Media", path: "/media" },
  { icon: Eye, label: "Stories", path: "/stories" },
  { icon: Users2, label: "Collab", path: "/collaborative" },
  { icon: Clapperboard, label: "Social", path: "/social" },
  { icon: Users, label: "Friends", path: "/friends" },
  { icon: Target, label: "Intent", path: "/intent" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[900] glass-card border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isSettingsItem = item.path === "/settings";
          const isActive = isSettingsItem
            ? location.pathname === "/settings" || location.pathname === "/profile"
            : location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "bottom-nav-item py-2 px-3 rounded-xl",
                isActive && "bottom-nav-item-active bg-primary/10"
              )}
            >
              <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

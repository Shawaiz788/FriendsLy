import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import FriendCard from "@/components/FriendCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Check, X } from "lucide-react";

const mockFriends = [
  { name: "Sara Ahmed", intent: "Free ✌️", presence: "nearby" as const },
  { name: "Ali Khan", intent: "Studying 📚", presence: "nearby" as const },
  { name: "Mia Chen", intent: "Hungry 🍕", presence: "city" as const },
  { name: "Zain Abbas", intent: "Busy 💼", presence: "away" as const },
  { name: "Luna Park", intent: "Exercising 🏃", presence: "city" as const },
];

const pendingRequests = [
  { name: "Omar Faiz", mutual: 3 },
];

const FriendsPage = () => {
  const [search, setSearch] = useState("");
  const filtered = mockFriends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 pb-4">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-4">Friends</h1>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-border"
          />
        </div>

        <Button variant="coral" size="sm" className="mb-6">
          <UserPlus className="w-4 h-4" />
          Add Friend
        </Button>

        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
              Friend Requests
            </p>
            {pendingRequests.map((req) => (
              <div key={req.name} className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-float-in">
                <div className="w-11 h-11 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-semibold">
                  {req.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{req.name}</p>
                  <p className="text-xs text-muted-foreground">{req.mutual} mutual friends</p>
                </div>
                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <Check className="w-4 h-4" />
                  </button>
                  <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Friends list */}
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
          All Friends ({filtered.length})
        </p>
        <div className="space-y-2">
          {filtered.map((friend, i) => (
            <div key={friend.name} style={{ animationDelay: `${i * 0.05}s` }}>
              <FriendCard {...friend} />
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default FriendsPage;

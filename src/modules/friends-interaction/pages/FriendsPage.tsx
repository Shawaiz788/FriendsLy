import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import FriendCard from "@/components/FriendCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Check, X } from "lucide-react";
import { getIncomingFriendRequests, acceptFriendRequest, rejectFriendRequest, getAcceptedFriends } from "@/lib/api";

interface IncomingRequest {
  requester_id: string;
  name: string;
  photo_url: string;
  created_at: string;
}

interface Friend {
  user_id: string;
  full_name: string;
  username: string;
  profile_photo_url: string;
  bio: string;
}

const FriendsPage = () => {
  const [search, setSearch] = useState("");
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken");
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [requestsResult, friendsResult] = await Promise.all([
          getIncomingFriendRequests(token),
          getAcceptedFriends(token)
        ]);

        console.log('📥 Incoming requests result:', requestsResult);
        console.log('👥 Friends result:', friendsResult);

        if (requestsResult.data) {
          setIncomingRequests(requestsResult.data);
        }
        if (friendsResult.data) {
          setFriends(friendsResult.data);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleAccept = async (requesterId: string) => {
    setAcceptingId(requesterId);
    try {
      const result = await acceptFriendRequest(requesterId, token);
      if (result.success) {
        console.log('✅ Request accepted from', requesterId);
        setIncomingRequests(incomingRequests.filter(r => r.requester_id !== requesterId));
      } else {
        console.error('❌ Accept failed:', result.error);
      }
    } catch (err) {
      console.error("Error accepting request:", err);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (requesterId: string) => {
    setRejectingId(requesterId);
    try {
      const result = await rejectFriendRequest(requesterId, token);
      if (result.success) {
        console.log('✅ Request rejected from', requesterId);
        setIncomingRequests(incomingRequests.filter(r => r.requester_id !== requesterId));
      } else {
        console.error('❌ Reject failed:', result.error);
      }
    } catch (err) {
      console.error("Error rejecting request:", err);
    } finally {
      setRejectingId(null);
    }
  };

  const filtered = friends.filter((f) =>
    f.full_name.toLowerCase().includes(search.toLowerCase()) ||
    f.username.toLowerCase().includes(search.toLowerCase())
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
        {!loading && incomingRequests.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
              Friend Requests ({incomingRequests.length})
            </p>
            {incomingRequests.map((req, i) => (
              <div key={req.requester_id} className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-float-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="w-11 h-11 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-semibold overflow-hidden">
                  {req.photo_url && !req.photo_url.startsWith("blob:") ? (
                    <img src={req.photo_url} alt={req.name} className="w-full h-full object-cover" />
                  ) : (
                    req.name[0]
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{req.name}</p>
                  <p className="text-xs text-muted-foreground">Sent a friend request</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAccept(req.requester_id)}
                    disabled={acceptingId === req.requester_id}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleReject(req.requester_id)}
                    disabled={rejectingId === req.requester_id}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                  >
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
          {filtered.length > 0 ? (
            filtered.map((friend: Friend, i) => (
              <div key={friend.user_id} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-float-in">
                  <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold overflow-hidden">
                    {friend.profile_photo_url && !friend.profile_photo_url.startsWith("blob:") ? (
                      <img src={friend.profile_photo_url} alt={friend.full_name} className="w-full h-full object-cover" />
                    ) : (
                      friend.full_name[0]
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">{friend.full_name}</p>
                    <p className="text-xs text-muted-foreground">@{friend.username}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No friends yet. Search and add some!</p>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default FriendsPage;

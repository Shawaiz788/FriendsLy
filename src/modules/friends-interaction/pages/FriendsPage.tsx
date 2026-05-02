import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import FriendCard from "@/components/FriendCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Search, UserPlus, Check, X, UserCheck, Clock, User, MessageCircle } from "lucide-react";
import {
  getIncomingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getAcceptedFriends,
  getFriendRequestStatus,
  searchUsers,
  sendFriendRequest,
} from "@/lib/api";

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

interface SearchResult {
  user_id: string;
  full_name: string;
  username: string;
  profile_photo_url: string;
  bio: string;
}

const FriendsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"friends" | "find">("friends");
  const [search, setSearch] = useState("");
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [requestStatus, setRequestStatus] = useState<Record<string, string>>({});
  const [sendingRequest, setSendingRequest] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken");
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const tab = url.searchParams.get("tab");
    if (tab === "find") {
      setActiveTab("find");
    }
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

  const handleFindFriends = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setRequestStatus({});
      return;
    }

    if (!token) return;
    setLoadingSearch(true);
    try {
      const result = await searchUsers(searchQuery, token);
      if (result?.error) {
        toast({
          title: "Could not search friends",
          description: result.error,
        });
        setResults([]);
        setRequestStatus({});
        return;
      }

      const nextResults: SearchResult[] = Array.isArray(result?.data) ? result.data : [];
      setResults(nextResults);

      const statuses: Record<string, string> = {};
      for (const user of nextResults) {
        try {
          const status = await getFriendRequestStatus(user.user_id, token);
          statuses[user.user_id] = status?.status || "none";
        } catch {
          statuses[user.user_id] = "none";
        }
      }
      setRequestStatus(statuses);
    } catch (err) {
      toast({
        title: "Could not search friends",
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setResults([]);
      setRequestStatus({});
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    if (!token) return;
    setSendingRequest((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await sendFriendRequest(userId, token);
      if (result?.success) {
        setRequestStatus((prev) => ({ ...prev, [userId]: "pending" }));
        toast({ title: "Friend request sent" });
      } else {
        toast({
          title: "Could not send request",
          description: result?.error || "Please try again.",
        });
      }
    } catch (err) {
      toast({
        title: "Could not send request",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSendingRequest((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleStartChat = (friend: Friend) => {
    navigate(`/chat/${friend.user_id}`);
  };

  const findButtonForStatus = (userId: string) => {
    const status = requestStatus[userId] || "none";
    if (status === "accepted") {
      return (
        <Button variant="soft" size="sm" disabled className="flex items-center gap-1">
          <UserCheck className="w-4 h-4" /> Friends
        </Button>
      );
    }
    if (status === "pending") {
      return (
        <Button variant="soft" size="sm" disabled className="flex items-center gap-1">
          <Clock className="w-4 h-4" /> Pending
        </Button>
      );
    }
    return (
      <Button
        variant="hero"
        size="sm"
        onClick={() => handleSendRequest(userId)}
        disabled={!!sendingRequest[userId]}
        className="flex items-center gap-1"
      >
        <UserPlus className="w-4 h-4" />
        {sendingRequest[userId] ? "Sending..." : "Add"}
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 pb-4">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-4">Friends</h1>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "friends" | "find")}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="find">Find</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search friends..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-card border-border"
              />
            </div>

            {/* Pending requests */}
            {!loading && incomingRequests.length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                  Friend Requests ({incomingRequests.length})
                </p>
                {incomingRequests.map((req, i) => (
                  <div
                    key={req.requester_id}
                    className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-float-in"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
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
                          <img
                            src={friend.profile_photo_url}
                            alt={friend.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          friend.full_name[0]
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground text-sm">{friend.full_name}</p>
                        <p className="text-xs text-muted-foreground">@{friend.username}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => handleStartChat(friend)}
                        className="flex items-center gap-1"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Chat
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No friends yet. Use the Find tab to add some.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="find" className="mt-4">
            <div className="relative mb-6 animate-float-in">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or username..."
                value={query}
                onChange={(e) => handleFindFriends(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-card border-border"
              />
            </div>

            {loadingSearch && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Searching...</p>
              </div>
            )}

            {!loadingSearch && query.length >= 2 && results.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No users found matching "{query}"</p>
                <p className="text-xs text-muted-foreground mt-2">Try searching for a name or username</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-3 animate-float-in">
                {results.map((user) => (
                  <div
                    key={user.user_id}
                    className="glass-card rounded-xl p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {user.profile_photo_url && !user.profile_photo_url.startsWith("blob:") ? (
                          <img
                            src={user.profile_photo_url}
                            alt={user.full_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <User className="w-6 h-6 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                        {user.bio && <p className="text-xs text-muted-foreground mt-1 truncate">{user.bio}</p>}
                      </div>
                    </div>
                    <div className="ml-3 flex-shrink-0">{findButtonForStatus(user.user_id)}</div>
                  </div>
                ))}
              </div>
            )}

            {!loadingSearch && query.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Start typing to find friends</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
};

export default FriendsPage;

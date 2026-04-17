import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, User, UserPlus, UserCheck, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { searchUsers, sendFriendRequest, getFriendRequestStatus } from "@/lib/api";

interface SearchResult {
  user_id: string;
  full_name: string;
  username: string;
  profile_photo_url: string;
  bio: string;
}

const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [requestStatus, setRequestStatus] = useState<{ [key: string]: string }>({});
  const [sendingRequest, setSendingRequest] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken");
    if (t) setToken(t);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setRequestStatus({});
      return;
    }

    setLoading(true);
    try {
      const result = await searchUsers(searchQuery, token);
      if (result.data) {
        setResults(result.data);
        
        // Check friend status for each result - wait for all to complete
        const statuses: { [key: string]: string } = {};
        for (const user of result.data) {
          try {
            const status = await getFriendRequestStatus(user.user_id, token);
            statuses[user.user_id] = status.status || "none";
          } catch (err) {
            console.error("Error getting status for user", user.user_id, ":", err);
            statuses[user.user_id] = "none";
          }
        }
        setRequestStatus(statuses);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    setSendingRequest((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await sendFriendRequest(userId, token);
      if (result.success) {
        console.log('✅ Request sent to', userId);
        setRequestStatus((prev) => ({ ...prev, [userId]: "pending" }));
      } else {
        console.error('❌ Failed to send request:', result.error);
      }
    } catch (err) {
      console.error("Error sending request:", err);
    } finally {
      setSendingRequest((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const viewProfile = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  const getButtonForStatus = (userId: string, status: string | undefined) => {
    const displayStatus = status || "none";
    
    if (displayStatus === "accepted") {
      return (
        <Button variant="soft" size="sm" disabled className="flex items-center gap-1">
          <UserCheck className="w-4 h-4" />
          Friends
        </Button>
      );
    } else if (displayStatus === "pending") {
      return (
        <Button variant="soft" size="sm" disabled className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          Pending
        </Button>
      );
    } else {
      return (
        <Button
          variant="hero"
          size="sm"
          onClick={() => handleSendRequest(userId)}
          disabled={sendingRequest[userId]}
          className="flex items-center gap-1"
        >
          <UserPlus className="w-4 h-4" />
          {sendingRequest[userId] ? "Sending..." : "Add Friend"}
        </Button>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/home")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-2xl font-bold text-foreground">Find Friends</h1>
        </div>

        {/* Search Input */}
        <div className="relative mb-6 animate-float-in">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or username..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-card border-border"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Searching...</p>
          </div>
        )}

        {/* No Results */}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No users found matching "{query}"</p>
            <p className="text-xs text-muted-foreground mt-2">Try searching for a name or username</p>
          </div>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-3 animate-float-in">
            {results.map((user) => (
              <div
                key={user.user_id}
                className="glass-card rounded-xl p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => viewProfile(user.user_id)}>
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
                <div className="ml-3 flex-shrink-0">
                  {getButtonForStatus(user.user_id, requestStatus[user.user_id] || "none")}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Initial State */}
        {!loading && query.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Start typing to search for friends</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SearchPage;

import { useParams, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, UserPlus, UserCheck, Clock, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { getUserProfile, sendFriendRequest } from "@/lib/api";
import { API_BASE } from "@/lib/apiBase";

interface UserProfile {
  user_id: string;
  full_name: string;
  username: string;
  profile_photo_url: string;
  bio: string;
  date_of_birth: string;
  gender: string;
}

const UserProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [friendStatus, setFriendStatus] = useState<"pending_from_me" | "pending_from_them" | "accepted" | "none">("none");
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken");
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    
    // Get current user ID
    const getUserId = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/user/me`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.user?.id) {
          setCurrentUserId(data.user.id);
        }
      } catch (err) {
        console.error("Error getting current user:", err);
      }
    };
    
    getUserId();
  }, [token]);

  useEffect(() => {
    if (!userId || !token || !currentUserId) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const result = await getUserProfile(userId, token);
        if (result.data) {
          setProfile(result.data);

          // Check friendship status
          try {
            const statusRes = await fetch(
              `${API_BASE}/api/user/${userId}/friend-status`,
              { headers: { "Authorization": `Bearer ${token}` } }
            ).then(r => r.json());

            const status = statusRes.status || "none";

            if (status === "accepted") {
              setFriendStatus("accepted");
            } else if (status === "pending") {
              // Default to pending_from_me for now
              setFriendStatus("pending_from_me");
            } else {
              setFriendStatus("none");
            }
          } catch (err) {
            console.error("Error checking friendship status:", err);
            setFriendStatus("none");
          }
        } else {
          setError("User not found");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId, token, currentUserId]);

  const handleSendRequest = async () => {
    if (!userId) return;
    setSendingRequest(true);
    try {
      const result = await sendFriendRequest(userId, token);
      if (result.success) {
        setFriendStatus("pending_from_me");
      }
    } catch (err) {
      console.error("Error sending request:", err);
    } finally {
      setSendingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-6 pt-6">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center py-12">
            <p className="text-muted-foreground">{error || "User not found"}</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const getButton = () => {
    if (friendStatus === "accepted") {
      return (
        <Button variant="soft" disabled className="w-full flex items-center justify-center gap-2 h-12 rounded-xl">
          <UserCheck className="w-5 h-5" />
          Friends
        </Button>
      );
    } else if (friendStatus === "pending_from_me") {
      return (
        <Button variant="soft" disabled className="w-full flex items-center justify-center gap-2 h-12 rounded-xl">
          <Clock className="w-5 h-5" />
          Request Pending
        </Button>
      );
    } else if (friendStatus === "pending_from_them") {
      return (
        <Button variant="hero" disabled className="w-full flex items-center justify-center gap-2 h-12 rounded-xl">
          <Check className="w-5 h-5" />
          Check Friend Requests
        </Button>
      );
    } else {
      return (
        <Button
          variant="hero"
          onClick={handleSendRequest}
          disabled={sendingRequest}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl"
        >
          <UserPlus className="w-5 h-5" />
          {sendingRequest ? "Sending..." : "Add Friend"}
        </Button>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Profile Card */}
        <div className="glass-card rounded-2xl p-6 animate-float-in mb-6">
          {/* Profile Photo */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground overflow-hidden border-4 border-primary/20">
              {profile.profile_photo_url && !profile.profile_photo_url.startsWith("blob:") ? (
                <img
                  src={profile.profile_photo_url}
                  alt={profile.full_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <User className="w-12 h-12" />
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="text-center mb-6">
            <h1 className="font-serif text-2xl font-bold text-foreground">{profile.full_name}</h1>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mb-6 p-4 bg-muted/20 rounded-lg">
              <p className="text-sm text-foreground text-center">{profile.bio}</p>
            </div>
          )}

          {/* User Details */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {profile.gender && (
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Gender</p>
                <p className="text-sm font-semibold text-foreground capitalize">{profile.gender}</p>
              </div>
            )}
            {profile.date_of_birth && (
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Age</p>
                <p className="text-sm font-semibold text-foreground">
                  {new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()}
                </p>
              </div>
            )}
          </div>

          {/* Friend Request Button */}
          {getButton()}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default UserProfilePage;

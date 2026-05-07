import { useParams, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  User,
  UserPlus,
  UserCheck,
  Clock,
  Check,
  MoreHorizontal,
  Flag,
  Ban,
  UserX,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  acceptFriendRequest,
  blockUser,
  getBlockedUsers,
  getFriendRequestStatus,
  getUserProfile,
  rejectFriendRequest,
  removeFriend,
  reportUser,
  sendFriendRequest,
  unblockUser,
} from "@/lib/api";
import { API_BASE } from "@/lib/apiBase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

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
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [unfriendOpen, setUnfriendOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [unfriending, setUnfriending] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

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
            const statusRes = await getFriendRequestStatus(userId, token);
            const status = statusRes.status || "none";
            if (status === "accepted") {
              setFriendStatus("accepted");
            } else if (status === "pending") {
              const direction = statusRes.direction;
              setFriendStatus(direction === "incoming" ? "pending_from_them" : "pending_from_me");
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

  useEffect(() => {
    if (!userId || !token) return;
    const loadBlocked = async () => {
      try {
        const result = await getBlockedUsers(token);
        const blocked = Array.isArray(result?.data)
          ? result.data.some((entry: any) => entry.blocked_user_id === userId)
          : false;
        setIsBlocked(blocked);
      } catch (err) {
        console.error("Error loading blocked users:", err);
      }
    };
    loadBlocked();
  }, [userId, token]);

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

  const handleAcceptRequest = async () => {
    if (!userId) return;
    try {
      const result = await acceptFriendRequest(userId, token);
      if (result?.success) {
        setFriendStatus("accepted");
      } else {
        setActionError(result?.error || "Failed to accept request.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error accepting request.");
    }
  };

  const handleRejectRequest = async () => {
    if (!userId) return;
    try {
      const result = await rejectFriendRequest(userId, token);
      if (result?.success) {
        setFriendStatus("none");
      } else {
        setActionError(result?.error || "Failed to reject request.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error rejecting request.");
    }
  };

  const handleReportUser = async () => {
    if (!userId) return;
    if (!reportReason.trim()) {
      setActionError("Please provide a reason for the report.");
      return;
    }
    setReporting(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await reportUser(userId, reportReason.trim(), token);
      if (result?.success) {
        setActionMessage("Report submitted successfully.");
        setReportReason("");
        setReportOpen(false);
      } else {
        setActionError(result?.error || "Failed to submit report.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error submitting report.");
    } finally {
      setReporting(false);
    }
  };

  const handleBlockUser = async () => {
    if (!userId) return;
    setBlocking(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await blockUser(userId, token);
      if (result?.success) {
        setActionMessage("User blocked successfully.");
        setIsBlocked(true);
        setFriendStatus("none");
        setBlockOpen(false);
      } else {
        setActionError(result?.error || "Failed to block user.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error blocking user.");
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!userId) return;
    setUnblocking(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await unblockUser(userId, token);
      if (result?.success) {
        setActionMessage("User unblocked successfully.");
        setIsBlocked(false);
        setUnblockOpen(false);
      } else {
        setActionError(result?.error || "Failed to unblock user.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error unblocking user.");
    } finally {
      setUnblocking(false);
    }
  };

  const handleUnfriendUser = async () => {
    if (!userId) return;
    setUnfriending(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await removeFriend(userId, token);
      if (result?.success) {
        setActionMessage("Friend removed.");
        setFriendStatus("none");
        setUnfriendOpen(false);
      } else {
        setActionError(result?.error || "Failed to remove friend.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error removing friend.");
    } finally {
      setUnfriending(false);
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
    if (isBlocked) {
      return (
        <Button variant="soft" disabled className="w-full flex items-center justify-center gap-2 h-12 rounded-xl">
          <Ban className="w-5 h-5" />
          Blocked
        </Button>
      );
    }
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
        <div className="flex gap-2">
          <Button
            variant="hero"
            onClick={handleAcceptRequest}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl"
          >
            <Check className="w-5 h-5" />
            Accept
          </Button>
          <Button
            variant="outline"
            onClick={handleRejectRequest}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl"
          >
            Reject
          </Button>
        </div>
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
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {friendStatus === "accepted" && (
                <DropdownMenuItem onClick={() => { setActionError(""); setActionMessage(""); setUnfriendOpen(true); }}>
                  <UserX className="mr-2 h-4 w-4" />
                  Unfriend
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { setActionError(""); setActionMessage(""); setReportOpen(true); }}>
                <Flag className="mr-2 h-4 w-4" />
                Report User
              </DropdownMenuItem>
              {isBlocked ? (
                <DropdownMenuItem onClick={() => { setActionError(""); setActionMessage(""); setUnblockOpen(true); }}>
                  <Ban className="mr-2 h-4 w-4" />
                  Unblock User
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => { setActionError(""); setActionMessage(""); setBlockOpen(true); }}>
                  <Ban className="mr-2 h-4 w-4" />
                  Block User
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(actionError || actionMessage) && (
          <div
            className={`mb-4 rounded-xl p-3 text-sm ${actionError ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
          >
            {actionError || actionMessage}
          </div>
        )}

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

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report user</DialogTitle>
            <DialogDescription>
              Tell us what happened so we can review this account.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Describe the issue or behavior"
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={handleReportUser} disabled={reporting}>
              {reporting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this user?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to interact with you on FriendsLy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} disabled={blocking}>
              {blocking ? "Blocking..." : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unblockOpen} onOpenChange={setUnblockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock this user?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be able to interact with you again on FriendsLy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblockUser} disabled={unblocking}>
              {unblocking ? "Unblocking..." : "Unblock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unfriendOpen} onOpenChange={setUnfriendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this friend?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection from both of your accounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnfriendUser} disabled={unfriending}>
              {unfriending ? "Removing..." : "Unfriend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

export default UserProfilePage;

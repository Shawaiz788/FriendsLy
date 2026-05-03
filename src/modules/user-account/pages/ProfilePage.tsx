import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bell, Download, LogOut, Shield, ShieldAlert, Trash2, User, UserX } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deactivateAccount, deleteAccount, editProfile, logoutAllSessions, logoutCurrentSession, updateMyLocation } from "@/lib/api";
import { API_BASE } from "@/lib/apiBase";

async function fetchProfile(token) {
  // Get user id from token
  const resUser = await fetch(`${API_BASE}/api/user/me`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const userJson = await resUser.json();
  const userId = userJson?.user?.id;
  if (!userId) return { data: [] };
  const res = await fetch(`${API_BASE}/api/user/download?id=${userId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const data = await res.json();
  console.log('Profile data fetched:', data);
  if (data?.data?.[0]) {
    console.log('Profile photo URL:', data.data[0].profile_photo_url);
  }
  return data;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    username: string;
    photo: string;
    interests: string;
    date_of_birth: string;
    gender: string;
    newPhotoFile?: File;
  }>({
    name: "",
    username: "",
    photo: "",
    interests: "",
    date_of_birth: "",
    gender: "",
    newPhotoFile: undefined
  });
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);
  const [quietHours, setQuietHours] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("sage-coral");
  const lastLightThemeRef = useRef("sandy");
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [showApplyLocationAction, setShowApplyLocationAction] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [downloadSelection, setDownloadSelection] = useState({
    profile: true,
    intent: true,
    location: true,
    friends: true,
    hangouts: true,
    chats: false,
    posts: true,
  });
  const [trustedContactsOpen, setTrustedContactsOpen] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingContact, setAddingContact] = useState<string | null>(null);

  const [blockReportOpen, setBlockReportOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockReportError, setBlockReportError] = useState("");
  const [blockReportMessage, setBlockReportMessage] = useState("");
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [blockSearchResults, setBlockSearchResults] = useState<any[]>([]);
  const [searchingBlockUsers, setSearchingBlockUsers] = useState(false);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [reportingUser, setReportingUser] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  const LIGHT_THEMES = ["sage-coral", "sandy"] as const;
  const DARK_THEME = "muted-night" as const;

  const normalizeAppearance = (isDark: boolean, theme: string) => {
    if (isDark) {
      return { isDark: true, theme: DARK_THEME };
    }

    const nextTheme = (LIGHT_THEMES as readonly string[]).includes(theme) ? theme : lastLightThemeRef.current;
    return { isDark: false, theme: nextTheme || "sandy" };
  };

  const applyAppearance = (isDark: boolean, theme: string) => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", theme);
  };

  const applyAndSetAppearance = (nextDark: boolean, nextTheme: string) => {
    const normalized = normalizeAppearance(nextDark, nextTheme);
    setDarkMode(normalized.isDark);
    setSelectedTheme(normalized.theme);
    if (!normalized.isDark && (LIGHT_THEMES as readonly string[]).includes(normalized.theme)) {
      lastLightThemeRef.current = normalized.theme;
    }
    applyAppearance(normalized.isDark, normalized.theme);
    return normalized;
  };

  const persistAppearance = async (nextDark: boolean, nextTheme: string) => {
    if (!token) return;
    await editProfile({
      name: profile.name,
      username: profile.username,
      photo: profile.photo,
      interests: profile.interests,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      dark_mode_enabled: nextDark,
      selected_theme: nextTheme,
      token,
    });
  };

  const handleUseCurrentLocation = () => {
    // #region agent log
    fetch('http://127.0.0.1:7565/ingest/535c9ee7-ba31-46b6-8b49-e6d0f10e717f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a79ca8'},body:JSON.stringify({sessionId:'a79ca8',runId:'initial',hypothesisId:'H1',location:'ProfilePage.tsx:handleUseCurrentLocation:start',message:'Use current location triggered',data:{hasGeolocation:!!navigator.geolocation},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported on this device.");
      return;
    }

    setLocationStatus("Detecting your current location...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // #region agent log
        fetch('http://127.0.0.1:7565/ingest/535c9ee7-ba31-46b6-8b49-e6d0f10e717f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a79ca8'},body:JSON.stringify({sessionId:'a79ca8',runId:'initial',hypothesisId:'H1',location:'ProfilePage.tsx:handleUseCurrentLocation:success',message:'Browser geolocation returned coordinates',data:{lat:coords.latitude,lng:coords.longitude},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setManualLatitude(String(coords.latitude));
        setManualLongitude(String(coords.longitude));
        setLocationStatus("Current location loaded. Click Save location.");
        setShowApplyLocationAction(true);
      },
      () => {
        setLocationStatus("Could not fetch current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  };

  const handleSaveManualLocation = async () => {
    if (!token) {
      setLocationStatus("Please log in first.");
      return;
    }

    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationStatus("Please enter valid numeric latitude and longitude.");
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setLocationStatus("Latitude must be -90 to 90, longitude must be -180 to 180.");
      return;
    }

    setIsSavingLocation(true);
    setLocationStatus("Saving location...");
    try {
      // #region agent log
      fetch('http://127.0.0.1:7565/ingest/535c9ee7-ba31-46b6-8b49-e6d0f10e717f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a79ca8'},body:JSON.stringify({sessionId:'a79ca8',runId:'initial',hypothesisId:'H2',location:'ProfilePage.tsx:handleSaveManualLocation:beforeApi',message:'Attempting manual location save',data:{lat:latitude,lng:longitude,hasToken:!!token},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const result = await updateMyLocation({ latitude, longitude }, token);
      // #region agent log
      fetch('http://127.0.0.1:7565/ingest/535c9ee7-ba31-46b6-8b49-e6d0f10e717f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a79ca8'},body:JSON.stringify({sessionId:'a79ca8',runId:'initial',hypothesisId:'H2',location:'ProfilePage.tsx:handleSaveManualLocation:afterApi',message:'Manual location save response',data:{success:!!result?.success,error:result?.error||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (result?.success) {
        setLocationStatus("Location updated successfully.");
        setShowApplyLocationAction(true);
      } else {
        setLocationStatus(result?.error || "Could not save location.");
      }
    } catch {
      setLocationStatus("Could not save location right now.");
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleApplyLocation = () => {
    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationStatus("Please enter valid numeric latitude and longitude.");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("friendsly-location-updated", {
        detail: { lat: latitude, lng: longitude },
      }),
    );
    // #region agent log
    fetch('http://127.0.0.1:7565/ingest/535c9ee7-ba31-46b6-8b49-e6d0f10e717f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a79ca8'},body:JSON.stringify({sessionId:'a79ca8',runId:'initial',hypothesisId:'H3',location:'ProfilePage.tsx:handleApplyLocation:dispatch',message:'Manual location apply event dispatched',data:{lat:latitude,lng:longitude},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setLocationStatus("Location applied to the app.");
    setShowApplyLocationAction(false);
  };

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken");
    if (t) {
      setToken(t);
      
      // Try to load profile from cache first for instant display
      const cachedProfile = localStorage.getItem("cachedProfile");
      if (cachedProfile) {
        try {
          const cached = JSON.parse(cachedProfile);
          const sanitizedCached = {
            ...cached,
            photo: typeof cached?.photo === 'string' && cached.photo.startsWith('blob:') ? '' : cached.photo,
          };
          setProfile(prev => ({ ...prev, ...sanitizedCached }));
          const cachedDarkMode = Boolean(cached?.dark_mode_enabled);
          const cachedTheme =
            typeof cached?.selected_theme === "string" && cached.selected_theme
              ? cached.selected_theme
              : "sage-coral";
          applyAndSetAppearance(cachedDarkMode, cachedTheme);
        } catch (e) {
          console.error("Failed to parse cached profile:", e);
        }
      }
      
      // Get user ID
      fetch(`${API_BASE}/api/user/me`, {
        headers: { "Authorization": `Bearer ${t}` },
      }).then(res => res.json()).then(data => {
        if (data?.user?.id) setUserId(data.user.id);
      });
      
      // Fetch fresh profile data
      fetchProfile(t).then((data) => {
        if (data?.data?.length) {
          const rawPhotoUrl = data.data[0].profile_photo_url || "";
          const sanitizedPhotoUrl = typeof rawPhotoUrl === 'string' && rawPhotoUrl.startsWith('blob:') ? '' : rawPhotoUrl;
          const profileData = {
            name: data.data[0].full_name || "",
            username: data.data[0].username || "",
            photo: sanitizedPhotoUrl,
            interests: data.data[0].bio || "",
            date_of_birth: data.data[0].date_of_birth || "",
            gender: data.data[0].gender || "",
            dark_mode_enabled: Boolean(data.data[0].dark_mode_enabled),
            selected_theme: data.data[0].selected_theme || "sage-coral",
            newPhotoFile: undefined
          };
          setProfile(profileData);
          applyAndSetAppearance(Boolean(data.data[0].dark_mode_enabled), data.data[0].selected_theme || "sage-coral");
          // Cache the profile for instant loading next time
          localStorage.setItem("cachedProfile", JSON.stringify(profileData));
          // Reset image error state when profile updates
          setImageLoadError(false);
        }
      });
    }
  }, []);
  // Also reload profile after edit
  useEffect(() => {
    if (editSuccess && token) {
      fetchProfile(token).then((data) => {
        if (data?.data?.length) {
          const rawPhotoUrl = data.data[0].profile_photo_url || "";
          const sanitizedPhotoUrl = typeof rawPhotoUrl === 'string' && rawPhotoUrl.startsWith('blob:') ? '' : rawPhotoUrl;
          const profileData = {
            name: data.data[0].full_name || "",
            username: data.data[0].username || "",
            photo: sanitizedPhotoUrl,
            interests: data.data[0].bio || "",
            date_of_birth: data.data[0].date_of_birth || "",
            gender: data.data[0].gender || "",
            dark_mode_enabled: Boolean(data.data[0].dark_mode_enabled),
            selected_theme: data.data[0].selected_theme || "sage-coral",
            newPhotoFile: undefined
          };
          setProfile(profileData);
          applyAndSetAppearance(Boolean(data.data[0].dark_mode_enabled), data.data[0].selected_theme || "sage-coral");
          // Update cache
          localStorage.setItem("cachedProfile", JSON.stringify(profileData));
          // Reset image error state
          setImageLoadError(false);
        }
      });
    }
  }, [editSuccess, token]);

  useEffect(() => {
    if (trustedContactsOpen && token) {
      loadTrustedContacts();
    }
  }, [trustedContactsOpen, token]);

  useEffect(() => {
    if (blockReportOpen && token) {
      loadBlockedUsers();
      setBlockReportError("");
      setBlockReportMessage("");
    }
  }, [blockReportOpen, token]);

  async function loadTrustedContacts() {
    setLoadingContacts(true);
    setContactsError("");
    try {
      const { getTrustedContacts } = await import("@/lib/api");
      const result = await getTrustedContacts(token);
      if (result?.data) {
        setTrustedContacts(result.data);
      } else {
        setContactsError(result?.error || "Failed to load trusted contacts");
      }
    } catch (err) {
      setContactsError(err instanceof Error ? err.message : "Error loading contacts");
    } finally {
      setLoadingContacts(false);
    }
  }

  async function loadBlockedUsers() {
    setBlockedLoading(true);
    setBlockReportError("");
    try {
      const { getBlockedUsers } = await import("@/lib/api");
      const result = await getBlockedUsers(token);
      if (result?.data) {
        setBlockedUsers(result.data);
      } else {
        setBlockReportError(result?.error || "Failed to load blocked users");
      }
    } catch (err) {
      setBlockReportError(err instanceof Error ? err.message : "Error loading blocked users");
    } finally {
      setBlockedLoading(false);
    }
  }

  async function handleSearchUsers(query: string) {
    setSearchUserQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setContactsError("");
      return;
    }

    setSearchingUsers(true);
    setContactsError("");
    try {
      const { searchUsers } = await import("@/lib/api");
      const result = await searchUsers(query, token);
      if (result?.data) {
        // Filter out users who are already trusted contacts
        const trustedIds = trustedContacts.map(c => c.contact_user_id);
        const filtered = result.data.filter((user: any) => !trustedIds.includes(user.user_id));
        setSearchResults(filtered);
      } else if (result?.error) {
        setContactsError(result.error);
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Search error:", err);
      setContactsError(err instanceof Error ? err.message : "Error searching users");
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }

  async function handleSearchBlockUsers(query: string) {
    setBlockSearchQuery(query);
    if (!query.trim()) {
      setBlockSearchResults([]);
      setBlockReportError("");
      return;
    }

    setSearchingBlockUsers(true);
    setBlockReportError("");
    try {
      const { searchUsers } = await import("@/lib/api");
      const result = await searchUsers(query, token);
      if (result?.data) {
        const filtered = (result.data as any[])
          .filter((user) => user.user_id !== userId)
          .filter((user) => !blockedUsers.some((blocked) => blocked.blocked_user_id === user.user_id));
        setBlockSearchResults(filtered);
      } else if (result?.error) {
        setBlockReportError(result.error);
        setBlockSearchResults([]);
      }
    } catch (err) {
      console.error("Block search error:", err);
      setBlockReportError(err instanceof Error ? err.message : "Error searching users");
      setBlockSearchResults([]);
    } finally {
      setSearchingBlockUsers(false);
    }
  }

  async function handleBlockUser(targetUserId: string) {
    setBlockingUserId(targetUserId);
    setBlockReportError("");
    setBlockReportMessage("");
    try {
      const { blockUser } = await import("@/lib/api");
      const result = await blockUser(targetUserId, token);
      if (result?.success) {
        setBlockReportMessage("User blocked successfully.");
        setBlockSearchResults((prev) => prev.filter((user) => user.user_id !== targetUserId));
        await loadBlockedUsers();
      } else {
        setBlockReportError(result?.error || "Failed to block user");
      }
    } catch (err) {
      setBlockReportError(err instanceof Error ? err.message : "Error blocking user");
    } finally {
      setBlockingUserId(null);
    }
  }

  async function handleUnblockUser(targetUserId: string) {
    setUnblockingUserId(targetUserId);
    setBlockReportError("");
    setBlockReportMessage("");
    try {
      const { unblockUser } = await import("@/lib/api");
      const result = await unblockUser(targetUserId, token);
      if (result?.success) {
        setBlockReportMessage("User unblocked successfully.");
        await loadBlockedUsers();
      } else {
        setBlockReportError(result?.error || "Failed to unblock user");
      }
    } catch (err) {
      setBlockReportError(err instanceof Error ? err.message : "Error unblocking user");
    } finally {
      setUnblockingUserId(null);
    }
  }

  function handleStartReport(user: any) {
    setReportingUser(user);
    setReportReason("");
    setBlockReportError("");
    setBlockReportMessage("");
  }

  async function handleSubmitReport() {
    if (!reportingUser) return;
    if (!reportReason.trim()) {
      setBlockReportError("Please enter a reason for the report.");
      return;
    }

    setReporting(true);
    setBlockReportError("");
    setBlockReportMessage("");

    try {
      const { reportUser } = await import("@/lib/api");
      const result = await reportUser(reportingUser.user_id, reportReason, token);
      if (result?.success) {
        setBlockReportMessage("Report submitted successfully.");
        setReportingUser(null);
        setReportReason("");
      } else {
        setBlockReportError(result?.error || "Failed to submit report");
      }
    } catch (err) {
      setBlockReportError(err instanceof Error ? err.message : "Error submitting report");
    } finally {
      setReporting(false);
    }
  }

  async function handleAddTrustedContact(userId: string) {
    setAddingContact(userId);
    try {
      const { addTrustedContact } = await import("@/lib/api");
      const result = await addTrustedContact(userId, token);
      if (result?.success) {
        setContactsError("");
        await loadTrustedContacts();
        setSearchUserQuery("");
        setSearchResults([]);
      } else {
        setContactsError(result?.error || "Failed to add contact");
      }
    } catch (err) {
      setContactsError(err instanceof Error ? err.message : "Error adding contact");
    } finally {
      setAddingContact(null);
    }
  }

  async function handleRemoveTrustedContact(userId: string) {
    try {
      const { removeTrustedContact } = await import("@/lib/api");
      const result = await removeTrustedContact(userId, token);
      if (result?.success) {
        await loadTrustedContacts();
      } else {
        setContactsError(result?.error || "Failed to remove contact");
      }
    } catch (err) {
      setContactsError(err instanceof Error ? err.message : "Error removing contact");
    }
  }

  async function handleEditProfile(e) {
    e.preventDefault();
    setEditError("");
    setEditSuccess(false);
    
    // If user selected a file but it's still uploading
    if (isUploadingImage) {
      setEditError('⏳ Still uploading image... please wait');
      return;
    }
    
    // If user is trying to save and has unsaved image, wait for it
    if (profile.newPhotoFile && profile.photo.startsWith('blob:')) {
      setEditError('⚠️ Please wait - image upload incomplete or wasn\'t processed. Try uploading again.');
      return;
    }
    
    // Use the already-uploaded URL from Supabase Storage (set in the file input onChange)
    // profile.photo will contain the real Supabase URL if upload succeeded
    console.log('Saving profile with photo URL:', profile.photo);
    const result = await editProfile({
      name: profile.name,
      username: profile.username,
      photo: profile.photo,
      interests: profile.interests,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      dark_mode_enabled: darkMode,
      selected_theme: selectedTheme,
      token
    });
    if (result.error) setEditError(result.error);
    else {
      setEditSuccess(true);
      setTimeout(() => setEditOpen(false), 800);
    }
  }

  const clearLocalSession = () => {
    localStorage.removeItem("supabaseToken");
    localStorage.removeItem("cachedProfile");
  };

  const handleLogoutCurrent = async () => {
    setLogoutLoading(true);
    setLogoutError("");
    try {
      if (token) {
        const result = await logoutCurrentSession(token);
        if (result?.error) {
          setLogoutError(result.error);
        }
      }
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      clearLocalSession();
      setLogoutLoading(false);
      setLogoutDialogOpen(false);
      navigate("/");
    }
  };

  const handleLogoutAll = async () => {
    setLogoutLoading(true);
    setLogoutError("");
    try {
      if (token) {
        const result = await logoutAllSessions(token);
        if (result?.error) {
          setLogoutError(result.error);
        }
      }
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      clearLocalSession();
      setLogoutLoading(false);
      setLogoutDialogOpen(false);
      navigate("/");
    }
  };

  const handleDeactivateAccount = async () => {
    setDeactivateLoading(true);
    setDeactivateError("");

    if (!token) {
      setDeactivateError("Please log in first.");
      setDeactivateLoading(false);
      return;
    }

    try {
      const result = await deactivateAccount(token);
      if (result?.error) {
        setDeactivateError(result.error);
        return;
      }
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : "Deactivation failed");
      return;
    } finally {
      setDeactivateLoading(false);
      setDeactivateDialogOpen(false);
    }

    clearLocalSession();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError("");

    if (!token) {
      setDeleteError("Please log in first.");
      setDeleteLoading(false);
      return;
    }

    try {
      const result = await deleteAccount(token);
      if (result?.error) {
        setDeleteError(result.error);
        return;
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      return;
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }

    clearLocalSession();
    navigate("/");
  };

  const toggleDownloadKey = (key: keyof typeof downloadSelection) => {
    setDownloadSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadData = async () => {
    if (!token) {
      setEditError("Please log in first.");
      return;
    }

    const include = Object.entries(downloadSelection)
      .filter(([, enabled]) => enabled)
      .map(([k]) => k)
      .join(",");

    if (!include) {
      setEditError("Select at least one category to download.");
      return;
    }

    setIsDownloading(true);
    setEditError("");
    try {
      const res = await fetch(`${API_BASE}/api/user/download?include=${encodeURIComponent(include)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || !json?.success || !json?.export) {
        throw new Error(json?.error || "Download failed");
      }

      const fileName = `friendsly-export-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(json.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadOpen(false);
    } catch (err: any) {
      setEditError(err?.message || "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* Profile card */}
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4 mb-8 animate-float-in">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold flex-shrink-0 overflow-hidden">
            {profile.photo && !imageLoadError ? (
              <img 
                src={profile.photo} 
                alt="Profile" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Profile image failed to load from URL:', profile.photo);
                  setImageLoadError(true);
                }}
                onLoad={() => {
                  console.log('Profile image loaded successfully:', profile.photo);
                  setImageLoadError(false);
                }}
              />
            ) : (
              <User className="w-7 h-7" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg text-foreground">{profile.name || "Your Name"}</p>
            <p className="text-sm text-muted-foreground">@{profile.username || "username"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{profile.interests ? profile.interests : "No interests yet"}</p>
          </div>
          <Button variant="soft" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
        </div>
        {/* Edit Profile Modal */}
        {editOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onSubmit={handleEditProfile}>
              <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
              <label className="block mb-2">Name</label>
              <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="mb-4" />
              <label className="block mb-2">Photo URL</label>
              <Input 
                value={profile.photo} 
                onChange={e => {
                  setProfile({ ...profile, photo: e.target.value });
                  console.log('Manual photo URL set to:', e.target.value);
                }} 
                className="mb-2" 
                placeholder="https://..."
              />
              {profile.photo && (
                <div className="text-xs text-gray-500 mb-3 break-all">
                  Current: {profile.photo.substring(0, 50)}...
                </div>
              )}
              <input type="file" accept="image/*" className="mb-4" onChange={async (e) => {
                const file = e.target.files[0];
                if (file && userId && token) {
                  // Show preview immediately with blob URL
                  const blobUrl = URL.createObjectURL(file);
                  console.log('File selected:', file.name);
                  setProfile(prev => ({ ...prev, newPhotoFile: file, photo: blobUrl }));
                  setEditError("");
                  setIsUploadingImage(true);
                  
                  // Upload to Supabase Storage
                  try {
                    console.log('⬆️ Starting image upload:', file.name, 'Size:', file.size);
                    const result = await (await import("@/lib/api")).uploadProfileImage(file, userId, token);
                    console.log('📦 Upload response:', result);
                    
                    if (result?.url) {
                      console.log('✅ Upload successful! URL:', result.url);
                      
                      if (result.url.startsWith('blob:')) {
                        console.error('❌ Error: Got blob URL instead of real URL from server!', result.url);
                        setEditError('Server returned temporary URL. Contact support if problem persists.');
                        setIsUploadingImage(false);
                      } else {
                        console.log('🔄 Updating profile with real URL...');
                        // Replace blob URL with actual Supabase Storage URL
                        setProfile(prev => {
                          console.log('Old photo:', prev.photo.substring(0, 50));
                          console.log('New photo:', result.url);
                          return { ...prev, photo: result.url, newPhotoFile: undefined };
                        });
                        setIsUploadingImage(false);
                        console.log('✨ Profile updated with real URL');
                      }
                    } else if (result?.error) {
                      console.error('❌ Upload error:', result.error);
                      setEditError("Failed to upload: " + result.error);
                      setIsUploadingImage(false);
                    } else {
                      console.error('❌ Unexpected response:', result);
                      setEditError("Unexpected response from server");
                      setIsUploadingImage(false);
                    }
                  } catch (err) {
                    console.error('💥 Upload exception:', err);
                    setEditError("Error uploading image: " + err.message);
                    setIsUploadingImage(false);
                  }
                }
              }} />
              {profile.newPhotoFile && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <img 
                    src={profile.photo} 
                    alt="Preview" 
                    className="w-20 h-20 rounded-full object-cover mb-2 border-2 border-blue-300"
                    onError={(e) => console.error('Preview image failed to load:', profile.photo)}
                  />
                  {isUploadingImage ? (
                    <p className="text-xs text-blue-600">⏳ <strong>Uploading...</strong> Do not close this dialog</p>
                  ) : profile.photo.startsWith('blob:') ? (
                    <p className="text-xs text-orange-600">⚠️ Upload may not have completed. Try uploading again.</p>
                  ) : (
                    <p className="text-xs text-green-600">✅ <strong>Image uploaded successfully!</strong> You can now save.</p>
                  )}
                </div>
              )}
              <label className="block mb-2">Interests</label>
              <Input value={profile.interests} onChange={e => setProfile({ ...profile, interests: e.target.value })} className="mb-4" />
              <div className="flex gap-2 mt-4">
                <Button 
                  type="submit" 
                  variant="hero"
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? '⏳ Uploading...' : 'Save'}
                </Button>
                <Button type="button" variant="soft" onClick={() => setEditOpen(false)}>Cancel</Button>
              </div>
              {editError && <div className="text-red-500 mt-2 text-sm">{editError}</div>}
              {editSuccess && <div className="text-green-600 mt-2">Profile updated!</div>}
            </form>
          </div>
        )}

       

        <Card className="glass-card rounded-2xl border-border/50 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Notifications & Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Notification management</p>
                </div>
                <Button variant="outline" size="sm">Customize</Button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quiet hours</span>
                <Switch checked={quietHours} onCheckedChange={setQuietHours} />
              </div>
            </div>

            <div className="glass-card rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium">Accessibility + UX</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dark mode</span>
                <Switch
                  checked={darkMode}
                  onCheckedChange={(value) => {
                    if (value) {
                      if ((LIGHT_THEMES as readonly string[]).includes(selectedTheme)) {
                        lastLightThemeRef.current = selectedTheme;
                      }
                      const normalized = applyAndSetAppearance(true, DARK_THEME);
                      void persistAppearance(normalized.isDark, normalized.theme);
                      return;
                    }

                    const restoredTheme = lastLightThemeRef.current || "sandy";
                    const normalized = applyAndSetAppearance(false, restoredTheme);
                    void persistAppearance(normalized.isDark, normalized.theme);
                  }}
                />
              </div>
              <Select
                value={selectedTheme}
                onValueChange={(value) => {
                  if (darkMode) {
                    if (value !== DARK_THEME) return;
                    const normalized = applyAndSetAppearance(true, value);
                    void persistAppearance(normalized.isDark, normalized.theme);
                    return;
                  }

                  if (!(LIGHT_THEMES as readonly string[]).includes(value)) return;
                  lastLightThemeRef.current = value;
                  const normalized = applyAndSetAppearance(false, value);
                  void persistAppearance(normalized.isDark, normalized.theme);
                }}
              >
                <SelectTrigger disabled={darkMode}>
                  <SelectValue placeholder="Theme preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sage-coral" disabled={darkMode}>Sage Green</SelectItem>
                  <SelectItem value="sandy" disabled={darkMode}>Sandy</SelectItem>
                  <SelectItem value="muted-night" disabled={!darkMode}>Muted Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl border-border/50 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="glass-card rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium">Set your location manually</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Latitude (e.g. 24.8607)"
                  value={manualLatitude}
                  onChange={(e) => setManualLatitude(e.target.value)}
                />
                <Input
                  placeholder="Longitude (e.g. 67.0011)"
                  value={manualLongitude}
                  onChange={(e) => setManualLongitude(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleUseCurrentLocation}>
                  Use current location
                </Button>
                <Button
                  type="button"
                  variant="hero"
                  onClick={handleSaveManualLocation}
                  disabled={isSavingLocation}
                >
                  {isSavingLocation ? "Saving..." : "Save location"}
                </Button>
                {showApplyLocationAction && (
                  <Button type="button" variant="soft" onClick={handleApplyLocation}>
                    Apply this location
                  </Button>
                )}
              </div>
              {locationStatus && <p className="text-xs text-muted-foreground">{locationStatus}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl border-border/50 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setDeactivateError("");
                setDeactivateDialogOpen(true);
              }}
            >
              <UserX className="w-4 h-4" /> Deactivate account
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setEditError("");
                setDownloadOpen(true);
              }}
            >
              <Download className="w-4 h-4" /> Download my data
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setLogoutDialogOpen(true)}>
              <LogOut className="w-4 h-4" /> Log out
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => {
                setDeleteError("");
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" /> Delete account
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download my data</DialogTitle>
            <DialogDescription>Select what you want to export.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <Checkbox checked={downloadSelection.profile} onCheckedChange={() => toggleDownloadKey("profile")} />
              <span className="text-sm">Profile + account</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={downloadSelection.intent} onCheckedChange={() => toggleDownloadKey("intent")} />
              <span className="text-sm">Intent preferences</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={downloadSelection.location} onCheckedChange={() => toggleDownloadKey("location")} />
              <span className="text-sm">Last known location</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={downloadSelection.friends} onCheckedChange={() => toggleDownloadKey("friends")} />
              <span className="text-sm">Friends + requests</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={downloadSelection.hangouts} onCheckedChange={() => toggleDownloadKey("hangouts")} />
              <span className="text-sm">Hangouts + participation</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={downloadSelection.chats} onCheckedChange={() => toggleDownloadKey("chats")} />
              <span className="text-sm">Group chats + messages</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={downloadSelection.posts} onCheckedChange={() => toggleDownloadKey("posts")} />
              <span className="text-sm">Posts + my likes/comments</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDownloadOpen(false)} disabled={isDownloading}>
              Cancel
            </Button>
            <Button variant="hero" type="button" onClick={handleDownloadData} disabled={isDownloading}>
              {isDownloading ? "Preparing…" : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out</DialogTitle>
            <DialogDescription>Choose whether to log out only this device or all devices.</DialogDescription>
          </DialogHeader>

          {logoutError && <div className="text-sm text-destructive">{logoutError}</div>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setLogoutDialogOpen(false)} disabled={logoutLoading}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handleLogoutCurrent()} disabled={logoutLoading}>
              {logoutLoading ? "Logging out..." : "This device"}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleLogoutAll()} disabled={logoutLoading}>
              {logoutLoading ? "Logging out..." : "All devices"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate account</DialogTitle>
            <DialogDescription>
              Your account will be deactivated and you will be logged out. You can reactivate by logging in again.
            </DialogDescription>
          </DialogHeader>

          {deactivateError && <p className="text-sm text-destructive">{deactivateError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeactivateDialogOpen(false)} disabled={deactivateLoading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeactivateAccount} disabled={deactivateLoading}>
              {deactivateLoading ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account permanently</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data will be removed.
            </DialogDescription>
          </DialogHeader>

          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteAccount} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trustedContactsOpen} onOpenChange={setTrustedContactsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trusted Emergency Contacts</DialogTitle>
            <DialogDescription>
              Add friends who can access your location in emergencies
            </DialogDescription>
          </DialogHeader>

          {contactsError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              {contactsError}
            </div>
          )}

          <div className="space-y-4">
            {/* Search and Add Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Add Contact</label>
              <Input
                placeholder="Search friends by name or username"
                value={searchUserQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                className="h-10"
              />
              
              {searchingUsers && <div className="text-xs text-muted-foreground">Searching...</div>}
              
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2 bg-muted/30">
                  {searchResults.map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between gap-2 p-2 bg-card rounded border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="hero"
                        onClick={() => handleAddTrustedContact(user.user_id)}
                        disabled={addingContact === user.user_id}
                        className="shrink-0"
                      >
                        {addingContact === user.user_id ? "..." : "Add"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!searchingUsers && searchUserQuery && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground">No matching friends found</p>
              )}
            </div>

            {/* Current Contacts List */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Trusted Contacts ({trustedContacts.length})</label>
              
              {loadingContacts && <div className="text-xs text-muted-foreground">Loading...</div>}
              
              {trustedContacts.length === 0 && !loadingContacts && (
                <p className="text-xs text-muted-foreground py-4 text-center">No trusted contacts yet</p>
              )}
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {trustedContacts.map((contact) => (
                  <div
                    key={contact.contact_id}
                    className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {contact.contact_profile?.full_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{contact.contact_profile?.username || "unknown"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveTrustedContact(contact.contact_user_id)}
                      className="shrink-0 text-destructive hover:text-destructive"
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTrustedContactsOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockReportOpen} onOpenChange={setBlockReportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Block and report</DialogTitle>
            <DialogDescription>
              Search for a user to block or submit a report. You can also manage currently blocked users here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(blockReportError || blockReportMessage) && (
              <div className={`rounded-xl p-3 ${blockReportError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                {blockReportError || blockReportMessage}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium">Search users to block/report</label>
              <Input
                placeholder="Search by name or username"
                value={blockSearchQuery}
                onChange={(e) => handleSearchBlockUsers(e.target.value)}
                className="h-10"
              />
              {searchingBlockUsers && <p className="text-xs text-muted-foreground">Searching...</p>}
              {blockSearchResults.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto rounded-xl border border-border/50 bg-background p-2">
                  {blockSearchResults.map((user) => (
                    <div key={user.user_id} className="flex flex-col gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{user.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBlockUser(user.user_id)}
                            disabled={blockingUserId === user.user_id}
                          >
                            {blockingUserId === user.user_id ? 'Blocking…' : 'Block'}
                          </Button>
                          <Button
                            size="sm"
                            variant="hero"
                            onClick={() => handleStartReport(user)}
                          >
                            Report
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{user.bio || 'No profile summary available.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                blockSearchQuery.trim() && !searchingBlockUsers && (
                  <p className="text-xs text-muted-foreground">No users found.</p>
                )
              )}
            </div>

            {reportingUser && (
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Reporting {reportingUser.full_name || '@' + reportingUser.username}</p>
                    <p className="text-xs text-muted-foreground">This report will be sent to moderators for review.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setReportingUser(null)}>
                    Cancel
                  </Button>
                </div>

                <Textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe the issue or behavior that violated community guidelines"
                  className="min-h-[120px]"
                />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setReportingUser(null)}>
                    Cancel
                  </Button>
                  <Button variant="hero" size="sm" onClick={handleSubmitReport} disabled={reporting}>
                    {reporting ? 'Submitting…' : 'Submit report'}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Blocked users</p>
                {blockedLoading && <span className="text-xs text-muted-foreground">Refreshing…</span>}
              </div>
              {blockedUsers.length === 0 && !blockedLoading ? (
                <p className="text-xs text-muted-foreground">You have not blocked anyone yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl border border-border/50 bg-background p-2">
                  {blockedUsers.map((entry) => {
                    const blockedProfile = entry.blocked_profile || {};
                    return (
                      <div key={entry.blocked_user_id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 p-3">
                        <div>
                          <p className="font-medium">{blockedProfile.full_name || 'Unknown user'}</p>
                          <p className="text-xs text-muted-foreground">@{blockedProfile.username || 'unknown'}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnblockUser(entry.blocked_user_id)}
                          disabled={unblockingUserId === entry.blocked_user_id}
                        >
                          {unblockingUserId === entry.blocked_user_id ? 'Unblocking…' : 'Unblock'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockReportOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;

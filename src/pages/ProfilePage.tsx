import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Ghost, Bell, Shield, LogOut, Trash2, User, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { editProfile } from "@/lib/api";

async function fetchProfile(token) {
  // Get user id from token
  const resUser = await fetch("http://localhost:3001/api/user/me", {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const userJson = await resUser.json();
  const userId = userJson?.user?.id;
  if (!userId) return { data: [] };
  const res = await fetch(`http://localhost:3001/api/user/download?id=${userId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  return res.json();
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const [ghostMode, setGhostMode] = useState(false);
  const [quietHours, setQuietHours] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken");
    if (t) setToken(t);
    if (t) {
      // Get user ID
      fetch("http://localhost:3001/api/user/me", {
        headers: { "Authorization": `Bearer ${t}` },
      }).then(res => res.json()).then(data => {
        if (data?.user?.id) setUserId(data.user.id);
      });
      
      fetchProfile(t).then((data) => {
        if (data?.data?.length) {
          setProfile({
            name: data.data[0].full_name || "",
            username: data.data[0].username || "",
            photo: data.data[0].profile_photo_url || "",
            interests: data.data[0].bio || "",
            date_of_birth: data.data[0].date_of_birth || "",
            gender: data.data[0].gender || "",
            newPhotoFile: undefined
          });
        }
      });
    }
  }, []);
  // Also reload profile after edit
  useEffect(() => {
    if (editSuccess && token) {
      fetchProfile(token).then((data) => {
        if (data?.data?.length) {
          setProfile({
            name: data.data[0].full_name || "",
            username: data.data[0].username || "",
            photo: data.data[0].profile_photo_url || "",
            interests: data.data[0].bio || "",
            date_of_birth: data.data[0].date_of_birth || "",
            gender: data.data[0].gender || "",
            newPhotoFile: undefined
          });
        }
      });
    }
  }, [editSuccess, token]);

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

  async function handleEditProfile(e) {
    e.preventDefault();
    setEditError("");
    setEditSuccess(false);
    let photoUrl = profile.photo;
    if (profile.newPhotoFile) {
      // Show preview immediately
      photoUrl = URL.createObjectURL(profile.newPhotoFile);
      setProfile(prev => ({ ...prev, photo: photoUrl }));
      // TODO: Upload image to Supabase storage and get real URL
      // For now, just use preview URL
    }
    const result = await editProfile({
      name: profile.name,
      username: profile.username,
      photo: photoUrl,
      interests: profile.interests,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      token
    });
    if (result.error) setEditError(result.error);
    else {
      setEditSuccess(true);
      setTimeout(() => setEditOpen(false), 800);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-6">Profile</h1>

        {/* Profile card */}
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4 mb-8 animate-float-in">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
            {profile.photo ? <img src={profile.photo} alt="Profile" className="w-16 h-16 rounded-full object-cover" /> : <User className="w-7 h-7" />}
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
              <Input value={profile.photo} onChange={e => setProfile({ ...profile, photo: e.target.value })} className="mb-2" />
              <input type="file" accept="image/*" className="mb-4" onChange={async (e) => {
                const file = e.target.files[0];
                if (file && userId && token) {
                  // Show preview immediately
                  setProfile(prev => ({ ...prev, newPhotoFile: file, photo: URL.createObjectURL(file) }));
                  // Upload to Supabase Storage
                  try {
                    const result = await (await import("@/lib/api")).uploadProfileImage(file, userId, token);
                    if (result.url) {
                      setProfile(prev => ({ ...prev, photo: result.url }));
                    } else if (result.error) {
                      setEditError("Failed to upload image: " + result.error);
                    }
                  } catch (err) {
                    setEditError("Error uploading image");
                  }
                }
              }} />
              {profile.newPhotoFile && (
                <img src={profile.photo} alt="Preview" className="w-20 h-20 rounded-full object-cover mb-4" />
              )}
              <label className="block mb-2">Interests</label>
              <Input value={profile.interests} onChange={e => setProfile({ ...profile, interests: e.target.value })} className="mb-4" />
              <div className="flex gap-2 mt-4">
                <Button type="submit" variant="hero">Save</Button>
                <Button type="button" variant="soft" onClick={() => setEditOpen(false)}>Cancel</Button>
              </div>
              {editError && <div className="text-red-500 mt-2">{editError}</div>}
              {editSuccess && <div className="text-green-600 mt-2">Profile updated!</div>}
            </form>
          </div>
        )}

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

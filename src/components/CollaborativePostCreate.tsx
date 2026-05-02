import { useState, useRef, ChangeEvent } from "react";
import { Users, X, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCollaborativePost, getAcceptedFriends } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface CollaborativePostCreateProps {
  open: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

interface Friend {
  user_id: string;
  full_name: string;
  username: string;
  profile_photo_url?: string;
}

export default function CollaborativePostCreate({ open, onClose, onPostCreated }: CollaborativePostCreateProps) {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<string>("friends");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load friends when dialog opens
  useState(() => {
    if (open) {
      loadFriends();
    }
  });

  const loadFriends = async () => {
    const token = localStorage.getItem("supabaseToken");
    if (!token) return;

    try {
      const result = await getAcceptedFriends(token);
      if (result?.data) {
        setFriends(result.data);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ 
        title: "Invalid file", 
        description: "Please select an image or video file." 
      });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast({ 
        title: "File too large", 
        description: "Please select a file smaller than 15MB." 
      });
      return;
    }

    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleAddCollaborator = (friendId: string) => {
    if (collaborators.includes(friendId)) {
      setCollaborators(collaborators.filter(id => id !== friendId));
    } else {
      setCollaborators([...collaborators, friendId]);
    }
  };

  const handleCreatePost = async () => {
    if (!content.trim() && !selectedFile) {
      toast({ 
        title: "Content required", 
        description: "Please add text content or select a file." 
      });
      return;
    }

    const token = localStorage.getItem("supabaseToken");
    if (!token) {
      toast({ 
        title: "Not authenticated", 
        description: "Please log in to create a post." 
      });
      return;
    }

    setLoading(true);
    try {
      let mediaUrl = undefined;
      let mediaType = undefined;

      if (selectedFile) {
        // Upload media first (using existing uploadPostMedia function)
        const { uploadPostMedia } = await import("@/lib/api");
        const uploadResult = await uploadPostMedia(selectedFile, token);
        if (!uploadResult?.url) {
          toast({
            title: "Upload failed",
            description: uploadResult?.error || "Could not upload media.",
          });
          return;
        }
        mediaUrl = uploadResult.url;
        mediaType = selectedFile.type.startsWith("video/") ? "video" : "image";
      }

      // Create collaborative post
      const result = await createCollaborativePost({
        content: content.trim() || undefined,
        media_url: mediaUrl,
        media_type: mediaType,
        visibility,
        collaborators: collaborators.length > 0 ? collaborators : undefined,
      }, token);
      
      if (result?.success) {
        toast({ 
          title: "Collaborative post created", 
          description: "Your post has been created successfully." 
        });
        onPostCreated();
        handleClose();
      } else {
        toast({
          title: "Post creation failed",
          description: result?.error || "Could not create post.",
        });
      }
    } catch (error) {
      toast({
        title: "Creation failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setVisibility("friends");
    setCollaborators([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Collaborative Post</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Content Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts..."
              className="w-full min-h-[100px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Media (Optional)</label>
            {!selectedFile ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center mb-2">
                    Add an image or video
                  </p>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="relative">
                {selectedFile.type.startsWith("video/") ? (
                  <video
                    src={previewUrl!}
                    controls
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                ) : (
                  <img
                    src={previewUrl!}
                    alt="Media preview"
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedFile(null);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                    }
                    setPreviewUrl(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Visibility</label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friends">Friends Only</SelectItem>
                <SelectItem value="close_friends">Close Friends</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Collaborators */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <label className="text-sm font-medium">Collaborators</label>
              <span className="text-xs text-muted-foreground">
                ({collaborators.length} selected)
              </span>
            </div>
            
            {loadingFriends ? (
              <p className="text-sm text-muted-foreground">Loading friends...</p>
            ) : friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">No friends available to collaborate with</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {friends.map((friend) => (
                  <div
                    key={friend.user_id}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                      collaborators.includes(friend.user_id)
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => handleAddCollaborator(friend.user_id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
                      {friend.profile_photo_url ? (
                        <img
                          src={friend.profile_photo_url}
                          alt={friend.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">
                          {friend.full_name?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{friend.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      collaborators.includes(friend.user_id)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground"
                    }`}>
                      {collaborators.includes(friend.user_id) && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreatePost}
              disabled={loading || (!content.trim() && !selectedFile)}
            >
              {loading ? "Creating..." : "Create Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

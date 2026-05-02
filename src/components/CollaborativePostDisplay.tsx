import { useState } from "react";
import { Users, Edit, Trash2, Heart, MessageCircle, Share2, MoreVertical, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { updateCollaborativePost, deleteCollaborativePost, addCollaborator, removeCollaborator } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface Collaborator {
  user_id: string;
  user_profiles: {
    full_name: string;
    username: string;
    profile_photo_url?: string;
  };
}

interface Comment {
  comment_id: string;
  content: string;
  user_id: string;
  created_at: string;
  user_profiles: {
    full_name: string;
    username: string;
    profile_photo_url?: string;
  };
}

interface CollaborativePost {
  post_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  visibility: string;
  is_collaborative: boolean;
  created_at: string;
  user_profiles: {
    full_name: string;
    username: string;
    profile_photo_url?: string;
  };
  post_collaborators: Collaborator[];
  post_likes: Array<{ user_id: string }>;
  post_comments: Comment[];
}

interface CollaborativePostDisplayProps {
  post: CollaborativePost;
  onUpdate: () => void;
  currentUserId: string;
}

export default function CollaborativePostDisplay({ post, onUpdate, currentUserId }: CollaborativePostDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [loading, setLoading] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);

  const isCreator = post.user_id === currentUserId;
  const isCollaborator = post.post_collaborators.some(c => c.user_id === currentUserId);
  const canEdit = isCreator || isCollaborator;

  const handleSaveEdit = async () => {
    const token = localStorage.getItem("supabaseToken");
    if (!token) return;

    setLoading(true);
    try {
      const result = await updateCollaborativePost(post.post_id, {
        content: editContent.trim()
      }, token);
      
      if (result?.success) {
        toast({ title: "Post updated successfully" });
        setIsEditing(false);
        onUpdate();
      } else {
        toast({
          title: "Update failed",
          description: result?.error || "Could not update post.",
        });
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isCreator) {
      toast({ title: "Only the creator can delete this post" });
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this collaborative post?");
    if (!confirmed) return;

    const token = localStorage.getItem("supabaseToken");
    if (!token) return;

    setLoading(true);
    try {
      const result = await deleteCollaborativePost(post.post_id, token);
      
      if (result?.success) {
        toast({ title: "Post deleted successfully" });
        onUpdate();
      } else {
        toast({
          title: "Delete failed",
          description: result?.error || "Could not delete post.",
        });
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoTime: string) => {
    try {
      const date = new Date(isoTime);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <>
      <Card className="glass-card rounded-2xl border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
                {post.user_profiles?.profile_photo_url ? (
                  <img
                    src={post.user_profiles.profile_photo_url}
                    alt={post.user_profiles.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
                    {post.user_profiles?.full_name?.[0] || 'U'}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">
                    {post.user_profiles?.full_name || 'Unknown'}
                  </p>
                  {post.is_collaborative && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>Collaborative</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(post.created_at)} • {post.visibility}
                </p>
              </div>
            </div>

            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShowCollaborators(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    View Collaborators
                  </DropdownMenuItem>
                  {isCreator && (
                    <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setIsEditing(false);
                  setEditContent(post.content);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
          )}

          {/* Media */}
          {post.media_url && (
            <div className="rounded-lg overflow-hidden">
              {post.media_type === "video" ? (
                <video
                  src={post.media_url}
                  controls
                  className="w-full max-h-96 object-cover"
                />
              ) : (
                <img
                  src={post.media_url}
                  alt="Post media"
                  className="w-full max-h-96 object-cover"
                />
              )}
            </div>
          )}

          {/* Collaborators */}
          {post.post_collaborators.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {post.post_collaborators.slice(0, 5).map((collaborator) => (
                  <div
                    key={collaborator.user_id}
                    className="w-6 h-6 rounded-full bg-gray-300 overflow-hidden border-2 border-background"
                  >
                    {collaborator.user_profiles?.profile_photo_url ? (
                      <img
                        src={collaborator.user_profiles.profile_photo_url}
                        alt={collaborator.user_profiles.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">
                        {collaborator.user_profiles?.full_name?.[0] || 'U'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {post.post_collaborators.length} collaborator{post.post_collaborators.length !== 1 ? 's' : ''}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto p-0 text-xs"
                onClick={() => setShowCollaborators(true)}
              >
                View all
              </Button>
            </div>
          )}

          {/* Engagement */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Heart className="h-4 w-4 mr-1" />
                {post.post_likes.length}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <MessageCircle className="h-4 w-4 mr-1" />
                {post.post_comments.length}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collaborators Dialog */}
      <Dialog open={showCollaborators} onOpenChange={setShowCollaborators}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collaborators</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {post.post_collaborators.map((collaborator) => (
              <div key={collaborator.user_id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
                  {collaborator.user_profiles?.profile_photo_url ? (
                    <img
                      src={collaborator.user_profiles.profile_photo_url}
                      alt={collaborator.user_profiles.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
                      {collaborator.user_profiles?.full_name?.[0] || 'U'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{collaborator.user_profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">@{collaborator.user_profiles?.username}</p>
                </div>
                {collaborator.user_id === post.user_id && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Creator
                  </span>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

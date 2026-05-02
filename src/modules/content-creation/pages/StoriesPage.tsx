import { useState, useEffect } from "react";
import { Plus, Eye, Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StoryUpload from "@/components/StoryUpload";
import StoryDisplay from "@/components/StoryDisplay";
import { getStories } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface Story {
  story_id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  visibility: string;
  created_at: string;
  expires_at: string;
  author: {
    full_name?: string;
    username?: string;
    profile_photo_url?: string;
  } | null;
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    const token = localStorage.getItem("supabaseToken");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const result = await getStories(token);
      if (result?.data) {
        setStories(result.data);
      }
    } catch (error) {
      toast({
        title: "Failed to load stories",
        description: error instanceof Error ? error.message : "Could not load stories.",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const currentUserId = localStorage.getItem("supabaseToken") ? 
    JSON.parse(atob(localStorage.getItem("supabaseToken")!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Stories</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Share moments that disappear after 24 hours
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Story
          </Button>
        </div>

        {/* Story count and quick actions */}
        <Card className="glass-card rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{stories.length}</p>
                  <p className="text-xs text-muted-foreground">Active Stories</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {stories.filter(s => s.user_id === currentUserId).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Your Stories</p>
                </div>
              </div>
              <div className="flex gap-2">
                {stories.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayOpen(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Stories
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Story
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stories list */}
        <Card className="glass-card rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Stories
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <div className="text-sm text-muted-foreground">Loading stories...</div>}

            {!loading && !stories.length && (
              <div className="glass-card rounded-xl p-8 text-center">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">No active stories</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Stories from your friends will appear here
                </p>
                <Button onClick={() => setUploadOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Story
                </Button>
              </div>
            )}

            {!loading && stories.map((story) => (
              <div
                key={story.story_id}
                className="glass-card rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-300 overflow-hidden">
                      {story.author?.profile_photo_url ? (
                        <img
                          src={story.author.profile_photo_url}
                          alt={story.author.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
                          {story.author?.full_name?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {story.author?.full_name || story.author?.username || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{story.media_type === 'video' ? 'Video' : 'Image'}</span>
                        <span>•</span>
                        <span>{formatTimeRemaining(story.expires_at)}</span>
                        {story.user_id === currentUserId && (
                          <>
                            <span>•</span>
                            <span className="text-primary">Your Story</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                      {story.media_type === "video" ? (
                        <video
                          src={story.media_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={story.media_url}
                          alt="Story thumbnail"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <BottomNav />

      <StoryUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onStoryCreated={loadStories}
      />

      <StoryDisplay
        open={displayOpen}
        onClose={() => setDisplayOpen(false)}
      />
    </div>
  );
}

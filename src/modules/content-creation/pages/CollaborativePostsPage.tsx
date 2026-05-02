import { useState, useEffect } from "react";
import { Plus, Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CollaborativePostCreate from "@/components/CollaborativePostCreate";
import CollaborativePostDisplay from "@/components/CollaborativePostDisplay";
import { getCollaborativePosts } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

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
  post_collaborators: Array<{
    user_id: string;
    user_profiles: {
      full_name: string;
      username: string;
      profile_photo_url?: string;
    };
  }>;
  post_likes: Array<{ user_id: string }>;
  post_comments: Array<{
    comment_id: string;
    content: string;
    user_id: string;
    created_at: string;
    user_profiles: {
      full_name: string;
      username: string;
      profile_photo_url?: string;
    };
  }>;
}

export default function CollaborativePostsPage() {
  const [posts, setPosts] = useState<CollaborativePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const token = localStorage.getItem("supabaseToken");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const result = await getCollaborativePosts(token);
      if (result?.data) {
        setPosts(result.data);
      }
    } catch (error) {
      toast({
        title: "Failed to load posts",
        description: error instanceof Error ? error.message : "Could not load collaborative posts.",
      });
    } finally {
      setLoading(false);
    }
  };

  const currentUserId = localStorage.getItem("supabaseToken") ? 
    JSON.parse(atob(localStorage.getItem("supabaseToken")!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Collaborative Posts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and edit posts together with your friends
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </div>

        {/* Stats */}
        <Card className="glass-card rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{posts.length}</p>
                  <p className="text-xs text-muted-foreground">Total Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {posts.filter(p => p.user_id === currentUserId).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Your Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {posts.filter(p => p.post_collaborators.some(c => c.user_id === currentUserId)).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Collaborating</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPosts}
              >
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Posts List */}
        <div className="space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Loading posts...</div>}

          {!loading && !posts.length && (
            <Card className="glass-card rounded-2xl border-border/50">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">No collaborative posts yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Start creating posts with your friends
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Post
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && posts.map((post) => (
            <CollaborativePostDisplay
              key={post.post_id}
              post={post}
              onUpdate={loadPosts}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </div>

      <BottomNav />

      <CollaborativePostCreate
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onPostCreated={loadPosts}
      />
    </div>
  );
}

import { useEffect, useMemo, useState, useCallback } from "react";
import { Heart, MessageCircle, Plus, User, Users, Eye, Clock, ImagePlus, Play } from "lucide-react";

import BottomNav from "@/components/BottomNav";
import PostCreate from "@/components/PostCreate";
import StoryUpload from "@/components/StoryUpload";
import StoryDisplay from "@/components/StoryDisplay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  addPostComment,
  createMediaPost,
  getMediaFeed,
  getPostComments,
  togglePostLike,
  uploadPostMedia,
  type MediaComment,
  type MediaPost,
} from "../services/mediaApi";
import { getStories } from "@/lib/api";
import type { Story } from "@/lib/api";

const MediaPage = () => {
  const [token, setToken] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingStories, setLoadingStories] = useState(true);
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStories, setActiveStories] = useState<Story[]>([]);

  // Post creation dialog
  const [postCreateOpen, setPostCreateOpen] = useState(false);

  // Story modals
  const [storyUploadOpen, setStoryUploadOpen] = useState(false);
  const [storyDisplayOpen, setStoryDisplayOpen] = useState(false);

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, MediaComment[]>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const storedToken = localStorage.getItem("supabaseToken") || "";
    setToken(storedToken);
  }, []);

  // Load posts
  const loadPosts = useCallback(async () => {
    if (!token) return;
    setLoadingPosts(true);
    try {
      const result = await getMediaFeed(token);
      if (Array.isArray(result?.data)) {
        setPosts(result.data);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't load posts", variant: "destructive" });
    } finally {
      setLoadingPosts(false);
    }
  }, [token]);

  // Load stories
  const loadStories = useCallback(async () => {
    if (!token) {
      setLoadingStories(false);
      return;
    }
    try {
      const result = await getStories(token);
      if (result?.data) {
        const filtered = result.data.filter((s: Story) => new Date(s.expires_at) > new Date());
        setStories(result.data);
        setActiveStories(filtered);
      }
    } catch (error) {
      toast({
        title: "Failed to load stories",
        description: "Could not load stories.",
      });
    } finally {
      setLoadingStories(false);
    }
  }, [token]);

  // Auto-refresh stories every 5 minutes
  useEffect(() => {
    loadStories();
    const interval = setInterval(loadStories, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadStories]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const currentUserId = localStorage.getItem("supabaseToken") ? 
    JSON.parse(atob(localStorage.getItem("supabaseToken")!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub : null;

  // Post interaction handlers (unchanged)
  const onToggleLike = async (postId: string) => {
    if (!token) return;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.post_id === postId
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: Math.max(0, (p.like_count || 0) + (p.liked_by_me ? -1 : 1)),
            }
          : p,
      ),
    );
    try {
      const result = await togglePostLike(postId, token);
      if (!result?.success) {
        throw new Error(result?.error || "Like failed");
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't update like", description: "Try again." });
      loadPosts();
    }
  };

  const onToggleComments = async (postId: string) => {
    const isOpen = Boolean(expandedComments[postId]);
    setExpandedComments((prev) => ({ ...prev, [postId]: !isOpen }));

    if (isOpen) return;
    if (commentsByPost[postId]) return;
    if (!token) return;

    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const result = await getPostComments(postId, token);
      if (Array.isArray(result?.data)) {
        setCommentsByPost((prev) => ({ ...prev, [postId]: result.data }));
      } else {
        setCommentsByPost((prev) => ({ ...prev, [postId]: [] }));
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't load comments", description: "Try again." });
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const onAddComment = async (postId: string) => {
    if (!token) return;

    const draft = (commentDraftByPost[postId] || "").trim();
    if (!draft) return;

    setCommentDraftByPost((prev) => ({ ...prev, [postId]: "" }));
    try {
      const result = await addPostComment(postId, draft, token);
      if (!result?.success) {
        throw new Error(result?.error || "Failed to comment");
      }

      setCommentsByPost((prev) => {
        const existing = prev[postId] || [];
        return { ...prev, [postId]: [...existing, result.data] };
      });

      setPosts((prev) =>
        prev.map((p) =>
          p.post_id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p,
        ),
      );
    } catch (err: any) {
      console.error(err);
      toast({ title: "Couldn't comment", description: err?.message || "Try again." });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Media & Stories</h1>
          <p className="text-sm text-muted-foreground">Stories • Posts from friends</p>
        </div>

        {/* Create Story Button */}
        <div className="flex gap-3">
          <Button onClick={() => setStoryUploadOpen(true)} className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            Create Story
          </Button>
          <Button onClick={() => setPostCreateOpen(true)} variant="outline" className="flex-1">
            Create Post
          </Button>
        </div>

        {/* Stories Section */}
        <Card className="glass-card rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Active Stories ({activeStories.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingStories && <div className="text-sm text-muted-foreground">Loading stories...</div>}

            {!loadingStories && !activeStories.length && (
              <div className="glass-card rounded-xl p-8 text-center">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">No active stories</p>
                <p className="text-xs text-muted-foreground mb-4">Stories from your friends will appear here</p>
                <Button onClick={() => setStoryUploadOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Story
                </Button>
              </div>
            )}

            {!loadingStories && activeStories.map((story) => (
              <div
                key={story.story_id}
                className="glass-card rounded-xl p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setStoryDisplayOpen(true)}
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
                        {formatTimeRemaining(story.expires_at) && (
                          <span>{formatTimeRemaining(story.expires_at)}</span>
                        )}
                        {story.user_id === currentUserId && (
                          <>
                            <span>•</span>
                            <span className="text-primary">Your Story</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
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
            ))}
          </CardContent>
        </Card>

        {/* Posts Section */}
        <Card className="glass-card rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingPosts && <p className="text-sm text-muted-foreground">Loading posts…</p>}

            {!loadingPosts && posts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm">No posts yet</p>
                <p className="text-xs">Create a post to see content from friends</p>
              </div>
            )}

            {posts.map((post) => {
              const authorName = post.author?.full_name || post.author?.username || "Friend";
              const avatarUrl = post.author?.profile_photo_url || "";
              const isVideo = post.media_type?.toLowerCase().includes("video");
              const showComments = Boolean(expandedComments[post.post_id]);
              const comments = commentsByPost[post.post_id] || [];

              return (
                <Card key={post.post_id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={avatarUrl} alt={authorName} />
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{authorName}</p>
                      {post.author?.username ? (
                        <p className="text-xs text-muted-foreground truncate">@{post.author.username}</p>
                      ) : null}
                      {post.is_collaborative ? (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Collaborative
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {post.content ? <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">{post.content}</p> : null}

                  {post.media_url ? (
                    <div className="mt-3 overflow-hidden rounded-xl bg-muted">
                      {isVideo ? (
                        <video src={post.media_url} controls className="w-full max-h-[420px] object-contain" />
                      ) : (
                        <img src={post.media_url} alt="Post media" className="w-full max-h-[420px] object-cover" />
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      type="button"
                      variant={post.liked_by_me ? "hero" : "outline"}
                      size="sm"
                      onClick={() => onToggleLike(post.post_id)}
                      className="gap-2"
                    >
                      <Heart className="w-4 h-4" />
                      {post.like_count || 0}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleComments(post.post_id)}
                      className="gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {post.comment_count || 0}
                    </Button>
                  </div>

                  {showComments ? (
                    <div className="mt-4">
                      {loadingComments[post.post_id] ? (
                        <p className="text-xs text-muted-foreground">Loading comments…</p>
                      ) : (
                        <div className="space-y-3">
                          {comments.map((c) => (
                            <div key={c.comment_id} className="flex items-start gap-2">
                              <Avatar className="h-7 w-7 mt-0.5">
                                <AvatarImage src={c.author?.profile_photo_url || ""} />
                                <AvatarFallback>
                                  <User className="w-3 h-3" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  {c.author?.username ? `@${c.author.username}` : ""}
                                </p>
                                <p className="text-sm text-foreground break-words">{c.comment_text}</p>
                              </div>
                            </div>
                          ))}

                          <div className="flex items-center gap-2 pt-2">
                            <Input
                              value={commentDraftByPost[post.post_id] || ""}
                              onChange={(e) =>
                                setCommentDraftByPost((prev) => ({ ...prev, [post.post_id]: e.target.value }))
                              }
                              placeholder="Write a comment…"
                            />
                            <Button size="sm" onClick={() => onAddComment(post.post_id)}>
                              Send
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </Card>
              );})}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
<PostCreate
        open={postCreateOpen}
        onClose={() => setPostCreateOpen(false)}
        onPostCreated={loadPosts}
      />
      <StoryUpload
        open={storyUploadOpen}
        onClose={() => setStoryUploadOpen(false)}
        onStoryCreated={loadStories}
      />
      <StoryDisplay
        open={storyDisplayOpen}
        onClose={() => setStoryDisplayOpen(false)}
      />
      <BottomNav />
    </div>
  );
};

export default MediaPage;

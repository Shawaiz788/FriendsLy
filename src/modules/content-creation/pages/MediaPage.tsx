import { useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Plus, Upload, User } from "lucide-react";

import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const MediaPage = () => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<MediaPost[]>([]);

  const [newCaption, setNewCaption] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, MediaComment[]>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const storedToken = localStorage.getItem("supabaseToken") || "";
    setToken(storedToken);
  }, []);

  const canPost = useMemo(() => {
    return Boolean(newCaption.trim() || newFile);
  }, [newCaption, newFile]);

  const loadFeed = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await getMediaFeed(token);
      if (Array.isArray(result?.data)) {
        setPosts(result.data);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn’t load media", description: "Try again in a moment." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmitPost = async () => {
    if (!token) {
      toast({ title: "Not signed in", description: "Please log in again." });
      return;
    }
    if (!canPost) return;

    setSubmitting(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (newFile) {
        const uploadResult = await uploadPostMedia(newFile, token);
        if (!uploadResult?.url) {
          throw new Error(uploadResult?.error || "Upload failed");
        }
        mediaUrl = uploadResult.url;
        mediaType = uploadResult.media_type || (newFile.type.startsWith("video/") ? "video" : "image");
      }

      const createResult = await createMediaPost(
        {
          content: newCaption.trim(),
          media_url: mediaUrl,
          media_type: mediaType,
          visibility: "friends",
        },
        token,
      );

      if (!createResult?.success) {
        throw new Error(createResult?.error || "Failed to create post");
      }

      setNewCaption("");
      setNewFile(null);
      toast({ title: "Posted" });
      await loadFeed();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Couldn’t post", description: err?.message || "Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleLike = async (postId: string) => {
    if (!token) return;

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
      toast({ title: "Couldn’t update like", description: "Try again." });
      await loadFeed();
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
      toast({ title: "Couldn’t load comments", description: "Try again." });
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
      toast({ title: "Couldn’t comment", description: err?.message || "Try again." });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Media</h1>
        <p className="text-sm text-muted-foreground">Posts and reels from friends</p>

        <Card className="mt-4 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Create post</p>
          </div>

          <Textarea
            value={newCaption}
            onChange={(e) => setNewCaption(e.target.value)}
            placeholder="What’s happening?"
            className="min-h-20"
          />

          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{newFile ? newFile.name : "Upload photo/video"}</span>
              <Input
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              />
            </label>

            <div className="flex-1" />

            <Button variant="hero" disabled={!canPost || submitting} onClick={onSubmitPost}>
              {submitting ? "Posting…" : "Post"}
            </Button>
          </div>
        </Card>

        <div className="mt-6 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loading && posts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No posts yet</p>
              <p className="text-xs">Be the first to share something.</p>
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
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default MediaPage;

import { MessageCircle, Heart } from "lucide-react";
import type { MediaPost } from "@/modules/content-creation/services/mediaApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NearbyHighlightsProps {
  highlights: MediaPost[];
  onViewProfile?: (userId: string) => void;
  onLike?: (postId: string) => void;
}

const NearbyHighlights = ({
  highlights,
  onViewProfile,
  onLike,
}: NearbyHighlightsProps) => {
  if (!highlights || highlights.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4 text-sm text-muted-foreground">
        No recent highlights from nearby friends.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {highlights.map((post) => (
        <div
          key={post.post_id}
          className="glass-card rounded-2xl p-4 space-y-2 hover:bg-muted/50 transition-colors"
        >
          {/* Author info */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onViewProfile?.(post.user_id)}
              className="flex items-center gap-3 min-w-0 flex-1"
            >
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage
                  src={post.author?.profile_photo_url || undefined}
                  alt={post.author?.full_name || "User"}
                />
                <AvatarFallback>
                  {(post.author?.full_name || "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="font-semibold text-sm text-foreground">
                  {post.author?.full_name || "Someone"}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{post.author?.username || "user"}
                </p>
              </div>
            </button>
          </div>

          {/* Content */}
          {post.content && (
            <p className="text-sm text-foreground line-clamp-2">{post.content}</p>
          )}

          {/* Media preview */}
          {post.media_url && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
              {post.media_type === "image" || !post.media_type ? (
                <img
                  src={post.media_url}
                  alt="Post media"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={post.media_url}
                  className="w-full h-full object-contain"
                  controls
                />
              )}
            </div>
          )}

          {/* Engagement */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {post.like_count !== undefined && (
                <span>{post.like_count} likes</span>
              )}
              {post.comment_count !== undefined && (
                <span>{post.comment_count} comments</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onLike?.(post.post_id)}
              className={`p-1.5 rounded-full transition-colors ${
                post.liked_by_me
                  ? "text-red-500 bg-red-500/10"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              aria-label="Like post"
            >
              <Heart
                className="w-4 h-4"
                fill={post.liked_by_me ? "currentColor" : "none"}
              />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NearbyHighlights;

import { useState, useEffect } from "react";
import { Clock, Eye, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getStories, deleteStory } from "@/lib/api";
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

interface StoryDisplayProps {
  open: boolean;
  onClose: () => void;
}

export default function StoryDisplay({ open, onClose }: StoryDisplayProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const currentStory = stories[currentStoryIndex];

  useEffect(() => {
    if (open) {
      loadStories();
    } else {
      setCurrentStoryIndex(0);
      setProgress(0);
      setIsPlaying(true);
    }
  }, [open]);

  useEffect(() => {
    if (!currentStory || !isPlaying) return;

    const duration = 5000; // 5 seconds per story
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentStory, isPlaying, currentStoryIndex]);

  const loadStories = async () => {
    const token = localStorage.getItem("supabaseToken");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const result = await getStories(token);
      if (result?.data) {
        const filtered = result.data.filter((s: Story) => new Date(s.expires_at) > new Date());
        setStories(filtered);
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

  const handleNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setProgress(0);
    }
  };

  const handleDeleteStory = async () => {
    if (!currentStory) return;

    const token = localStorage.getItem("supabaseToken");
    if (!token) return;

    try {
      const result = await deleteStory(currentStory.story_id, token);
      if (result?.success) {
        toast({ title: "Story deleted" });
        setStories(stories.filter(s => s.story_id !== currentStory.story_id));
        if (currentStoryIndex >= stories.length - 1) {
          setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
        }
      } else {
        toast({
          title: "Delete failed",
          description: result?.error || "Could not delete story.",
        });
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete story.",
      });
    }
  };

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

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading stories...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!stories.length) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No stories available</p>
              <p className="text-xs text-muted-foreground mt-2">Stories from your friends will appear here</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="relative">
          {/* Progress indicators */}
          <div className="flex gap-1 p-3 absolute top-0 left-0 right-0 z-10">
            {stories.map((_, index) => (
              <div
                key={index}
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{
                    width: index === currentStoryIndex ? `${progress}%` : 
                           index < currentStoryIndex ? '100%' : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Story content */}
          <div className="relative">
            {currentStory?.media_type === "video" ? (
              <video
                src={currentStory.media_url}
                className="w-full h-96 object-cover"
                autoPlay
                muted
                loop
                onClick={() => setIsPlaying(!isPlaying)}
              />
            ) : (
              <img
                src={currentStory?.media_url}
                alt="Story"
                className="w-full h-96 object-cover"
              />
            )}

            {/* Overlay controls */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50">
              {/* Header */}
              <div className="flex items-center justify-between p-4 pt-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
                    {currentStory?.author?.profile_photo_url ? (
                      <img
                        src={currentStory.author.profile_photo_url}
                        alt={currentStory.author.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">
                        {currentStory?.author?.full_name?.[0] || 'U'}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {currentStory?.author?.full_name || currentStory?.author?.username || 'Unknown'}
                    </p>
                    {formatTimeRemaining(currentStory?.expires_at) && (
                      <p className="text-white/80 text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeRemaining(currentStory!.expires_at)}
                      </p>
                    )}
                  </div>
                </div>
                
                {currentStory?.user_id === currentUserId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={handleDeleteStory}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Navigation */}
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={handlePreviousStory}
                  disabled={currentStoryIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={handleNextStory}
                  disabled={currentStoryIndex === stories.length - 1}
                >
                  Next
                </Button>
              </div>

              {/* Play/Pause overlay for videos */}
              {currentStory?.media_type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

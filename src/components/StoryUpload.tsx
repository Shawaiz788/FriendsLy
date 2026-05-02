import { useState, useRef, ChangeEvent } from "react";
import { ImagePlus, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadStoryMedia, createStory } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface StoryUploadProps {
  open: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
}

export default function StoryUpload({ open, onClose, onStoryCreated }: StoryUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [visibility, setVisibility] = useState<string>("friends");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ 
        title: "No file selected", 
        description: "Please select a file to upload." 
      });
      return;
    }

    const token = localStorage.getItem("supabaseToken");
    if (!token) {
      toast({ 
        title: "Not authenticated", 
        description: "Please log in to upload a story." 
      });
      return;
    }

    setUploading(true);
    try {
      // Upload media first
      const uploadResult = await uploadStoryMedia(selectedFile, token);
      if (!uploadResult?.url) {
        toast({
          title: "Upload failed",
          description: uploadResult?.error || "Could not upload media.",
        });
        return;
      }

      // Create story with uploaded media
      const mediaType = selectedFile.type.startsWith("video/") ? "video" : "image";
      const createResult = await createStory(uploadResult.url, mediaType, visibility, token);
      
      if (createResult?.success) {
        toast({ 
          title: "Story created", 
          description: "Your story has been uploaded and will be available for 24 hours." 
        });
        onStoryCreated();
        handleClose();
      } else {
        toast({
          title: "Story creation failed",
          description: createResult?.error || "Could not create story.",
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setVisibility("friends");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!selectedFile ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <ImagePlus className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Select an image or video for your story
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
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
                    alt="Story preview"
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Post Story"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

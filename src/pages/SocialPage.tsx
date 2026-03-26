import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AudioLines,
  CalendarDays,
  Camera,
  Check,
  CircleUserRound,
  Clapperboard,
  FileAudio,
  Film,
  Flame,
  Heart,
  Image,
  Lock,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Plus,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

const storyItems = [
  { id: "you", name: "Your Story", fresh: true },
  { id: "1", name: "Sara", fresh: true },
  { id: "2", name: "Omar", fresh: true },
  { id: "3", name: "Mina", fresh: false },
  { id: "4", name: "Ali", fresh: false },
];

const feedItems = [
  {
    id: "p1",
    author: "Sara Ahmed",
    type: "photo",
    text: "Golden hour walk after class 🌤️",
    privacy: "Friends-only",
    collaboration: "Solo post",
    time: "15m",
  },
  {
    id: "p2",
    author: "Mina + 2 collaborators",
    type: "micro-blog",
    text: "Study sprint at the library. Open to one more focused person.",
    privacy: "Close friends",
    collaboration: "Collaborative post",
    time: "1h",
  },
];

const reelItems = [
  {
    id: "r1",
    creator: "Omar",
    title: "60-sec coffee break near campus",
    audio: "lofi morning",
    likes: 84,
    comments: 12,
  },
  {
    id: "r2",
    creator: "Nour",
    title: "Night walk vibe check",
    audio: "city ambience",
    likes: 112,
    comments: 18,
  },
];

const capsuleChecklist = [
  "Hangout intent",
  "Date + time",
  "Approx location",
  "Attendees",
  "Shared media from temporary group",
  "Reflections",
];

const SocialPage = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Social Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Missing UI modules from your SRS are now laid out for implementation.
          </p>
        </div>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="capsules">Capsules</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Card className="glass-card rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Stories + Feed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {storyItems.map((story) => (
                    <div key={story.id} className="min-w-[72px] text-center">
                      <div
                        className={`mx-auto mb-1 h-14 w-14 rounded-full border-2 flex items-center justify-center ${
                          story.fresh ? "border-primary text-primary" : "border-border text-muted-foreground"
                        }`}
                      >
                        <CircleUserRound className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-foreground truncate">{story.name}</p>
                    </div>
                  ))}
                </div>

                <div className="glass-card rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Create Post</p>
                    <Badge variant="outline">FR21 • FR22 • FR23 • FR25</Badge>
                  </div>
                  <Textarea placeholder="Share a quick update..." className="bg-background/80" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="soft" size="sm">
                      <Image className="w-4 h-4" /> Add Photo
                    </Button>
                    <Button variant="soft" size="sm">
                      <Video className="w-4 h-4" /> Add Video
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select defaultValue="friends">
                      <SelectTrigger>
                        <SelectValue placeholder="Privacy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friends">Friends-only</SelectItem>
                        <SelectItem value="close-friends">Close friends</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                      <Users className="w-4 h-4" /> Add Collaborators
                    </Button>
                  </div>
                  <Button variant="hero" className="w-full">
                    <Plus className="w-4 h-4" /> Publish Post
                  </Button>
                </div>

                <div className="space-y-3">
                  {feedItems.map((post) => (
                    <div key={post.id} className="glass-card rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{post.author}</p>
                          <p className="text-xs text-muted-foreground">{post.time} ago</p>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground">{post.text}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{post.type}</Badge>
                        <Badge variant="outline">{post.privacy}</Badge>
                        <Badge variant="outline">{post.collaboration}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="flex-1">
                          <Heart className="w-4 h-4" /> Like
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1">
                          <MessageCircle className="w-4 h-4" /> Comment
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Reels + Explore</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reelItems.map((reel) => (
                  <div key={reel.id} className="glass-card rounded-xl p-4 space-y-3">
                    <div className="aspect-[9/14] rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Clapperboard className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Reel Preview Area</p>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{reel.creator}</p>
                        <p className="text-sm text-foreground">{reel.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">Audio: {reel.audio}</p>
                      </div>
                      <Button variant="soft" size="icon">
                        <Film className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Button variant="ghost" size="sm">
                        <Heart className="w-4 h-4" /> {reel.likes}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MessageCircle className="w-4 h-4" /> {reel.comments}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Sparkles className="w-4 h-4" /> Remix
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Plus className="w-4 h-4" /> Save
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <div className="glass-card rounded-xl p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Nearby Highlights</p>
                    <p className="text-sm font-medium mt-1">Sunset walk circles</p>
                  </div>
                  <div className="glass-card rounded-xl p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Trending Local</p>
                    <p className="text-sm font-medium mt-1">Study cafes tonight</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <Card className="glass-card rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Chat + Group Hangouts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="glass-card rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium">End-to-End Encryption</p>
                    </div>
                    <Badge>FR28</Badge>
                  </div>
                  <Textarea placeholder="Type a secure message..." className="bg-background/80" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="soft" size="sm">
                      <Mic className="w-4 h-4" /> Voice Note
                    </Button>
                    <Button variant="soft" size="sm">
                      <FileAudio className="w-4 h-4" /> Attach Audio
                    </Button>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Temporary Group Chat (on Hangout Confirm)</p>
                    <Badge variant="outline">FR29 • FR31 • FR32</Badge>
                  </div>
                  <Input placeholder="Group title (optional)" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm">
                      <Users className="w-4 h-4" /> Add Members
                    </Button>
                    <Button variant="outline" size="sm">
                      <CalendarDays className="w-4 h-4" /> Event Time
                    </Button>
                  </div>
                  <div className="glass-card rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Hangout Poll</p>
                    <Input placeholder="Poll question" />
                    <Input placeholder="Option A" />
                    <Input placeholder="Option B" />
                    <Button variant="soft" size="sm" className="w-full">
                      Create Poll
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Auto-delete when event ends</span>
                    <Switch defaultChecked />
                  </div>
                  <Button variant="hero" className="w-full">
                    Convert to Permanent Group
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capsules" className="space-y-4">
            <Card className="glass-card rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Hangout Capsules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="glass-card rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium">Create Capsule from Confirmed Meetup</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Hangout type (Coffee/Walk/Study)" />
                    <Input placeholder="Date + time" />
                  </div>
                  <Input placeholder="Approx location" />
                  <Input placeholder="Attendees (comma separated)" />
                  <Textarea placeholder="Short reflection..." />
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="soft" size="sm">
                      <Camera className="w-4 h-4" /> Photo
                    </Button>
                    <Button variant="soft" size="sm">
                      <Video className="w-4 h-4" /> Video
                    </Button>
                    <Button variant="soft" size="sm">
                      <AudioLines className="w-4 h-4" /> Audio
                    </Button>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Auto-structured summary checklist</p>
                  <div className="space-y-2">
                    {capsuleChecklist.map((item) => (
                      <label key={item} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox checked />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Media from temporary group chat is marked for auto-save into capsule.
                  </p>
                </div>

                <Button variant="hero" className="w-full">
                  <Check className="w-4 h-4" /> Save Capsule
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Flame className="w-4 h-4" />
            <p className="text-sm font-medium">Intent + Proximity quick actions</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="hero" size="sm">
              <MapPin className="w-4 h-4" /> One-tap Hangout
            </Button>
            <Button variant="soft" size="sm">
              <Sparkles className="w-4 h-4" /> Aura Suggestion
            </Button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default SocialPage;
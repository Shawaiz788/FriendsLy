import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { ArrowDown, ImagePlus, MapPin, Mic, MicOff, PlusCircle, Trash2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addCapsuleMedia,
  deleteCapsuleMedia,
  getCapsuleDetails,
  getGroupMessages,
  getMyHangouts,
  sendGroupMessage,
  uploadGroupChatMedia,
  uploadPostMedia,
  voteInPoll,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type HangoutParticipant = {
  user_id: string;
  status: "invited" | "accepted" | "declined";
  profile: {
    user_id: string;
    full_name: string;
    username: string;
    profile_photo_url?: string;
  } | null;
};

type HangoutCard = {
  hangout_id: string;
  title: string;
  description: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  my_status: "invited" | "accepted" | "declined";
  created_at: string;
  group_chat: {
    group_id: string;
    is_temporary: boolean;
    auto_delete_at?: string;
  } | null;
  capsule: {
    capsule_id: string;
    summary?: string;
    created_at?: string;
  } | null;
  participants: HangoutParticipant[];
};

type PollOptionPayload = {
  option_id: string;
  option_text: string;
  votes?: number;
};

type GroupMessage = {
  message_id: string;
  sender_id: string;
  message_type: "text" | "voice" | "poll";
  text?: string;
  created_at: string;
  payload?:
    | {
        kind: "text";
        text?: string;
      }
    | {
        kind: "image";
        url?: string;
      }
    | {
        kind: "video";
        url?: string;
      }
    | {
        kind: "voice";
        url?: string;
        duration_ms?: number;
      }
    | {
        kind: "location";
        latitude?: number;
        longitude?: number;
      }
    | {
        kind: "poll";
        poll_id?: string;
        question?: string;
        options?: PollOptionPayload[];
        user_vote_option_id?: string | null;
      };
  sender_profile: {
    full_name?: string;
    username?: string;
  } | null;
};

type CapsuleMedia = {
  media_id: string;
  media_url: string;
  media_type: "image" | "video" | "audio";
  created_at: string;
  uploader: {
    full_name?: string;
    username?: string;
  } | null;
};

type CapsuleDetails = {
  capsule_id: string;
  summary: string;
  media?: CapsuleMedia[];
};

const SocialPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "content";
  const initialHangoutId = searchParams.get("hangout") || "";

  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [hangouts, setHangouts] = useState<HangoutCard[]>([]);
  const [selectedHangoutId, setSelectedHangoutId] = useState(initialHangoutId);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingCapsule, setLoadingCapsule] = useState(false);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [capsuleDetails, setCapsuleDetails] = useState<CapsuleDetails | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [selectedMediaPreviewUrl, setSelectedMediaPreviewUrl] = useState<string | null>(null);
  const [capsuleMediaFile, setCapsuleMediaFile] = useState<File | null>(null);
  const [capsuleMediaPreviewUrl, setCapsuleMediaPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [sendingPoll, setSendingPoll] = useState(false);
  const [uploadingCapsuleMedia, setUploadingCapsuleMedia] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [activeCapsuleMedia, setActiveCapsuleMedia] = useState<CapsuleMedia | null>(null);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const capsuleMediaInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const currentUserId = useMemo(() => {
    if (!token) return "";

    try {
      const payloadPart = token.split(".")[1];
      if (!payloadPart) return "";
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const parsed = JSON.parse(atob(normalized));
      return parsed?.sub || "";
    } catch {
      return "";
    }
  }, [token]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const formatTime = (isoTime: string) => {
    try {
      return new Date(isoTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const loadGroupMessages = async (groupId: string, authToken: string, setLoadingState = true) => {
    if (setLoadingState) setLoadingMessages(true);
    try {
      const result = await getGroupMessages(groupId, authToken);
      setMessages(Array.isArray(result?.data) ? result.data : []);
    } finally {
      if (setLoadingState) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken") || "";
    setToken(t);
  }, []);

  const selectedHangout = useMemo(
    () => hangouts.find((hangout) => hangout.hangout_id === selectedHangoutId) || null,
    [hangouts, selectedHangoutId],
  );

  const acceptedCount = (hangout: HangoutCard | null) =>
    hangout ? hangout.participants.filter((participant) => participant.status === "accepted").length : 0;

  const refreshHangouts = async (authToken: string) => {
    setLoading(true);
    try {
      const result = await getMyHangouts(authToken);
      const data: HangoutCard[] = Array.isArray(result?.data) ? result.data : [];
      setHangouts(data);

      if (!data.length) {
        setSelectedHangoutId("");
        return;
      }

      const currentId = selectedHangoutId || initialHangoutId;
      const exists = data.some((hangout) => hangout.hangout_id === currentId);
      if (!exists) {
        setSelectedHangoutId(data[0].hangout_id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    void refreshHangouts(token);
  }, [token]);

  useEffect(() => {
    const query: Record<string, string> = {};
    if (activeTab) query.tab = activeTab;
    if (selectedHangoutId) query.hangout = selectedHangoutId;
    setSearchParams(query, { replace: true });
  }, [activeTab, selectedHangoutId, setSearchParams]);

  useEffect(() => {
    if (!token || !selectedHangout?.group_chat?.group_id || activeTab !== "chat") {
      setMessages([]);
      setHasUnseenMessages(false);
      return;
    }

    const groupId = selectedHangout.group_chat.group_id;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    void loadGroupMessages(groupId, token);

    let pollIntervalId: number | null = null;
    let realtimeClient: ReturnType<typeof createClient> | null = null;

    pollIntervalId = window.setInterval(() => {
      void loadGroupMessages(groupId, token, false);
    }, 2000);

    if (supabaseUrl && supabaseAnonKey) {
      realtimeClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      const channel = realtimeClient
        .channel(`group-messages:${groupId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `group_id=eq.${groupId}`,
          },
          () => {
            void loadGroupMessages(groupId, token, false);
          },
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    }

    return () => {
      if (pollIntervalId) {
        window.clearInterval(pollIntervalId);
      }

      if (realtimeClient && realtimeChannelRef.current) {
        void realtimeClient.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [activeTab, selectedHangout?.group_chat?.group_id, token]);

  useEffect(() => {
    if (activeTab !== "chat") return;

    if (shouldAutoScrollRef.current) {
      scrollToBottom(messages.length <= 1 ? "auto" : "smooth");
      setHasUnseenMessages(false);
    } else if (messages.length) {
      setHasUnseenMessages(true);
    }
  }, [activeTab, messages]);

  const handleChatScroll = () => {
    const container = chatScrollRef.current;
    if (!container) return;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceToBottom < 80;
    shouldAutoScrollRef.current = nearBottom;
    if (nearBottom) {
      setHasUnseenMessages(false);
    }
  };

  useEffect(() => {
    if (!token || !selectedHangout?.capsule?.capsule_id || activeTab !== "capsules") {
      setCapsuleDetails(null);
      return;
    }

    const loadCapsule = async () => {
      setLoadingCapsule(true);
      try {
        const result = await getCapsuleDetails(selectedHangout.capsule!.capsule_id, token);
        setCapsuleDetails(result?.data || null);
      } finally {
        setLoadingCapsule(false);
      }
    };

    void loadCapsule();
  }, [activeTab, selectedHangout?.capsule?.capsule_id, token]);

  const handleSendMessage = async () => {
    if (!token || !selectedHangout?.group_chat?.group_id) return;

    if (selectedMediaFile) {
      await handleSendMedia();
      return;
    }

    if (!messageDraft.trim()) return;

    setSendingMessage(true);
    try {
      const result = await sendGroupMessage(
        selectedHangout.group_chat.group_id,
        {
          messageType: "text",
          payload: {
            kind: "text",
            text: messageDraft.trim(),
          },
        },
        token,
      );
      if (result?.success) {
        setMessageDraft("");
        shouldAutoScrollRef.current = true;
        void loadGroupMessages(selectedHangout.group_chat.group_id, token, false);
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const handleChooseMedia = () => {
    mediaInputRef.current?.click();
  };

  const handleAddPollOption = () => {
    setPollOptions((prevOptions) => [...prevOptions, ""]);
  };

  const handleRemovePollOption = (index: number) => {
    setPollOptions((prevOptions) => prevOptions.filter((_, optionIndex) => optionIndex !== index));
  };

  const resetPollComposer = () => {
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollComposerOpen(false);
  };

  const handleSendPoll = async () => {
    if (!token || !selectedHangout?.group_chat?.group_id) return;
    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);

    if (!question) {
      toast({ title: "Poll required", description: "Please enter a poll question." });
      return;
    }
    if (options.length < 2) {
      toast({ title: "At least two options", description: "Add at least two poll options." });
      return;
    }
    if (options.length > 8) {
      toast({ title: "Too many options", description: "Poll supports up to 8 options." });
      return;
    }

    setSendingPoll(true);
    try {
      const result = await sendGroupMessage(
        selectedHangout.group_chat.group_id,
        {
          messageType: "poll",
          payload: {
            kind: "poll",
            question,
            options,
          },
        },
        token,
      );

      if (result?.success) {
        resetPollComposer();
        shouldAutoScrollRef.current = true;
        void loadGroupMessages(selectedHangout.group_chat.group_id, token, false);
      } else {
        toast({ title: "Poll failed", description: result?.error || "Could not create poll." });
      }
    } finally {
      setSendingPoll(false);
    }
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    if (!token || !selectedHangout?.group_chat?.group_id) return;
    if (!pollId) {
      toast({ title: "Vote failed", description: "Poll identifier is missing. Refresh the chat and try again." });
      return;
    }

    try {
      const result = await voteInPoll(selectedHangout.group_chat.group_id, pollId, optionId, token);
      if (result?.success) {
        void loadGroupMessages(selectedHangout.group_chat.group_id, token, false);
      } else {
        toast({ title: "Vote failed", description: result?.error || "Could not submit vote." });
      }
    } catch {
      toast({ title: "Vote failed", description: "Unable to submit poll vote." });
    }
  };

  const handleMediaSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select an image or video file." });
      return;
    }

    setSelectedMediaFile(file);
    if (selectedMediaPreviewUrl) {
      URL.revokeObjectURL(selectedMediaPreviewUrl);
    }
    setSelectedMediaPreviewUrl(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleSendMedia = async () => {
    if (!token || !selectedHangout?.group_chat?.group_id || !selectedMediaFile) return;

    setSendingMessage(true);
    try {
      const uploadResult = await uploadGroupChatMedia(selectedHangout.group_chat.group_id, selectedMediaFile, token);
      if (!uploadResult?.success || !uploadResult?.url) {
        toast({
          title: "Upload failed",
          description: uploadResult?.error || "Could not upload media.",
        });
        return;
      }

      const mediaKind = selectedMediaFile.type.startsWith("video/") ? "video" : "image";

      const result = await sendGroupMessage(
        selectedHangout.group_chat.group_id,
        {
          messageType: "text",
          payload: {
            kind: mediaKind,
            url: uploadResult.url,
          },
        },
        token,
      );

      if (result?.success) {
        setSelectedMediaFile(null);
        if (selectedMediaPreviewUrl) {
          URL.revokeObjectURL(selectedMediaPreviewUrl);
        }
        setSelectedMediaPreviewUrl(null);
        shouldAutoScrollRef.current = true;
        void loadGroupMessages(selectedHangout.group_chat.group_id, token, false);
      } else {
        toast({
          title: "Message failed",
          description: result?.error || "Could not send media message.",
        });
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const stopRecorderStream = () => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (selectedMediaPreviewUrl) {
        URL.revokeObjectURL(selectedMediaPreviewUrl);
      }
      if (capsuleMediaPreviewUrl) {
        URL.revokeObjectURL(capsuleMediaPreviewUrl);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopRecorderStream();
    };
  }, [capsuleMediaPreviewUrl, selectedMediaPreviewUrl]);

  const handleToggleVoiceRecording = async () => {
    if (!token || !selectedHangout?.group_chat?.group_id) return;

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({ title: "Unsupported", description: "Voice recording is not supported in this browser." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : undefined;
        stopRecorderStream();
        recordingStartedAtRef.current = null;

        if (!recordedChunksRef.current.length) return;

        const audioBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const audioDataUrl = typeof reader.result === "string" ? reader.result : "";
          if (!audioDataUrl) return;

          setSendingMessage(true);
          try {
            const result = await sendGroupMessage(
              selectedHangout.group_chat.group_id,
              {
                messageType: "voice",
                payload: {
                  kind: "voice",
                  url: audioDataUrl,
                  duration_ms: durationMs,
                },
              },
              token,
            );

            if (result?.success) {
              shouldAutoScrollRef.current = true;
              void loadGroupMessages(selectedHangout.group_chat.group_id, token, false);
            }
          } finally {
            setSendingMessage(false);
          }
        };

        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      stopRecorderStream();
      toast({ title: "Microphone blocked", description: "Allow microphone permission to send voice messages." });
      setIsRecording(false);
      recordingStartedAtRef.current = null;
    }
  };

  const handleSendLiveLocation = async () => {
    if (!token || !selectedHangout?.group_chat?.group_id) return;
    if (!navigator.geolocation) {
      toast({ title: "Unsupported", description: "Location sharing is not supported by this browser." });
      return;
    }

    setSendingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
          const result = await sendGroupMessage(
            selectedHangout.group_chat.group_id,
            {
              messageType: "text",
              payload: {
                kind: "location",
                latitude,
                longitude,
              },
            },
            token,
          );

          if (result?.success) {
            shouldAutoScrollRef.current = true;
            void loadGroupMessages(selectedHangout.group_chat.group_id, token, false);
          }
        } finally {
          setSendingLocation(false);
        }
      },
      () => {
        setSendingLocation(false);
        toast({ title: "Location blocked", description: "Allow location permission to send live location." });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  };

  const handleChooseCapsuleMedia = () => {
    capsuleMediaInputRef.current?.click();
  };

  const handleCapsuleMediaSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select an image or video file." });
      return;
    }

    setCapsuleMediaFile(file);
    if (capsuleMediaPreviewUrl) {
      URL.revokeObjectURL(capsuleMediaPreviewUrl);
    }
    setCapsuleMediaPreviewUrl(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleAddCapsuleMedia = async () => {
    if (!token || !selectedHangout?.capsule?.capsule_id || !capsuleMediaFile) return;

    setUploadingCapsuleMedia(true);
    try {
      const uploadResult = await uploadPostMedia(capsuleMediaFile, token);
      if (!uploadResult?.url) {
        toast({
          title: "Upload failed",
          description: uploadResult?.error || "Could not upload media.",
        });
        return;
      }

      const mediaType =
        uploadResult.media_type === "video" || capsuleMediaFile.type.startsWith("video/")
          ? "video"
          : "image";
      const addResult = await addCapsuleMedia(
        selectedHangout.capsule.capsule_id,
        { mediaUrl: uploadResult.url, mediaType },
        token,
      );

      if (!addResult?.success) {
        toast({
          title: "Capsule update failed",
          description: addResult?.error || "Could not add media to capsule.",
        });
        return;
      }

      const expectedMediaCount = (capsuleDetails?.media?.length ?? 0) + 1;
      if (addResult?.data) {
        setCapsuleDetails((prev) => {
          if (!prev) return prev;
          const nextMedia = [addResult.data, ...(prev.media || [])];
          return { ...prev, media: nextMedia };
        });
      }

      setCapsuleMediaFile(null);
      if (capsuleMediaPreviewUrl) {
        URL.revokeObjectURL(capsuleMediaPreviewUrl);
      }
      setCapsuleMediaPreviewUrl(null);

      const next = await getCapsuleDetails(selectedHangout.capsule.capsule_id, token);
      if (next?.data?.media && next.data.media.length >= expectedMediaCount) {
        setCapsuleDetails(next.data);
      }
    } finally {
      setUploadingCapsuleMedia(false);
    }
  };

  const handleDeleteCapsuleMedia = async (mediaId: string) => {
    if (!token || !selectedHangout?.capsule?.capsule_id) return;

    const confirmed = window.confirm("Delete this media from the capsule?");
    if (!confirmed) return;

    const result = await deleteCapsuleMedia(selectedHangout.capsule.capsule_id, mediaId, token);
    if (!result?.success) {
      toast({ title: "Delete failed", description: result?.error || "Could not delete media." });
      return;
    }

    setCapsuleDetails((prev) => {
      if (!prev) return prev;
      return { ...prev, media: (prev.media || []).filter((item) => item.media_id !== mediaId) };
    });
  };

  const handleDownloadCapsuleMedia = async (item: CapsuleMedia) => {
    try {
      const response = await fetch(item.media_url, { mode: "cors" });
      if (!response.ok) throw new Error("Failed to download media");

      const blob = await response.blob();
      const extension = item.media_type === "video" ? "mp4" : "jpg";
      const fileName = `capsule-${item.media_id}.${extension}`;
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Could not download media.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Social Hub</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real hangouts, temporary chat, and capsules are now connected.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => token && void refreshHangouts(token)}>
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="content">Hangouts</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="capsules">Capsules</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Card className="glass-card rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Active Hangouts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading && <div className="text-sm text-muted-foreground">Loading hangouts...</div>}

                {!loading && !hangouts.length && (
                  <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
                    No active hangouts yet. Start one from overlap suggestions on Home.
                  </div>
                )}

                {!loading &&
                  hangouts.map((hangout) => {
                    const accepted = acceptedCount(hangout);
                    const isSelected = selectedHangoutId === hangout.hangout_id;

                    return (
                      <div
                        key={hangout.hangout_id}
                        className={`glass-card rounded-xl p-4 space-y-3 ${isSelected ? "ring-1 ring-primary/40" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{hangout.title || "Hangout"}</p>
                            <p className="text-xs text-muted-foreground">{hangout.description || "No description"}</p>
                          </div>
                          <Badge variant={hangout.status === "confirmed" ? "default" : "outline"}>
                            {hangout.status}
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Accepted: {accepted} • Participants: {hangout.participants.length}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {hangout.participants.map((participant) => (
                            <span key={`${hangout.hangout_id}-${participant.user_id}`} className="text-xs rounded-full bg-muted px-2 py-1">
                              {participant.profile?.full_name || participant.user_id.slice(0, 6)} ({participant.status})
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="hero"
                            className="flex-1"
                            onClick={() => {
                              setSelectedHangoutId(hangout.hangout_id);
                              setActiveTab("chat");
                            }}
                            disabled={!hangout.group_chat?.group_id || hangout.my_status !== "accepted"}
                          >
                            Open Chat
                          </Button>
                          <Button
                            size="sm"
                            variant="soft"
                            className="flex-1"
                            onClick={() => {
                              setSelectedHangoutId(hangout.hangout_id);
                              setActiveTab("capsules");
                            }}
                            disabled={!hangout.capsule?.capsule_id || hangout.my_status !== "accepted"}
                          >
                            Open Capsule
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedHangoutId(hangout.hangout_id)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <Card className="glass-card rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Temporary Group Chat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedHangout && <p className="text-sm text-muted-foreground">Select a hangout first.</p>}

                {selectedHangout && !selectedHangout.group_chat?.group_id && (
                  <p className="text-sm text-muted-foreground">No temporary chat available for this hangout yet.</p>
                )}

                {selectedHangout?.group_chat?.group_id && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">Group: {selectedHangout.group_chat.group_id.slice(0, 8)} • Temporary</div>

                    <div className="relative">
                      <div
                        ref={chatScrollRef}
                        onScroll={handleChatScroll}
                        className="h-[440px] overflow-y-auto rounded-xl bg-muted/20 p-3"
                      >
                        {loadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}

                        {!loadingMessages && !messages.length && (
                          <p className="text-sm text-muted-foreground">No messages yet. Send the first message.</p>
                        )}

                        {!loadingMessages &&
                          messages.map((message) => {
                            const isMine = currentUserId && message.sender_id === currentUserId;
                            const payload = message.payload || { kind: "text", text: message.text || "" };

                            return (
                              <div key={message.message_id} className={`mb-2 flex ${isMine ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-card border border-border/60"}`}>
                                  {!isMine && (
                                    <p className="text-[11px] opacity-70 mb-1">
                                      {message.sender_profile?.full_name || message.sender_id.slice(0, 6)}
                                    </p>
                                  )}

                                  {payload.kind === "image" && payload.url ? (
                                    <img
                                      src={payload.url}
                                      alt="Chat image"
                                      className="max-h-56 w-auto rounded-lg object-cover"
                                    />
                                  ) : null}

                                  {payload.kind === "video" && payload.url ? (
                                    <video controls src={payload.url} className="max-h-56 w-full rounded-lg" />
                                  ) : null}

                                  {payload.kind === "voice" && payload.url ? (
                                    <audio controls src={payload.url} className="max-w-full" />
                                  ) : null}

                                  {payload.kind === "location" && typeof payload.latitude === "number" && typeof payload.longitude === "number" ? (
                                    <a
                                      href={`https://maps.google.com/?q=${payload.latitude},${payload.longitude}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline"
                                    >
                                      Live location: {payload.latitude.toFixed(5)}, {payload.longitude.toFixed(5)}
                                    </a>
                                  ) : null}

                                  {payload.kind === "poll" ? (
                                    <div className="space-y-3">
                                      <p className="text-sm font-semibold">{payload.question || "Poll"}</p>
                                      <div className="space-y-2">
                                        {(payload.options || []).map((option) => {
                                          const hasVoted = Boolean(payload.user_vote_option_id);
                                          const isSelected = payload.user_vote_option_id === option.option_id;
                                          const canChangeVote = hasVoted && !isSelected;
                                          const pollId = payload.poll_id;
                                          return (
                                            <div
                                              key={option.option_id}
                                              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                                                isSelected ? "border-primary bg-primary/10" : "border-border/60 bg-background"
                                              }`}
                                            >
                                              <div>
                                                <p className="text-sm text-black">{option.option_text}</p>
                                                <p className="text-xs text-muted-foreground">{option.votes ?? 0} votes</p>
                                              </div>
                                              {!hasVoted || canChangeVote ? (
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="outline"
                                                  disabled={!pollId || isSelected}
                                                  onClick={() => void handleVotePoll(pollId ?? "", option.option_id)}
                                                >
                                                  {hasVoted ? "Change" : "Vote"}
                                                </Button>
                                              ) : (
                                                <span className="text-xs text-foreground font-semibold">Voted</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}

                                  {payload.kind === "text" ? (
                                    <p className="text-sm whitespace-pre-wrap break-words">{payload.text || ""}</p>
                                  ) : null}

                                  <p className="text-[10px] opacity-70 mt-1 text-right">{formatTime(message.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {hasUnseenMessages && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="absolute bottom-3 left-1/2 -translate-x-1/2"
                          onClick={() => {
                            shouldAutoScrollRef.current = true;
                            setHasUnseenMessages(false);
                            scrollToBottom("smooth");
                          }}
                        >
                          <ArrowDown className="w-4 h-4 mr-1" /> New messages
                        </Button>
                      )}
                    </div>

                    {selectedMediaPreviewUrl && (
                      <div className="rounded-xl border border-border/50 p-3 space-y-2">
                        {selectedMediaFile?.type.startsWith("video/") ? (
                          <video controls src={selectedMediaPreviewUrl} className="max-h-40 w-full rounded-lg" />
                        ) : (
                          <img src={selectedMediaPreviewUrl} alt="Selected" className="max-h-40 rounded-lg" />
                        )}
                        <p className="text-xs text-muted-foreground">Media ready. Press Send to post it.</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedMediaFile(null);
                              if (selectedMediaPreviewUrl) {
                                URL.revokeObjectURL(selectedMediaPreviewUrl);
                              }
                              setSelectedMediaPreviewUrl(null);
                            }}
                            disabled={sendingMessage}
                          >
                            Remove Media
                          </Button>
                        </div>
                      </div>
                    )}

                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleMediaSelected}
                    />

                    <div className="rounded-xl border border-border/60 bg-background p-2">
                      <div className="flex gap-2 mb-2">
                        <Button type="button" size="icon" variant="soft" onClick={handleChooseMedia} title="Send media">
                          <ImagePlus className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant={pollComposerOpen ? "secondary" : "soft"}
                          onClick={() => setPollComposerOpen((prev) => !prev)}
                          title="Create poll"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant={isRecording ? "secondary" : "soft"}
                          onClick={() => void handleToggleVoiceRecording()}
                          title={isRecording ? "Stop recording" : "Record voice"}
                        >
                          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="soft"
                          onClick={() => void handleSendLiveLocation()}
                          disabled={sendingLocation}
                          title="Send live location"
                        >
                          <MapPin className="w-4 h-4" />
                        </Button>
                        {isRecording && <span className="text-xs text-muted-foreground self-center">Recording voice...</span>}
                      </div>

                      {pollComposerOpen && (
                        <div className="rounded-2xl border border-border/60 bg-muted/5 p-3 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">Create Poll</p>
                            <Button type="button" size="icon" variant="ghost" onClick={() => setPollComposerOpen(false)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Poll question"
                            value={pollQuestion}
                            onChange={(event) => setPollQuestion(event.target.value)}
                          />
                          <div className="space-y-2">
                            {pollOptions.map((option, index) => (
                              <div key={`poll-option-${index}`} className="flex items-center gap-2">
                                <Input
                                  placeholder={`Option ${index + 1}`}
                                  value={option}
                                  onChange={(event) => {
                                    const nextOptions = [...pollOptions];
                                    nextOptions[index] = event.target.value;
                                    setPollOptions(nextOptions);
                                  }}
                                />
                                {pollOptions.length > 2 && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={() => handleRemovePollOption(index)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={handleAddPollOption}>
                              Add option
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void handleSendPoll()}
                              disabled={sendingPoll || !pollQuestion.trim() || pollOptions.filter(Boolean).length < 2}
                            >
                              {sendingPoll ? "Sending poll..." : "Send poll"}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          placeholder="Type a message..."
                          value={messageDraft}
                          onChange={(event) => setMessageDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleSendMessage();
                            }
                          }}
                        />
                        <Button
                          onClick={() => void handleSendMessage()}
                          disabled={sendingMessage || (!messageDraft.trim() && !selectedMediaFile)}
                        >
                          {sendingMessage ? "Sending..." : "Send"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capsules" className="space-y-4">
            <Card className="glass-card rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Hangout Capsule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedHangout && <p className="text-sm text-muted-foreground">Select a hangout first.</p>}

                {selectedHangout && !selectedHangout.capsule?.capsule_id && (
                  <p className="text-sm text-muted-foreground">No capsule available for this hangout yet.</p>
                )}

                {selectedHangout?.capsule?.capsule_id && (
                  <>
                    {loadingCapsule && <p className="text-sm text-muted-foreground">Loading capsule...</p>}

                    {!loadingCapsule && capsuleDetails && (
                      <>
                        <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                          {capsuleDetails.summary || "No summary yet."}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Capsule Media</p>
                          {capsuleDetails.media?.length ? (
                            (() => {
                              const allMedia = capsuleDetails.media || [];
                              const previewCount = 4;
                              const previewMedia = allMedia.slice(0, previewCount);
                              const extraCount = allMedia.length - previewCount;

                              return (
                                <div className="grid grid-cols-2 gap-3">
                                  {previewMedia.map((item, index) => {
                                    const showOverlay = index === previewCount - 1 && extraCount > 0;

                                    return (
                                      <button
                                        type="button"
                                        key={item.media_id}
                                        className="relative rounded-lg overflow-hidden border border-border/40 text-left"
                                        onClick={() => setMediaDialogOpen(true)}
                                      >
                                        {item.media_type === "video" ? (
                                          <video controls={false} muted src={item.media_url} className="w-full h-36 object-cover" />
                                        ) : (
                                          <img src={item.media_url} alt="Capsule media" className="w-full h-36 object-cover" />
                                        )}

                                        {showOverlay && (
                                          <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white">
                                            <span className="text-2xl font-semibold">+{extraCount}</span>
                                            <span className="text-xs uppercase tracking-wider">View all</span>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          ) : (
                            <p className="text-sm text-muted-foreground">No media added yet.</p>
                          )}
                        </div>
                      </>
                    )}

                    {selectedHangout?.capsule?.capsule_id && (
                      <div className="rounded-xl border border-border/50 p-3 space-y-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Add Media</p>
                        {capsuleMediaPreviewUrl && (
                          <div className="space-y-2">
                            {capsuleMediaFile?.type.startsWith("video/") ? (
                              <video controls src={capsuleMediaPreviewUrl} className="max-h-44 w-full rounded-lg" />
                            ) : (
                              <img src={capsuleMediaPreviewUrl} alt="Selected" className="max-h-44 rounded-lg" />
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <input
                            ref={capsuleMediaInputRef}
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleCapsuleMediaSelected}
                          />
                          <Button type="button" variant="outline" onClick={handleChooseCapsuleMedia}>
                            Choose Media
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void handleAddCapsuleMedia()}
                            disabled={uploadingCapsuleMedia || !capsuleMediaFile}
                          >
                            {uploadingCapsuleMedia ? "Uploading..." : "Add to Capsule"}
                          </Button>
                        </div>
                      </div>
                    )}

                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Capsule Media</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-3">
            {capsuleDetails?.media?.length ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {capsuleDetails.media.map((item) => (
                  <button
                    type="button"
                    key={item.media_id}
                    className="relative rounded-xl overflow-hidden border border-border/50 text-left"
                    onClick={() => {
                      setActiveCapsuleMedia(item);
                      setMediaViewerOpen(true);
                    }}
                  >
                    {item.media_type === "video" ? (
                      <video controls src={item.media_url} className="w-full h-48 object-cover" />
                    ) : (
                      <img src={item.media_url} alt="Capsule media" className="w-full h-48 object-cover" />
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteCapsuleMedia(item.media_id);
                      }}
                      title="Delete media"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No media added yet.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mediaViewerOpen}
        onOpenChange={(open) => {
          setMediaViewerOpen(open);
          if (!open) setActiveCapsuleMedia(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Media Viewer</DialogTitle>
          </DialogHeader>
          {activeCapsuleMedia ? (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                {activeCapsuleMedia.media_type === "video" ? (
                  <video controls src={activeCapsuleMedia.media_url} className="w-full max-h-[65vh] object-contain" />
                ) : (
                  <img src={activeCapsuleMedia.media_url} alt="Capsule media" className="w-full max-h-[65vh] object-contain" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleDownloadCapsuleMedia(activeCapsuleMedia)}
                >
                  Download
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDeleteCapsuleMedia(activeCapsuleMedia.media_id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select media to preview.</p>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SocialPage;

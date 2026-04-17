import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { ArrowDown, ImagePlus, MapPin, Mic, MicOff } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  addCapsuleReflection,
  getCapsuleDetails,
  getGroupMessages,
  getMyHangouts,
  sendGroupMessage,
  uploadGroupChatMedia,
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

type GroupMessage = {
  message_id: string;
  sender_id: string;
  message_type: "text" | "voice" | "poll";
  text?: string;
  created_at: string;
  payload?: {
    kind: "text" | "image" | "voice" | "location";
    text?: string;
    url?: string;
    latitude?: number;
    longitude?: number;
    duration_ms?: number;
  };
  sender_profile: {
    full_name?: string;
    username?: string;
  } | null;
};

type CapsuleReflection = {
  reflection_id: string;
  reflection_text: string;
  created_at: string;
  author: {
    full_name?: string;
    username?: string;
  } | null;
};

type CapsuleDetails = {
  capsule_id: string;
  summary: string;
  reflections: CapsuleReflection[];
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
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
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

    if (selectedImageFile) {
      await handleSendImage();
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

  const handleChooseImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file." });
      return;
    }

    setSelectedImageFile(file);
    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }
    setSelectedImagePreviewUrl(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleSendImage = async () => {
    if (!token || !selectedHangout?.group_chat?.group_id || !selectedImageFile) return;

    setSendingMessage(true);
    try {
      const uploadResult = await uploadGroupChatMedia(selectedHangout.group_chat.group_id, selectedImageFile, token);
      if (!uploadResult?.success || !uploadResult?.url) {
        toast({
          title: "Upload failed",
          description: uploadResult?.error || "Could not upload image.",
        });
        return;
      }

      const result = await sendGroupMessage(
        selectedHangout.group_chat.group_id,
        {
          messageType: "text",
          payload: {
            kind: "image",
            url: uploadResult.url,
          },
        },
        token,
      );

      if (result?.success) {
        setSelectedImageFile(null);
        if (selectedImagePreviewUrl) {
          URL.revokeObjectURL(selectedImagePreviewUrl);
        }
        setSelectedImagePreviewUrl(null);
        shouldAutoScrollRef.current = true;
        void loadGroupMessages(selectedHangout.group_chat.group_id, token, false);
      } else {
        toast({
          title: "Message failed",
          description: result?.error || "Could not send image message.",
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
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopRecorderStream();
    };
  }, [selectedImagePreviewUrl]);

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

  const handleSaveReflection = async () => {
    if (!token || !selectedHangout?.capsule?.capsule_id || !reflectionDraft.trim()) return;

    setSavingReflection(true);
    try {
      const result = await addCapsuleReflection(selectedHangout.capsule.capsule_id, reflectionDraft.trim(), token);
      if (result?.success) {
        setReflectionDraft("");
        const next = await getCapsuleDetails(selectedHangout.capsule.capsule_id, token);
        setCapsuleDetails(next?.data || null);
      }
    } finally {
      setSavingReflection(false);
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

                    {selectedImagePreviewUrl && (
                      <div className="rounded-xl border border-border/50 p-3 space-y-2">
                        <img src={selectedImagePreviewUrl} alt="Selected" className="max-h-40 rounded-lg" />
                        <p className="text-xs text-muted-foreground">Image ready. Press Send to post it.</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedImageFile(null);
                              if (selectedImagePreviewUrl) {
                                URL.revokeObjectURL(selectedImagePreviewUrl);
                              }
                              setSelectedImagePreviewUrl(null);
                            }}
                            disabled={sendingMessage}
                          >
                            Remove Image
                          </Button>
                        </div>
                      </div>
                    )}

                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />

                    <div className="rounded-xl border border-border/60 bg-background p-2">
                      <div className="flex gap-2 mb-2">
                        <Button type="button" size="icon" variant="soft" onClick={handleChooseImage} title="Send image">
                          <ImagePlus className="w-4 h-4" />
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
                          disabled={sendingMessage || (!messageDraft.trim() && !selectedImageFile)}
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

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {capsuleDetails.reflections?.length ? (
                            capsuleDetails.reflections.map((reflection) => (
                              <div key={reflection.reflection_id} className="rounded-lg bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground mb-1">
                                  {reflection.author?.full_name || "Unknown"}
                                </p>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{reflection.reflection_text}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No reflections yet.</p>
                          )}
                        </div>
                      </>
                    )}

                    <Textarea
                      placeholder="Add your reflection to this capsule..."
                      value={reflectionDraft}
                      onChange={(event) => setReflectionDraft(event.target.value)}
                    />
                    <Button onClick={() => void handleSaveReflection()} disabled={savingReflection || !reflectionDraft.trim()}>
                      {savingReflection ? "Saving..." : "Save Reflection"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
};

export default SocialPage;

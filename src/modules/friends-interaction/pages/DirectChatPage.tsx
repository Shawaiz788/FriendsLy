import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { ArrowDown, ArrowLeft, ImagePlus, MapPin, Mic, MicOff } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ensureGroupKey, encryptTextPayload, resolveTextPayload } from "@/lib/e2ee";
import {
  getGroupMessages,
  getOrCreateDirectChat,
  getUserProfile,
  sendGroupMessage,
  uploadGroupChatMedia,
} from "@/lib/api";

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
    e2ee?: {
      v: number;
      alg: "nacl.secretbox";
      nonce: string;
      ciphertext: string;
    };
  };
  sender_profile: {
    full_name?: string;
    username?: string;
  } | null;
};

type FriendProfile = {
  user_id: string;
  full_name?: string;
  username?: string;
  profile_photo_url?: string;
} | null;

const DirectChatPage = () => {
  const navigate = useNavigate();
  const { friendId } = useParams();
  const [token, setToken] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [friendProfile, setFriendProfile] = useState<FriendProfile>(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const e2eeNoticeRef = useRef<string | null>(null);

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

  const loadGroupMessages = async (chatGroupId: string, authToken: string, setLoadingState = true) => {
    if (setLoadingState) setLoadingMessages(true);
    try {
      const result = await getGroupMessages(chatGroupId, authToken);
      setMessages(Array.isArray(result?.data) ? result.data : []);
    } finally {
      if (setLoadingState) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("supabaseToken") || "";
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token || !friendId) return;

    const loadChat = async () => {
      setLoadingChat(true);
      try {
        const [chatResult, profileResult] = await Promise.all([
          getOrCreateDirectChat(friendId, token),
          getUserProfile(friendId, token),
        ]);

        if (chatResult?.success && chatResult?.group_id) {
          setGroupId(chatResult.group_id);
        } else {
          toast({
            title: "Could not open chat",
            description: chatResult?.error || "Please try again.",
          });
        }

        if (profileResult?.data) {
          setFriendProfile(profileResult.data);
        }
      } finally {
        setLoadingChat(false);
      }
    };

    void loadChat();
  }, [token, friendId]);

  useEffect(() => {
    if (!token || !groupId) {
      setMessages([]);
      setHasUnseenMessages(false);
      return;
    }

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
        .channel(`direct-messages:${groupId}`)
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
  }, [groupId, token]);

  useEffect(() => {
    e2eeNoticeRef.current = null;
    setGroupKey(null);

    if (!token || !groupId) return;

    let cancelled = false;
    const loadE2eeKey = async () => {
      const result = await ensureGroupKey(groupId, token);
      if (cancelled) return;

      if (result.status === "ready") {
        setGroupKey(result.key);
        return;
      }

      if (result.status === "missing-keys") {
        if (e2eeNoticeRef.current !== "missing-keys") {
          toast({
            title: "Secure chat pending",
            description: "Waiting for chat keys from all participants.",
          });
          e2eeNoticeRef.current = "missing-keys";
        }
        return;
      }

      if (e2eeNoticeRef.current !== "error") {
        toast({
          title: "Secure chat error",
          description: result.error || "Could not set up encrypted chat.",
          variant: "destructive",
        });
        e2eeNoticeRef.current = "error";
      }
    };

    void loadE2eeKey();
    return () => {
      cancelled = true;
    };
  }, [groupId, token]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom(messages.length <= 1 ? "auto" : "smooth");
      setHasUnseenMessages(false);
    } else if (messages.length) {
      setHasUnseenMessages(true);
    }
  }, [messages]);

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

  const handleSendMessage = async () => {
    if (!token || !groupId) return;

    if (selectedImageFile) {
      await handleSendImage();
      return;
    }

    if (!messageDraft.trim()) return;
    if (!groupKey) {
      toast({
        title: "Secure chat not ready",
        description: "Wait for encryption keys before sending text.",
      });
      return;
    }

    setSendingMessage(true);
    try {
      const result = await sendGroupMessage(
        groupId,
        {
          messageType: "text",
          payload: encryptTextPayload(messageDraft.trim(), groupKey),
        },
        token,
      );
      if (result?.success) {
        setMessageDraft("");
        shouldAutoScrollRef.current = true;
        void loadGroupMessages(groupId, token, false);
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
    if (!token || !groupId || !selectedImageFile) return;

    setSendingMessage(true);
    try {
      const uploadResult = await uploadGroupChatMedia(groupId, selectedImageFile, token);
      if (!uploadResult?.success || !uploadResult?.url) {
        toast({
          title: "Upload failed",
          description: uploadResult?.error || "Could not upload image.",
        });
        return;
      }

      const result = await sendGroupMessage(
        groupId,
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
        void loadGroupMessages(groupId, token, false);
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
    if (!token || !groupId) return;

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
              groupId,
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
              void loadGroupMessages(groupId, token, false);
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
    if (!token || !groupId) return;
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
            groupId,
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
            void loadGroupMessages(groupId, token, false);
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <button
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                {friendProfile?.full_name || "Direct Chat"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {friendProfile?.username ? `@${friendProfile.username}` : "Permanent 1:1 chat"}
              </p>
            </div>
          </div>
        </div>

        <Card className="glass-card rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Direct Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingChat && <p className="text-sm text-muted-foreground">Opening chat...</p>}

            {!loadingChat && !groupId && (
              <p className="text-sm text-muted-foreground">Unable to open this chat right now.</p>
            )}

            {!loadingChat && groupId && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Chat: {groupId.slice(0, 8)} • Permanent
                </div>
                <div className="relative">
                  <div
                    ref={chatScrollRef}
                    onScroll={handleChatScroll}
                    className="h-[440px] overflow-y-auto rounded-xl bg-muted/20 p-3"
                  >
                    {loadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}

                    {!loadingMessages && !messages.length && (
                      <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
                    )}

                    {!loadingMessages &&
                      messages.map((message) => {
                        const isMine = currentUserId && message.sender_id === currentUserId;
                        const rawPayload = message.payload || { kind: "text", text: message.text || "" };
                        const payload = resolveTextPayload(rawPayload, groupKey);

                        return (
                          <div
                            key={message.message_id}
                            className={`mb-2 flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[82%] rounded-2xl px-3 py-2 ${
                                isMine
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card border border-border/60"
                              }`}
                            >
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

                              {payload.kind === "location" &&
                              typeof payload.latitude === "number" &&
                              typeof payload.longitude === "number" ? (
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

                              <p className="text-[10px] opacity-70 mt-1 text-right">
                                {formatTime(message.created_at)}
                              </p>
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

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelected}
                />

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
                      disabled={
                        sendingMessage ||
                        (!messageDraft.trim() && !selectedImageFile) ||
                        (messageDraft.trim() && !groupKey)
                      }
                    >
                      {sendingMessage ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default DirectChatPage;

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import ProximityMap, { getPositionedFriends, type PositionedFriend } from "@/components/ProximityMap";
import IntentBadge from "@/components/IntentBadge";
import SuggestionCard from "@/components/SuggestionCard";
import NearbyHighlights from "@/components/NearbyHighlights";
import TrendingActivities from "@/components/TrendingActivities";
import { Button } from "@/components/ui/button";
import { Bell, Ghost } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuraPreferences } from "@/hooks/useAuraPreferences";
import { acceptSuggestedHangout, getFriendsLocations, getMyHangoutInvites, updateMyLocation } from "@/lib/api";
import {
  DEFAULT_INTENT_PREFERENCES,
  loadIntentPreferences,
  saveIntentPreferences,
} from "@/modules/intent-aura/services/intentPreferences";
import {
  getMyIntentPreferences,
  upsertMyIntentPreferences,
} from "@/modules/intent-aura/services/intentPreferencesApi";
import {
  formatSnoozeDuration,
  loadHangoutSnoozeMap,
  saveHangoutSnoozeMap,
} from "@/lib/suggestionSnooze";
import { getNearbyHighlights, getTrendingLocalActivities } from "@/modules/location-suggestion/services/locationApi";
import type { MediaPost } from "@/modules/content-creation/services/mediaApi";

const intents = [
  { label: "Free", emoji: "✌️" },
  { label: "Busy", emoji: "💼" },
  { label: "Studying", emoji: "📚" },
  { label: "Hungry", emoji: "🍕" },
  { label: "Working", emoji: "💻" },
  { label: "Exercising", emoji: "🏃" },
  { label: "Just Chilling", emoji: "😎" },
];

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (from: [number, number], to: [number, number]) => {
  const earthRadius = 6_371_000;
  const latDelta = toRadians(to[0] - from[0]);
  const lngDelta = toRadians(to[1] - from[1]);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(toRadians(from[0])) * Math.cos(toRadians(to[0])) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const offsetCoordinateByKm = (
  origin: [number, number],
  distanceKm: number,
  bearingDegrees: number,
): [number, number] => {
  const earthRadiusKm = 6371;
  const bearingRadians = toRadians(bearingDegrees);
  const lat1 = toRadians(origin[0]);
  const lng1 = toRadians(origin[1]);
  const angularDistance = distanceKm / earthRadiusKm;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [
    (lat2 * 180) / Math.PI,
    ((lng2 * 180) / Math.PI + 540) % 360 - 180,
  ];
};

const HomePage = () => {
  const { auraPreferences } = useAuraPreferences();
  const [activeIntents, setActiveIntents] = useState(() => loadIntentPreferences().activeIntents);
  const [innerRadiusKm, setInnerRadiusKm] = useState(() => loadIntentPreferences().innerRadiusKm);
  const [outerRadiusKm, setOuterRadiusKm] = useState(() => loadIntentPreferences().outerRadiusKm);
  const [ghostMode, setGhostMode] = useState(() => localStorage.getItem("friendsly-ghost-mode") === "1");
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [token, setToken] = useState("");
  const [friendsLocations, setFriendsLocations] = useState<
    Array<{
      user_id: string;
      full_name: string;
      username: string;
      bio: string | null;
      profile_photo_url: string | null;
      latitude: number | null;
      longitude: number | null;
    }>
  >([]);
  const [startingSuggestionFor, setStartingSuggestionFor] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [snoozeUntilByUser, setSnoozeUntilByUser] = useState<Record<string, number>>(() => loadHangoutSnoozeMap());
  const [inviteCount, setInviteCount] = useState(0);
  const [nearbyHighlights, setNearbyHighlights] = useState<MediaPost[]>([]);
  const [trendingActivities, setTrendingActivities] = useState<
    Array<{
      hangout_id: string;
      title?: string;
      description?: string;
      creator_id?: string;
      location?: { x: number; y: number };
      scheduled_time?: string;
      status: string;
      participant_count?: number;
      creator?: { full_name: string; profile_photo_url?: string };
    }>
  >([]);
  const navigate = useNavigate();

  const applyPreferences = (
    preferences: {
      activeIntents: string[];
      innerRadiusKm: number;
      outerRadiusKm: number;
      autoExpire: boolean;
    },
    persistLocal = true,
  ) => {
    setActiveIntents(preferences.activeIntents);
    setInnerRadiusKm(preferences.innerRadiusKm);
    setOuterRadiusKm(preferences.outerRadiusKm);
    if (persistLocal) {
      saveIntentPreferences(preferences);
    }
  };

  const requestCurrentLocation = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          resolve({ lat: coords.latitude, lng: coords.longitude });
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        },
      );
    });

  useEffect(() => {
    const storedToken = localStorage.getItem("supabaseToken") || "";
    setToken(storedToken);

    const cachedProfileRaw = localStorage.getItem("cachedProfile");
    if (cachedProfileRaw) {
      try {
        const parsedProfile = JSON.parse(cachedProfileRaw) as { photo?: string };
        if (parsedProfile?.photo && typeof parsedProfile.photo === "string") {
          setUserAvatarUrl(parsedProfile.photo);
        }
      } catch {
        setUserAvatarUrl("");
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const loadInvites = async () => {
      try {
        const result = await getMyHangoutInvites(token);
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        setInviteCount(count);
      } catch {
        setInviteCount(0);
      }
    };

    void loadInvites();
    const intervalId = window.setInterval(loadInvites, 15_000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  // Load nearby highlights
  useEffect(() => {
    if (!token || !userLocation) return;

    const loadHighlights = async () => {
      try {
        const result = await getNearbyHighlights(userLocation, outerRadiusKm, token);
        if (Array.isArray(result?.data)) {
          setNearbyHighlights(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch highlights", err);
      }
    };

    void loadHighlights();
    const intervalId = window.setInterval(loadHighlights, 30_000); // Refresh every 30s
    return () => window.clearInterval(intervalId);
  }, [token, userLocation, outerRadiusKm]);

  // Load trending local activities
  useEffect(() => {
    if (!token) return;

    const loadActivities = async () => {
      try {
        const result = await getTrendingLocalActivities(token);
        if (Array.isArray(result?.data)) {
          setTrendingActivities(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch activities", err);
      }
    };

    void loadActivities();
    const intervalId = window.setInterval(loadActivities, 30_000); // Refresh every 30s
    return () => window.clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    localStorage.setItem("friendsly-ghost-mode", ghostMode ? "1" : "0");
  }, [ghostMode]);

  useEffect(() => {
    toast({
      title: ghostMode ? "Ghost Mode enabled" : "Ghost Mode disabled",
      description: ghostMode
        ? "Location sharing is paused."
        : "Location sharing is active again.",
    });
  }, [ghostMode]);

  useEffect(() => {
    const refreshIntentPreferences = async () => {
      const localPreferences = loadIntentPreferences();
      applyPreferences(localPreferences, false);

      if (!token) return;
      const result = await getMyIntentPreferences(token);
      if (result?.data) {
        applyPreferences({
          activeIntents: result.data.active_intents || localPreferences.activeIntents,
          innerRadiusKm: result.data.inner_radius_km ?? localPreferences.innerRadiusKm,
          outerRadiusKm: result.data.outer_radius_km ?? localPreferences.outerRadiusKm,
          autoExpire:
            typeof result.data.auto_expire === "boolean"
              ? result.data.auto_expire
              : localPreferences.autoExpire,
        });
      }
    };

    void refreshIntentPreferences();
    const handleFocus = () => {
      void refreshIntentPreferences();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [token]);

  useEffect(() => {
    const current = loadIntentPreferences();
    if (JSON.stringify(current.activeIntents) === JSON.stringify(activeIntents)) return;
    const next = {
      ...current,
      activeIntents,
    };
    saveIntentPreferences(next);
    if (!token) return;
    void upsertMyIntentPreferences(next, token);
  }, [activeIntents, token]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const nextLocation = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(nextLocation);
      },
      () => {
        setUserLocation(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    const handleManualLocationApply = (event: Event) => {
      const customEvent = event as CustomEvent<{ lat: number; lng: number }>;
      const nextLat = customEvent?.detail?.lat;
      const nextLng = customEvent?.detail?.lng;
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;

      setUserLocation({ lat: nextLat, lng: nextLng });
    };

    window.addEventListener("friendsly-location-updated", handleManualLocationApply);
    return () => {
      window.removeEventListener("friendsly-location-updated", handleManualLocationApply);
    };
  }, []);

  useEffect(() => {
    if (!token || !userLocation || ghostMode) return;

    const syncLocation = async () => {
      try {
        const result = await updateMyLocation(
          { latitude: userLocation.lat, longitude: userLocation.lng },
          token,
        );

      } catch (err) {
        console.error("Failed to sync my location", err);
      }
    };

    void syncLocation();
    const intervalId = window.setInterval(syncLocation, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [ghostMode, token, userLocation]);

  useEffect(() => {
    if (!token) return;

    const fetchFriendsLocations = async () => {
      try {
        const result = await getFriendsLocations(token);
        if (Array.isArray(result?.data)) {
          setFriendsLocations(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch friends locations", err);
      }
    };

    void fetchFriendsLocations();
    const intervalId = window.setInterval(fetchFriendsLocations, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [token]);

  const mapFriends = useMemo<PositionedFriend[]>(() => {
    if (!userLocation) return [];

    const auraEmojis = ["✨", "🌟", "⭐", "💫", "🌠", "🔮", "💎", "🎇"];

    const userPos: [number, number] = [userLocation.lat, userLocation.lng];
    const realFriends = friendsLocations
      .filter(
        (friend) =>
          typeof friend.latitude === "number" &&
          Number.isFinite(friend.latitude) &&
          typeof friend.longitude === "number" &&
          Number.isFinite(friend.longitude),
      )
      .map((friend) => {
        const friendSeed = hashString(friend.user_id || friend.full_name);
        const displacementKm = 0.5 + (friendSeed % 500) / 1000;
        const displacementBearing = friendSeed % 360;
        const [approxLat, approxLng] = offsetCoordinateByKm(
          [friend.latitude as number, friend.longitude as number],
          displacementKm,
          displacementBearing,
        );

        const distanceKm = distanceMeters(userPos, [approxLat, approxLng]) / 1000;
        const presence: PositionedFriend["presence"] =
          distanceKm <= innerRadiusKm ? "nearby" : distanceKm <= outerRadiusKm ? "city" : "away";

        // Generate consistent Aura emoji per friend
        const emojiIndex = friendSeed % auraEmojis.length;

        return {
          userId: friend.user_id,
          name: friend.full_name,
          intent: friend.bio ? friend.bio : "Available",
          presence,
          lat: approxLat,
          lng: approxLng,
          avatarUrl: friend.profile_photo_url || undefined,
          auraEmoji: auraEmojis[emojiIndex],
        };
      });

    if (realFriends.length > 0) return realFriends;
    return getPositionedFriends(userPos);
  }, [friendsLocations, innerRadiusKm, outerRadiusKm, userLocation]);

  const suggestedHangouts = useMemo(() => {
    const now = Date.now();
    return mapFriends
      .filter((friend) => (friend.presence === "nearby" || friend.presence === "city") && !!friend.userId)
      .filter((friend) => !dismissedSuggestions.includes(friend.userId!))
      .filter((friend) => {
        const until = snoozeUntilByUser[friend.userId!];
        return !until || until <= now;
      })
      .slice(0, 3);
  }, [dismissedSuggestions, mapFriends, snoozeUntilByUser]);

  const handleManualLocationUpdate = async () => {
    if (!token) {
      toast({
        title: "Not logged in",
        description: "Login is required before updating location.",
      });
      return;
    }

    if (ghostMode) {
      toast({
        title: "Ghost mode is on",
        description: "Disable Ghost Mode to share your live location.",
      });
      return;
    }

    setIsUpdatingLocation(true);
    try {
      const latestLocation = userLocation || (await requestCurrentLocation());
      setUserLocation(latestLocation);

      const result = await updateMyLocation(
        { latitude: latestLocation.lat, longitude: latestLocation.lng },
        token,
      );

      if (result?.success) {
        toast({
          title: "Location updated",
          description: "Your latest coordinates were saved successfully.",
        });
      } else {
        toast({
          title: "Update failed",
          description: result?.error || "Could not save location.",
        });
      }
    } catch (err) {
      toast({
        title: "Update failed",
        description: "Could not save location right now.",
      });
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleStartHangout = async (suggestedUserId: string) => {
    if (!token) {
      toast({
        title: "Not logged in",
        description: "Please login before starting a hangout.",
      });
      return;
    }

    const target = mapFriends.find((friend) => friend.userId === suggestedUserId);
    if (!target) {
      toast({
        title: "Suggestion expired",
        description: "Refresh your nearby suggestions and try again.",
      });
      return;
    }

    setStartingSuggestionFor(suggestedUserId);
    try {
      const result = await acceptSuggestedHangout(
        {
          suggestedUserId,
          intentName: target.intent,
          title: `${target.intent} hangout with ${target.name}`,
          description: "Created from radius overlap suggestion.",
        },
        token,
      );

      if (!result?.success) {
        toast({
          title: "Could not start hangout",
          description: result?.error || "Please try again.",
        });
        return;
      }

      toast({
        title: "Hangout started",
        description: "Opening your temporary chat and capsule workspace.",
      });
      setDismissedSuggestions((prev) => [...prev, suggestedUserId]);
      if (result?.hangout_id) {
        navigate(`/social?tab=chat&hangout=${result.hangout_id}`);
      }
    } catch (error) {
      toast({
        title: "Could not start hangout",
        description: "Please try again shortly.",
      });
    } finally {
      setStartingSuggestionFor(null);
    }
  };

  const persistSuggestionSnooze = (suggestedUserId: string, durationMs: number) => {
    const until = Date.now() + durationMs;
    setSnoozeUntilByUser((prev) => {
      const next = { ...prev, [suggestedUserId]: until };
      saveHangoutSnoozeMap(next);
      return next;
    });
  };

  const handleMessageFriend = (suggestedUserId: string) => {
    if (!token) {
      toast({
        title: "Not logged in",
        description: "Log in to open private messages.",
      });
      return;
    }
    navigate(`/chat/${suggestedUserId}`);
  };

  const handleSuggestionSnooze = (suggestedUserId: string, durationMs: number) => {
    persistSuggestionSnooze(suggestedUserId, durationMs);
    toast({
      title: "Hangout prompts snoozed",
      description: `No overlap alerts for this friend for ${formatSnoozeDuration(durationMs)}.`,
    });
  };

  /** Decline / dismiss: same storage as snooze, fixed 24 hours for this friend. */
  const handleSuggestionCancel = (suggestedUserId: string) => {
    const durationMs = 24 * 60 * 60 * 1000;
    persistSuggestionSnooze(suggestedUserId, durationMs);
    toast({
      title: "Hangout declined",
      description: "You won’t see hangout suggestions from this friend for 24 hours.",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good afternoon</p>
          <h1 className="font-serif text-2xl font-bold text-foreground">Hey there 👋</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setGhostMode((prev) => !prev);
          }}
          className={cn(
            "h-10 px-3 rounded-full flex items-center gap-2 transition-all border",
            ghostMode
              ? "bg-foreground/10 text-foreground border-foreground/20"
              : "bg-muted text-muted-foreground border-border/50",
          )}
          aria-pressed={ghostMode}
          title="Ghost Mode (pause location sharing)"
        >
          <Ghost className="w-5 h-5" />
          <span className="text-sm font-medium">Ghost Mode</span>
          <span
            className={cn(
              "text-[11px] font-semibold px-2 py-0.5 rounded-full",
              ghostMode ? "bg-primary/10 text-primary" : "bg-transparent text-muted-foreground/70",
            )}
          >
            {ghostMode ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      <div className="px-6 pb-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => navigate("/notifications")}
        >
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alerts
          </span>
          {inviteCount > 0 ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {inviteCount}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">0</span>
          )}
        </Button>
      </div>

      {/* Current intent */}
      <div className="px-6 py-4">
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">Your intent</p>
        <div className="flex flex-wrap gap-2">
          {intents.map((intent) => (
            <IntentBadge
              key={intent.label}
              label={intent.label}
              emoji={intent.emoji}
              active={activeIntents.includes(intent.label)}
              onClick={() => {
                setActiveIntents(prev => 
                  prev.includes(intent.label)
                    ? prev.filter(i => i !== intent.label)
                    : [...prev, intent.label]
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="px-4 py-4">
        <div className="px-2 pb-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleManualLocationUpdate}
            disabled={isUpdatingLocation || !userLocation}
          >
            {isUpdatingLocation ? "Updating..." : "Update location"}
          </Button>
        </div>
        <ProximityMap
          innerRadius={innerRadiusKm}
          outerRadius={outerRadiusKm}
          userPosition={!ghostMode && userLocation ? [userLocation.lat, userLocation.lng] : undefined}
          userAvatarUrl={!ghostMode ? userAvatarUrl || undefined : undefined}
          userAuraEmoji={auraPreferences?.emoji}
          userAuraColor={auraPreferences?.color}
          friends={mapFriends}
        />
      </div>

      {/* Suggestions */}
      <div className="px-6 space-y-3">
        <h2 className="font-serif text-lg font-semibold text-foreground">Suggested Hangouts</h2>
        {suggestedHangouts.length ? (
          suggestedHangouts.map((suggestion) => (
            <SuggestionCard
              key={`${suggestion.userId}-${suggestion.name}`}
              userId={suggestion.userId!}
              friendName={suggestion.name}
              intent={suggestion.intent}
              reason={`You and ${suggestion.name} are within your ${innerRadiusKm}-${outerRadiusKm}km radius and both look available.`}
              onStartHangout={handleStartHangout}
              onMessage={handleMessageFriend}
              onSnooze={handleSuggestionSnooze}
              onCancel={handleSuggestionCancel}
              isStarting={startingSuggestionFor === suggestion.userId}
            />
          ))
        ) : (
          <div className="glass-card rounded-2xl p-4 text-sm text-muted-foreground">
            No active overlap suggestions right now. Keep location on to detect nearby hangouts.
          </div>
        )}
      </div>

      {/* Nearby Highlights */}
      <div className="px-6 space-y-3 pt-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">Nearby Highlights</h2>
        <NearbyHighlights
          highlights={nearbyHighlights}
          onViewProfile={(userId) => navigate(`/user/${userId}`)}
          onLike={() => {
            toast({
              title: "Feature coming soon",
              description: "Like functionality will be available soon",
            });
          }}
        />
      </div>

      {/* Trending Local Activities */}
      <div className="px-6 space-y-3 pt-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">Trending Local Activities</h2>
        <TrendingActivities
          activities={trendingActivities}
          onJoin={(hangoutId) => navigate(`/social?tab=chat&hangout=${hangoutId}`)}
        />
      </div>

      <BottomNav />
    </div>
  );
};

export default HomePage;

import { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import ProximityMap, { getPositionedFriends, type PositionedFriend } from "@/components/ProximityMap";
import IntentBadge from "@/components/IntentBadge";
import SuggestionCard from "@/components/SuggestionCard";
import { Button } from "@/components/ui/button";
import { Ghost } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getFriendsLocations, updateMyLocation } from "@/lib/api";

const intents = [
  { label: "Free", emoji: "✌️" },
  { label: "Studying", emoji: "📚" },
  { label: "Hungry", emoji: "🍕" },
  { label: "Chilling", emoji: "😎" },
];

const INNER_RADIUS_KM = 1;
const OUTER_RADIUS_KM = 5;

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
  const [activeIntent, setActiveIntent] = useState("Free");
  const [ghostMode, setGhostMode] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [token, setToken] = useState("");
  const [friendsLocations, setFriendsLocations] = useState<
    Array<{
      user_id: string;
      full_name: string;
      bio: string | null;
      profile_photo_url: string | null;
      latitude: number | null;
      longitude: number | null;
    }>
  >([]);
  const lastNotificationKeyRef = useRef("");

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
    if (!token || !userLocation) return;

    const syncLocation = async () => {
      try {
        await updateMyLocation(
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
  }, [token, userLocation]);

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
          distanceKm <= INNER_RADIUS_KM ? "nearby" : distanceKm <= OUTER_RADIUS_KM ? "city" : "away";

        return {
          name: friend.full_name,
          intent: friend.bio ? friend.bio : "Available",
          presence,
          lat: approxLat,
          lng: approxLng,
          avatarUrl: friend.profile_photo_url || undefined,
        };
      });

    if (realFriends.length > 0) return realFriends;
    return getPositionedFriends(userPos);
  }, [friendsLocations, userLocation]);

  useEffect(() => {
    if (!userLocation) {
      lastNotificationKeyRef.current = "";
      return;
    }

    const userPos: [number, number] = [userLocation.lat, userLocation.lng];
    const friendsInBand = mapFriends.filter((friend) => {
      const dist = distanceMeters(userPos, [friend.lat, friend.lng]);
      return dist >= INNER_RADIUS_KM * 1000 && dist <= OUTER_RADIUS_KM * 1000;
    });

    if (!friendsInBand.length) {
      lastNotificationKeyRef.current = "";
      return;
    }

    const notificationKey = friendsInBand
      .map((friend) => friend.name)
      .sort((a, b) => a.localeCompare(b))
      .join("|");

    if (notificationKey === lastNotificationKeyRef.current) return;

    lastNotificationKeyRef.current = notificationKey;

    if (friendsInBand.length === 1) {
      toast({
        title: "Hangout suggestion",
        description: `${friendsInBand[0].name} is in your ${INNER_RADIUS_KM}–${OUTER_RADIUS_KM}km radius. Invite them?`,
      });
      return;
    }

    const friendNames = friendsInBand.map((friend) => friend.name).join(", ");
    toast({
      title: "Group hangout suggestion",
      description: `${friendNames} are in your ${INNER_RADIUS_KM}–${OUTER_RADIUS_KM}km radius. Start a group hangout?`,
    });
  }, [mapFriends, userLocation]);

  const handleManualLocationUpdate = async () => {
    if (!token) {
      toast({
        title: "Not logged in",
        description: "Login is required before updating location.",
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good afternoon</p>
          <h1 className="font-serif text-2xl font-bold text-foreground">Hey there 👋</h1>
        </div>
        <button
          onClick={() => setGhostMode(!ghostMode)}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            ghostMode ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
          )}
          title="Ghost Mode"
        >
          <Ghost className="w-5 h-5" />
        </button>
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
              active={activeIntent === intent.label}
              onClick={() => setActiveIntent(intent.label)}
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
          innerRadius={INNER_RADIUS_KM}
          outerRadius={OUTER_RADIUS_KM}
          userPosition={userLocation ? [userLocation.lat, userLocation.lng] : undefined}
          userAvatarUrl={userAvatarUrl || undefined}
          friends={mapFriends}
        />
      </div>

      {/* Suggestions */}
      <div className="px-6 space-y-3">
        <h2 className="font-serif text-lg font-semibold text-foreground">Suggested Hangouts</h2>
        <SuggestionCard
          friendName="Sara"
          intent="Free"
          reason="You and Sara are within your 2–5km radius and both marked as 'Free'."
        />
        <SuggestionCard
          friendName="Ali"
          intent="Studying"
          reason="You and Ali are nearby. Ali is also 'Studying' – start a study session?"
        />
      </div>

      <BottomNav />
    </div>
  );
};

export default HomePage;

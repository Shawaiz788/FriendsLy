import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Friend {
  name: string;
  intent: string;
  presence: "nearby" | "city" | "away";
  latOffset: number;
  lngOffset: number;
}

export interface PositionedFriend {
  userId?: string;
  name: string;
  intent: string;
  presence: "nearby" | "city" | "away";
  lat: number;
  lng: number;
  avatarUrl?: string;
  auraEmoji?: string;
}

export const mockFriends: Friend[] = [
  { name: "Sara", intent: "Free ✌️", presence: "nearby", latOffset: 0.0105, lngOffset: 0.0094 },
  { name: "Ali", intent: "Studying 📚", presence: "nearby", latOffset: 0.0014, lngOffset: -0.0028 },
  { name: "Mia", intent: "Hungry 🍕", presence: "city", latOffset: -0.0089, lngOffset: -0.0171 },
  { name: "Zain", intent: "Busy 💼", presence: "away", latOffset: -0.0306, lngOffset: -0.0502 },
];

export const DEFAULT_USER_POS: [number, number] = [37.7749, -122.4194];

export const getPositionedFriends = (userPosition: [number, number]): PositionedFriend[] =>
  mockFriends.map((friend) => ({
    name: friend.name,
    intent: friend.intent,
    presence: friend.presence,
    lat: userPosition[0] + friend.latOffset,
    lng: userPosition[1] + friend.lngOffset,
  }));

const presenceColors: Record<string, string> = {
  nearby: "hsl(150, 30%, 45%)",
  city: "hsl(15, 70%, 65%)",
  away: "hsl(150, 10%, 55%)",
};

interface ProximityMapProps {
  innerRadius?: number;
  outerRadius?: number;
  userPosition?: [number, number];
  userAvatarUrl?: string;
  userAuraEmoji?: string;
  userAuraColor?: string;
  friends?: PositionedFriend[];
}

const ProximityMap = ({ innerRadius = 1, outerRadius = 5, userPosition, userAvatarUrl, userAuraEmoji, userAuraColor, friends }: ProximityMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const innerCircleRef = useRef<L.Circle | null>(null);
  const outerCircleRef = useRef<L.Circle | null>(null);
  const friendLayerRef = useRef<L.LayerGroup | null>(null);
  const hasUserPosition = Array.isArray(userPosition);
  const currentUserPos = userPosition ?? DEFAULT_USER_POS;
  const mapCenter = useMemo<[number, number]>(() => {
    if (hasUserPosition && userPosition) return userPosition;
    if (friends && friends.length > 0) return [friends[0].lat, friends[0].lng];
    return DEFAULT_USER_POS;
  }, [friends, hasUserPosition, userPosition]);

  const positionedFriends = useMemo(() => {
    if (friends && friends.length > 0) return friends;
    return getPositionedFriends(currentUserPos);
  }, [currentUserPos, friends]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: currentUserPos,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      innerCircleRef.current = null;
      outerCircleRef.current = null;
      friendLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    map.setView(mapCenter, map.getZoom(), { animate: false });

    if (hasUserPosition) {
      const auraColor = userAuraColor || "hsl(150, 30%, 45%)";
      if (!outerCircleRef.current) {
        outerCircleRef.current = L.circle(currentUserPos, {
          radius: outerRadius * 1000,
          color: auraColor,
          weight: 2,
          fillColor: auraColor,
          fillOpacity: 0.06,
          dashArray: "8 6",
        }).addTo(map);
      } else {
        outerCircleRef.current.setLatLng(currentUserPos);
        outerCircleRef.current.setRadius(outerRadius * 1000);
        outerCircleRef.current.setStyle({
          color: auraColor,
          fillColor: auraColor,
        });
      }

      if (!innerCircleRef.current) {
        innerCircleRef.current = L.circle(currentUserPos, {
          radius: innerRadius * 1000,
          color: "hsl(15, 70%, 65%)",
          weight: 2,
          fillColor: "hsl(15, 70%, 65%)",
          fillOpacity: 0.08,
        }).addTo(map);
      } else {
        innerCircleRef.current.setLatLng(currentUserPos);
        innerCircleRef.current.setRadius(innerRadius * 1000);
      }
    } else {
      if (outerCircleRef.current) {
        map.removeLayer(outerCircleRef.current);
        outerCircleRef.current = null;
      }
      if (innerCircleRef.current) {
        map.removeLayer(innerCircleRef.current);
        innerCircleRef.current = null;
      }
    }

    if (hasUserPosition) {
      const safeUserAvatarUrl =
        typeof userAvatarUrl === "string" && userAvatarUrl.length > 0
          ? userAvatarUrl.replace(/"/g, "&quot;")
          : "";

      const userMarkerInner = safeUserAvatarUrl
        ? `<img src="${safeUserAvatarUrl}" alt="You" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
        : "<span style='color:white;font-weight:700;font-size:13px;font-family:\"DM Sans\",sans-serif;'>You</span>";

      const auraEmojiBadge = userAuraEmoji
        ? `<div style="position:absolute;bottom:0;right:0;width:26px;height:26px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2.5px solid ${userAuraColor || '#8b5cf6'};">${userAuraEmoji}</div>`
        : "";

      const userIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:60px;height:72px;display:flex;align-items:flex-end;justify-content:center;"><div style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:white;color:hsl(150,30%,35%);font-weight:700;font-size:11px;font-family:'DM Sans',sans-serif;padding:2px 8px;border-radius:999px;border:1px solid hsl(150,30%,45%);box-shadow:0 2px 8px rgba(0,0,0,0.1);line-height:1;">You</div><div style="position:relative;width:48px;height:48px;border-radius:50%;background:hsl(150,30%,45%);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px hsla(150,30%,45%,0.4);border:3px solid white;">${userMarkerInner}${auraEmojiBadge}</div></div>`,
        iconSize: [60, 72],
        iconAnchor: [30, 72],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(currentUserPos, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(currentUserPos);
        userMarkerRef.current.setIcon(userIcon);
        userMarkerRef.current.setZIndexOffset(1000);
      }
    } else if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (friendLayerRef.current) {
      friendLayerRef.current.remove();
      friendLayerRef.current = null;
    }

    const friendLayer = L.layerGroup();

    positionedFriends.forEach((friend) => {
      const safeAvatarUrl =
        typeof friend.avatarUrl === "string" && friend.avatarUrl.length > 0
          ? friend.avatarUrl.replace(/"/g, "&quot;")
          : "";

      const markerInner = safeAvatarUrl
        ? `<img src="${safeAvatarUrl}" alt="${friend.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
        : friend.name[0];

      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:36px;height:36px;border-radius:50%;background:${presenceColors[friend.presence]};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;font-family:'DM Sans',sans-serif;box-shadow:0 4px 12px ${presenceColors[friend.presence]}66;border:2px solid white;">${markerInner}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([friend.lat, friend.lng], { icon, zIndexOffset: 100 })
        .bindPopup(`<div style="font-family:'DM Sans',sans-serif;text-align:center"><strong>${friend.name}</strong><br/><span style="font-size:12px;opacity:0.7">${friend.intent}</span></div>`)
        .addTo(friendLayer);
    });

    friendLayer.addTo(map);
    friendLayerRef.current = friendLayer;
  }, [hasUserPosition, innerRadius, mapCenter, outerRadius, currentUserPos, positionedFriends, userAvatarUrl, userAuraEmoji, userAuraColor]);

  return (
    <div
      ref={containerRef}
      className="proximity-map relative z-0 w-full rounded-2xl overflow-hidden shadow-lg border border-border/50"
      style={{ height: 360 }}
    />
  );
};

export default ProximityMap;

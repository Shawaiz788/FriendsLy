import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Friend {
  name: string;
  intent: string;
  presence: "nearby" | "city" | "away";
  lat: number;
  lng: number;
}

const mockFriends: Friend[] = [
  { name: "Sara", intent: "Free ✌️", presence: "nearby", lat: 37.785, lng: -122.41 },
  { name: "Ali", intent: "Studying 📚", presence: "nearby", lat: 37.775, lng: -122.42 },
  { name: "Mia", intent: "Hungry 🍕", presence: "city", lat: 37.76, lng: -122.44 },
  { name: "Zain", intent: "Busy 💼", presence: "away", lat: 37.73, lng: -122.47 },
];

const USER_POS: L.LatLngExpression = [37.7749, -122.4194];

const presenceColors: Record<string, string> = {
  nearby: "hsl(150, 30%, 45%)",
  city: "hsl(15, 70%, 65%)",
  away: "hsl(150, 10%, 55%)",
};

interface ProximityMapProps {
  innerRadius?: number;
  outerRadius?: number;
}

const ProximityMap = ({ innerRadius = 1, outerRadius = 5 }: ProximityMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: USER_POS,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);

    // Outer radius
    L.circle(USER_POS as [number, number], {
      radius: outerRadius * 1000,
      color: "hsl(150, 30%, 45%)",
      weight: 2,
      fillColor: "hsl(150, 30%, 45%)",
      fillOpacity: 0.06,
      dashArray: "8 6",
    }).addTo(map);

    // Inner radius
    L.circle(USER_POS as [number, number], {
      radius: innerRadius * 1000,
      color: "hsl(15, 70%, 65%)",
      weight: 2,
      fillColor: "hsl(15, 70%, 65%)",
      fillOpacity: 0.08,
    }).addTo(map);

    // User marker
    const userIcon = L.divIcon({
      className: "",
      html: `<div style="width:44px;height:44px;border-radius:50%;background:hsl(150,30%,45%);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;font-family:'DM Sans',sans-serif;box-shadow:0 6px 20px hsla(150,30%,45%,0.4);border:3px solid white;">You</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    L.marker(USER_POS as [number, number], { icon: userIcon }).addTo(map);

    // Friend markers
    mockFriends.forEach((friend) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:36px;height:36px;border-radius:50%;background:${presenceColors[friend.presence]};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;font-family:'DM Sans',sans-serif;box-shadow:0 4px 12px ${presenceColors[friend.presence]}66;border:2px solid white;">${friend.name[0]}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([friend.lat, friend.lng], { icon })
        .bindPopup(`<div style="font-family:'DM Sans',sans-serif;text-align:center"><strong>${friend.name}</strong><br/><span style="font-size:12px;opacity:0.7">${friend.intent}</span></div>`)
        .addTo(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [innerRadius, outerRadius]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden shadow-lg border border-border/50"
      style={{ height: 360 }}
    />
  );
};

export default ProximityMap;

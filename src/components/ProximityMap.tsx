import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

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

const USER_POS: [number, number] = [37.7749, -122.4194]; // San Francisco

const presenceColors: Record<string, string> = {
  nearby: "hsl(150, 30%, 45%)",
  city: "hsl(15, 70%, 65%)",
  away: "hsl(150, 10%, 55%)",
};

const createFriendIcon = (name: string, presence: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${presenceColors[presence]};
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:700;font-size:14px;font-family:'DM Sans',sans-serif;
      box-shadow:0 4px 12px ${presenceColors[presence]}66;
      border:2px solid white;
    ">${name[0]}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

const userIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:44px;height:44px;border-radius:50%;
    background:hsl(150,30%,45%);
    display:flex;align-items:center;justify-content:center;
    color:white;font-weight:700;font-size:13px;font-family:'DM Sans',sans-serif;
    box-shadow:0 6px 20px hsla(150,30%,45%,0.4);
    border:3px solid white;
  ">You</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

interface ProximityMapProps {
  innerRadius?: number; // km
  outerRadius?: number; // km
}

const ProximityMap = ({ innerRadius = 1, outerRadius = 5 }: ProximityMapProps) => {
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-lg border border-border/50" style={{ height: 360 }}>
      <MapContainer
        center={USER_POS}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Outer radius ring */}
        <Circle
          center={USER_POS}
          radius={outerRadius * 1000}
          pathOptions={{
            color: "hsl(150, 30%, 45%)",
            weight: 2,
            fillColor: "hsl(150, 30%, 45%)",
            fillOpacity: 0.06,
            dashArray: "8 6",
          }}
        />

        {/* Inner radius ring */}
        <Circle
          center={USER_POS}
          radius={innerRadius * 1000}
          pathOptions={{
            color: "hsl(15, 70%, 65%)",
            weight: 2,
            fillColor: "hsl(15, 70%, 65%)",
            fillOpacity: 0.08,
          }}
        />

        {/* User marker */}
        <Marker position={USER_POS} icon={userIcon} />

        {/* Friends markers */}
        {mockFriends.map((friend) => (
          <Marker
            key={friend.name}
            position={[friend.lat, friend.lng]}
            icon={createFriendIcon(friend.name, friend.presence)}
          >
            <Popup className="friendly-popup">
              <div style={{ fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>
                <strong>{friend.name}</strong>
                <br />
                <span style={{ fontSize: 12, opacity: 0.7 }}>{friend.intent}</span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default ProximityMap;

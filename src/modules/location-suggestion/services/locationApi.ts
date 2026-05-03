import { API_BASE } from "@/lib/apiBase";
import type { MediaPost } from "@/modules/content-creation/services/mediaApi";

// Location and suggestion APIs

export async function updateMyLocation(
  { latitude, longitude }: { latitude: number; longitude: number },
  token: string,
) {
  const res = await fetch(`${API_BASE}/api/user/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ latitude, longitude }),
  });

  const responseText = await res.text();
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: responseText || `Request failed with status ${res.status}`,
    };
  }
}

export async function getFriendsLocations(token: string) {
  const res = await fetch(`${API_BASE}/api/user/friends/locations`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const responseText = await res.text();
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      data: [],
      error: responseText || `Request failed with status ${res.status}`,
    };
  }
}

// Get nearby highlights (posts from friends within radius)
export async function getNearbyHighlights(
  userLocation: { lat: number; lng: number },
  radiusKm: number,
  token: string,
) {
  try {
    const res = await fetch(`${API_BASE}/api/user/media/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!Array.isArray(data?.data)) {
      return { data: [], error: null };
    }

    // Simple distance calculation (Haversine formula)
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const distanceKmBetween = (
      from: { lat: number; lng: number },
      to: { lat: number; lng: number },
    ) => {
      const earthRadius = 6371; // km
      const latDelta = toRadians(to.lat - from.lat);
      const lngDelta = toRadians(to.lng - from.lng);
      const a =
        Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
        Math.cos(toRadians(from.lat)) *
          Math.cos(toRadians(to.lat)) *
          Math.sin(lngDelta / 2) *
          Math.sin(lngDelta / 2);
      return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Filter highlights with valid locations (if available) and sort by recent
    const nearby = data.data
      .filter((post: MediaPost) => post.visibility !== "public" || post.like_count !== undefined)
      .slice(0, 5); // Simple limit to top 5 recent posts

    return { data: nearby, error: null };
  } catch (error) {
    return { data: [], error: String(error) };
  }
}

// Get trending local activities (hangouts nearby)
export async function getTrendingLocalActivities(token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/user/hangouts/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!Array.isArray(data?.data)) {
      return { data: [], error: null };
    }

    // Filter active hangouts and sort by creation time (trending)
    const trending = data.data
      .filter(
        (hangout: any) =>
          hangout.status === "confirmed" || hangout.status === "pending",
      )
      .sort((a: any, b: any) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      })
      .slice(0, 5); // Simple limit to top 5

    return { data: trending, error: null };
  } catch (error) {
    return { data: [], error: String(error) };
  }
}

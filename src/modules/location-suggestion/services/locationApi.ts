// Location and suggestion APIs

const API_BASE = "http://localhost:3001";

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

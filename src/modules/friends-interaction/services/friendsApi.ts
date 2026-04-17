// Messaging and interaction APIs

const API_BASE = "http://localhost:3001";

export async function searchUsers(query: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getFriendRequestStatus(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/${userId}/friend-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function sendFriendRequest(addresseeId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/friend-request/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ addressee_id: addresseeId }),
  });
  return res.json();
}

export async function acceptFriendRequest(requesterId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/friend-request/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requester_id: requesterId }),
  });
  return res.json();
}

export async function rejectFriendRequest(requesterId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/friend-request/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requester_id: requesterId }),
  });
  return res.json();
}

export async function getIncomingFriendRequests(token: string) {
  const res = await fetch(`${API_BASE}/api/user/friend-requests/incoming`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getAcceptedFriends(token: string) {
  const res = await fetch(`${API_BASE}/api/user/friends`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

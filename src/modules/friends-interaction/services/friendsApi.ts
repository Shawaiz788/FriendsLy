// Messaging and interaction APIs

const API_BASE = "http://localhost:3001";

async function parseResponseSafe(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return { error: 'Invalid JSON response', status: res.status, body: text };
    }
  }
  return { error: 'Unexpected response from server', status: res.status, body: text };
}

export async function searchUsers(query: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponseSafe(res);
}

export async function getFriendRequestStatus(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/${userId}/friend-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponseSafe(res);
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
  return parseResponseSafe(res);
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
  return parseResponseSafe(res);
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
  return parseResponseSafe(res);
}

export async function getIncomingFriendRequests(token: string) {
  const res = await fetch(`${API_BASE}/api/user/friend-requests/incoming`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponseSafe(res);
}

export async function getAcceptedFriends(token: string) {
  const res = await fetch(`${API_BASE}/api/user/friends`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponseSafe(res);
}

// User and account management APIs

const API_BASE = "http://localhost:3001";

async function parseResponse(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return { error: 'Invalid JSON response', status: res.status, body: text };
    }
  }

  // Non-JSON response (likely HTML) — return helpful error info
  return { error: 'Unexpected response from server', status: res.status, body: text };
}

export async function checkUsernameAvailability(username: string) {
  const res = await fetch(`${API_BASE}/check-username?username=${encodeURIComponent(username)}`);
  return res.json();
}

export async function uploadProfileImage(file: File, userId: string, token: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("userId", userId);

  const res = await fetch(`${API_BASE}/api/user/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  return res.json();
}

export async function registerUser({ name, username, email, phone, password, date_of_birth, gender }) {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name,
      username,
      phone,
      photo: "",
      interests: "",
      date_of_birth,
      gender,
    }),
  });
  return res.json();
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function editProfile({
  name,
  username,
  photo,
  interests,
  date_of_birth,
  gender,
  dark_mode_enabled,
  selected_theme,
  token,
}) {
  const res = await fetch(`${API_BASE}/api/user/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      username,
      photo,
      interests,
      date_of_birth,
      gender,
      dark_mode_enabled,
      selected_theme,
    }),
  });
  return res.json();
}

export async function getUserProfile(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/${userId}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getTrustedContacts(token: string) {
  const res = await fetch(`${API_BASE}/api/user/trusted-contacts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(res);
}

export async function addTrustedContact(contactUserId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/trusted-contacts/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contact_user_id: contactUserId }),
  });
  return parseResponse(res);
}

export async function removeTrustedContact(contactUserId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/trusted-contacts/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contact_user_id: contactUserId }),
  });
  return parseResponse(res);
}

export async function getBlockedUsers(token: string) {
  const res = await fetch(`${API_BASE}/api/user/blocks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(res);
}

export async function blockUser(blockedUserId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ blocked_user_id: blockedUserId }),
  });
  return parseResponse(res);
}

export async function unblockUser(blockedUserId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/blocks`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ blocked_user_id: blockedUserId }),
  });
  return parseResponse(res);
}

export async function reportUser(reportedUserId: string, reason: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reported_user_id: reportedUserId, reason }),
  });
  return parseResponse(res);
}

export async function logoutCurrentSession(token: string) {
  const res = await fetch(`${API_BASE}/api/user/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return parseResponse(res);
}

export async function logoutAllSessions(token: string) {
  const res = await fetch(`${API_BASE}/api/user/logoutAll`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return parseResponse(res);
}

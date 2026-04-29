// User and account management APIs

const API_BASE = "http://localhost:3001";

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

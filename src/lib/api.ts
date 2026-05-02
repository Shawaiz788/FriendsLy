// Backward-compatible API barrel for legacy imports.
// New code should import from module service files directly.

export * from "@/modules/user-account/services/userAccountApi";
export * from "@/modules/friends-interaction/services/friendsApi";
export * from "@/modules/friends-interaction/services/hangoutApi";
export * from "@/modules/location-suggestion/services/locationApi";
export * from "@/modules/content-creation/services/mediaApi";
// Check if username is available
export async function checkUsernameAvailability(username: string) {
  const res = await fetch(`http://localhost:3001/api/user/check-username?username=${encodeURIComponent(username)}`);
  return res.json();
}

// Upload profile image to Supabase Storage
export async function uploadProfileImage(file: File, userId: string, token: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  
  const res = await fetch('http://localhost:3001/api/user/upload-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData
  });
  return res.json();
}

// Check if username is available
// API helpers for registration and login
export async function registerUser({ name, username, email, phone, password, date_of_birth, gender }) {
  const res = await fetch('http://localhost:3001/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name,
      username,
      phone,
      photo: '',
      interests: '',
      date_of_birth,
      gender
    })
  });
  return res.json();
}

export async function loginUser({ email, password }) {
  const res = await fetch('http://localhost:3001/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

// Note: Friend-related functions are now imported from module service files above
// searchUsers, getFriendRequestStatus, sendFriendRequest, acceptFriendRequest, 
// rejectFriendRequest, getIncomingFriendRequests, getAcceptedFriends are all re-exported
// from @/modules/friends-interaction/services/friendsApi

export async function editProfile({ name, username, photo, interests, date_of_birth, gender, token }) {
  const res = await fetch('http://localhost:3001/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ name, username, photo, interests, date_of_birth, gender })
  });
  return res.json();
}

export async function getUserProfile(userId: string, token: string) {
  const res = await fetch(`http://localhost:3001/api/user/${userId}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

export async function updateMyLocation(
  { latitude, longitude }: { latitude: number; longitude: number },
  token: string,
) {
  const res = await fetch('http://localhost:3001/api/user/location', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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
  const res = await fetch('http://localhost:3001/api/user/friends/locations', {
    headers: { 'Authorization': `Bearer ${token}` },
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
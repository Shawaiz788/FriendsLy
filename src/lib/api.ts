export interface Story {
  story_id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  expires_at: string;  // ISO date
  visibility?: string;
  created_at?: string;
  author?: {
    full_name: string | null;
    username: string | null;
    profile_photo_url: string | null;
  };
}

// Backward-compatible API barrel for legacy imports.
// New code should import from module service files directly.
import { API_BASE } from "@/lib/apiBase";

export * from "@/modules/user-account/services/userAccountApi";
export * from "@/modules/friends-interaction/services/friendsApi";
export * from "@/modules/friends-interaction/services/hangoutApi";
export * from "@/modules/location-suggestion/services/locationApi";
export * from "@/modules/content-creation/services/mediaApi";
// Check if username is available
export async function checkUsernameAvailability(username: string) {
  const res = await fetch(`${API_BASE}/api/user/check-username?username=${encodeURIComponent(username)}`);
  return res.json();
}

// Upload profile image to Supabase Storage
export async function uploadProfileImage(file: File, userId: string, token: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  
  const res = await fetch(`${API_BASE}/api/user/upload-image`, {
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
  const res = await fetch(`${API_BASE}/register`, {
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
  
  const data = await res.json();
  
  if (!res.ok) {
    return { error: data.error || data.message || 'Registration failed', user: null };
  }
  
  return { error: null, user: data.user };
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    return { error: data.error || data.message || 'Login failed', session: null, user: null };
  }
  
  return { error: null, session: data.session, user: data.user };
}

// Note: Friend-related functions are now imported from module service files above
// searchUsers, getFriendRequestStatus, sendFriendRequest, acceptFriendRequest, 
// rejectFriendRequest, getIncomingFriendRequests, getAcceptedFriends are all re-exported
// from @/modules/friends-interaction/services/friendsApi

export async function editProfile({ name, username, photo, interests, date_of_birth, gender, token }) {
  const res = await fetch(`${API_BASE}/api/user/profile`, {
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
  const res = await fetch(`${API_BASE}/api/user/${userId}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

export async function updateMyLocation(
  { latitude, longitude }: { latitude: number; longitude: number },
  token: string,
) {
  const res = await fetch(`${API_BASE}/api/user/location`, {
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
  const res = await fetch(`${API_BASE}/api/user/friends/locations`, {
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

// Story API functions
export async function uploadStoryMedia(file: File, token: string) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/api/user/stories/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData
  });
  return res.json();
}

export async function createStory(mediaUrl: string, mediaType: string, visibility: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      media_url: mediaUrl,
      media_type: mediaType,
      visibility: visibility || 'friends'
    })
  });
  return res.json();
}

export async function getStories(token: string) {
  const res = await fetch(`${API_BASE}/api/user/stories`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

export async function deleteStory(storyId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/stories/${storyId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// Collaborative Posts API functions
export async function createCollaborativePost(data: {
  content?: string;
  media_url?: string;
  media_type?: string;
  visibility?: string;
  collaborators?: string[];
}, token: string) {
  const res = await fetch(`${API_BASE}/api/user/collaborative-posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getCollaborativePosts(token: string) {
  const res = await fetch(`${API_BASE}/api/user/collaborative-posts`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

export async function updateCollaborativePost(postId: string, data: {
  content?: string;
  media_url?: string;
  media_type?: string;
  visibility?: string;
}, token: string) {
  const res = await fetch(`${API_BASE}/api/user/collaborative-posts/${postId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteCollaborativePost(postId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/collaborative-posts/${postId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

export async function addCollaborator(postId: string, userId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/collaborative-posts/${postId}/collaborators`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ userId })
  });
  return res.json();
}

export async function removeCollaborator(postId: string, userId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/collaborative-posts/${postId}/collaborators/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

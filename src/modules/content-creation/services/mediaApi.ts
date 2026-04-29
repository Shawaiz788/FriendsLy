const API_BASE = "http://localhost:3001/api/user";

export type MediaPost = {
  post_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  author?: {
    full_name: string | null;
    username: string | null;
    profile_photo_url: string | null;
  };
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
};

export type MediaComment = {
  comment_id: string;
  post_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  author?: {
    full_name: string | null;
    username: string | null;
    profile_photo_url: string | null;
  };
};

export async function getMediaFeed(token: string) {
  const res = await fetch(`${API_BASE}/media/feed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function uploadPostMedia(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return res.json();
}

export async function createMediaPost(
  {
    content,
    media_url,
    media_type,
    visibility,
  }: {
    content: string;
    media_url?: string;
    media_type?: string;
    visibility?: "friends" | "close_friends" | "public";
  },
  token: string,
) {
  const res = await fetch(`${API_BASE}/media/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content, media_url, media_type, visibility }),
  });

  return res.json();
}

export async function togglePostLike(postId: string, token: string) {
  const res = await fetch(`${API_BASE}/media/posts/${encodeURIComponent(postId)}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}

export async function getPostComments(postId: string, token: string) {
  const res = await fetch(`${API_BASE}/media/posts/${encodeURIComponent(postId)}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}

export async function addPostComment(postId: string, comment_text: string, token: string) {
  const res = await fetch(`${API_BASE}/media/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ comment_text }),
  });

  return res.json();
}

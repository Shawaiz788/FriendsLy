// Hangout interaction APIs under friends-interaction module.

const API_BASE = "http://localhost:3001";

async function parseResponseSafe(res: Response) {
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

export async function acceptSuggestedHangout(
  {
    suggestedUserId,
    intentName,
    title,
    description,
  }: { suggestedUserId: string; intentName?: string; title?: string; description?: string },
  token: string,
) {
  const res = await fetch(`${API_BASE}/api/user/hangouts/suggested/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      suggested_user_id: suggestedUserId,
      intent_name: intentName,
      title,
      description,
    }),
  });

  return parseResponseSafe(res);
}

export async function getMyHangoutInvites(token: string) {
  const res = await fetch(`${API_BASE}/api/user/hangouts/invites`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponseSafe(res);
}

export async function respondToHangoutInvite(
  hangoutId: string,
  action: "accept" | "decline",
  token: string,
) {
  const res = await fetch(`${API_BASE}/api/user/hangouts/${hangoutId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action }),
  });

  return parseResponseSafe(res);
}

export async function getMyHangouts(token: string) {
  const res = await fetch(`${API_BASE}/api/user/hangouts/mine`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponseSafe(res);
}

export async function getOrCreateDirectChat(friendId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/chats/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ friend_id: friendId }),
  });

  return parseResponseSafe(res);
}

export async function getGroupMessages(groupId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/groups/${groupId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponseSafe(res);
}

type ChatMessagePayload = {
  kind: "text" | "image" | "video" | "voice" | "location";
  text?: string;
  url?: string;
  latitude?: number;
  longitude?: number;
  duration_ms?: number;
};

export async function sendGroupMessage(
  groupId: string,
  {
    text,
    messageType,
    payload,
  }: {
    text?: string;
    messageType?: "text" | "voice" | "poll";
    payload?: ChatMessagePayload;
  },
  token: string,
) {
  const res = await fetch(`${API_BASE}/api/user/groups/${groupId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, message_type: messageType, payload }),
  });

  return parseResponseSafe(res);
}

export async function uploadGroupChatMedia(groupId: string, file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/user/groups/${groupId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return parseResponseSafe(res);
}

export async function getCapsuleDetails(capsuleId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/capsules/${capsuleId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponseSafe(res);
}

export async function addCapsuleReflection(capsuleId: string, reflectionText: string, token: string) {
  const res = await fetch(`${API_BASE}/api/user/capsules/${capsuleId}/reflections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reflection_text: reflectionText }),
  });

  return parseResponseSafe(res);
}

export async function addCapsuleMedia(
  capsuleId: string,
  {
    mediaUrl,
    mediaType,
  }: {
    mediaUrl: string;
    mediaType: "image" | "video";
  },
  token: string,
) {
  const res = await fetch(`${API_BASE}/api/user/capsules/${capsuleId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ media_url: mediaUrl, media_type: mediaType }),
  });

  return parseResponseSafe(res);
}

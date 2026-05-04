import nacl from "tweetnacl";
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from "tweetnacl-util";
import { API_BASE } from "@/lib/apiBase";

type IdentityKeyPair = {
  publicKey: string;
  secretKey: string;
};

type GroupKeyMap = Record<string, string>;

type E2eeWrappedKeyResponse = {
  group_id: string;
  recipient_user_id: string;
  wrapper_user_id: string;
  nonce: string;
  boxed_key: string;
  wrapper_public_key?: string | null;
} | null;

type GroupMemberKey = {
  user_id: string;
  e2ee_public_key?: string | null;
};

type E2eeTextPayload = {
  kind: "text";
  text?: string;
  e2ee?: {
    v: number;
    alg: "nacl.secretbox";
    nonce: string;
    ciphertext: string;
  };
};

type EnsureGroupKeyResult =
  | { status: "ready"; key: string }
  | { status: "missing-keys"; missingUserIds: string[] }
  | { status: "error"; error: string };

const IDENTITY_STORAGE_KEY = "friendsly.e2ee.identity";
const GROUP_KEYS_STORAGE_KEY = "friendsly.e2ee.groupKeys";

const parseResponseSafe = async (res: Response) => {
  const responseText = await res.text();
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: responseText || `Request failed with status ${res.status}`,
    };
  }
};

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

export const getOrCreateIdentityKeyPair = (): IdentityKeyPair => {
  const stored = readJson<IdentityKeyPair | null>(IDENTITY_STORAGE_KEY, null);
  if (stored?.publicKey && stored?.secretKey) return stored;

  const keyPair = nacl.box.keyPair();
  const identity = {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
  writeJson(IDENTITY_STORAGE_KEY, identity);
  return identity;
};

export const ensurePublicKeyPublished = async (token: string) => {
  const identity = getOrCreateIdentityKeyPair();
  const res = await fetch(`${API_BASE}/api/user/e2ee/public-key`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ public_key: identity.publicKey }),
  });

  return parseResponseSafe(res);
};

export const getGroupKey = (groupId: string): string | null => {
  const map = readJson<GroupKeyMap>(GROUP_KEYS_STORAGE_KEY, {});
  const value = map[groupId];
  return typeof value === "string" && value ? value : null;
};

export const setGroupKey = (groupId: string, key: string) => {
  const map = readJson<GroupKeyMap>(GROUP_KEYS_STORAGE_KEY, {});
  map[groupId] = key;
  writeJson(GROUP_KEYS_STORAGE_KEY, map);
};

const wrapGroupKeyForRecipient = (
  groupKeyBase64: string,
  recipientPublicKeyBase64: string,
  wrapperSecretKeyBase64: string,
) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const groupKeyBytes = decodeBase64(groupKeyBase64);
  const recipientPublicKey = decodeBase64(recipientPublicKeyBase64);
  const wrapperSecretKey = decodeBase64(wrapperSecretKeyBase64);
  const boxed = nacl.box(groupKeyBytes, nonce, recipientPublicKey, wrapperSecretKey);

  return {
    nonce: encodeBase64(nonce),
    boxed_key: encodeBase64(boxed),
  };
};

const unwrapGroupKey = (
  wrappedKey: E2eeWrappedKeyResponse,
  recipientSecretKeyBase64: string,
): string | null => {
  if (!wrappedKey?.nonce || !wrappedKey?.boxed_key || !wrappedKey?.wrapper_public_key) return null;

  try {
    const nonce = decodeBase64(wrappedKey.nonce);
    const boxedKey = decodeBase64(wrappedKey.boxed_key);
    const wrapperPublicKey = decodeBase64(wrappedKey.wrapper_public_key);
    const recipientSecretKey = decodeBase64(recipientSecretKeyBase64);
    const opened = nacl.box.open(boxedKey, nonce, wrapperPublicKey, recipientSecretKey);
    if (!opened) return null;
    return encodeBase64(opened);
  } catch {
    return null;
  }
};

const fetchGroupWrappedKey = async (groupId: string, token: string): Promise<E2eeWrappedKeyResponse> => {
  const res = await fetch(`${API_BASE}/api/user/groups/${groupId}/e2ee-keys`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const parsed = await parseResponseSafe(res);
  return parsed?.data || null;
};

const fetchGroupMembersWithKeys = async (groupId: string, token: string): Promise<GroupMemberKey[]> => {
  const res = await fetch(`${API_BASE}/api/user/groups/${groupId}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const parsed = await parseResponseSafe(res);
  return Array.isArray(parsed?.data) ? parsed.data : [];
};

const upsertGroupWrappedKeys = async (
  groupId: string,
  keys: Array<{ recipient_user_id: string; nonce: string; boxed_key: string }>,
  token: string,
) => {
  const res = await fetch(`${API_BASE}/api/user/groups/${groupId}/e2ee-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ keys }),
  });

  return parseResponseSafe(res);
};

export const ensureGroupKey = async (groupId: string, token: string): Promise<EnsureGroupKeyResult> => {
  const existing = getGroupKey(groupId);
  if (existing) return { status: "ready", key: existing };

  const identity = getOrCreateIdentityKeyPair();
  const publishResult = await ensurePublicKeyPublished(token);
  if (publishResult?.error) {
    return { status: "error", error: publishResult.error };
  }

  const wrappedKey = await fetchGroupWrappedKey(groupId, token);
  const unwrapped = unwrapGroupKey(wrappedKey, identity.secretKey);
  if (unwrapped) {
    setGroupKey(groupId, unwrapped);
    return { status: "ready", key: unwrapped };
  }

  const members = await fetchGroupMembersWithKeys(groupId, token);
  const missingUserIds = members
    .filter((member) => !member.e2ee_public_key)
    .map((member) => member.user_id);

  if (!members.length || missingUserIds.length) {
    return { status: "missing-keys", missingUserIds };
  }

  const groupKeyBytes = nacl.randomBytes(nacl.secretbox.keyLength);
  const groupKeyBase64 = encodeBase64(groupKeyBytes);

  const wrappedKeys = members.map((member) =>
    wrapGroupKeyForRecipient(groupKeyBase64, member.e2ee_public_key as string, identity.secretKey),
  );

  const payload = members.map((member, index) => ({
    recipient_user_id: member.user_id,
    nonce: wrappedKeys[index].nonce,
    boxed_key: wrappedKeys[index].boxed_key,
  }));

  const upsertResult = await upsertGroupWrappedKeys(groupId, payload, token);
  if (upsertResult?.error) {
    return { status: "error", error: upsertResult.error };
  }

  setGroupKey(groupId, groupKeyBase64);
  return { status: "ready", key: groupKeyBase64 };
};

export const encryptTextPayload = (text: string, groupKeyBase64: string): E2eeTextPayload => {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const keyBytes = decodeBase64(groupKeyBase64);
  const messageBytes = decodeUTF8(text);
  const ciphertext = nacl.secretbox(messageBytes, nonce, keyBytes);

  return {
    kind: "text",
    e2ee: {
      v: 1,
      alg: "nacl.secretbox",
      nonce: encodeBase64(nonce),
      ciphertext: encodeBase64(ciphertext),
    },
  };
};

export const resolveTextPayload = (
  payload: E2eeTextPayload | { kind: string; [key: string]: unknown },
  groupKeyBase64: string | null,
) => {
  if (!payload || payload.kind !== "text" || !("e2ee" in payload)) return payload;

  const e2eePayload = (payload as E2eeTextPayload).e2ee;
  if (!e2eePayload?.nonce || !e2eePayload?.ciphertext || !groupKeyBase64) {
    return { ...payload, text: "Encrypted message" };
  }

  try {
    const nonce = decodeBase64(e2eePayload.nonce);
    const ciphertext = decodeBase64(e2eePayload.ciphertext);
    const keyBytes = decodeBase64(groupKeyBase64);
    const opened = nacl.secretbox.open(ciphertext, nonce, keyBytes);
    if (!opened) return { ...payload, text: "Encrypted message" };
    return { ...payload, text: encodeUTF8(opened) };
  } catch {
    return { ...payload, text: "Encrypted message" };
  }
};

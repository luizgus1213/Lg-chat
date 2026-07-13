import { apiRequest } from "../../api/apiClient";
import {
  addedGroupMemberSchema,
  deleteGroupResultSchema,
  groupChatSchema,
  groupMembersSchema,
  leaveGroupResultSchema,
  removedGroupMemberSchema,
} from "./groups.schemas";

type RequestOptions = { signal?: AbortSignal };

export async function createGroup(
  input: { name: string; description?: string | null; memberIds: number[] },
  options: RequestOptions = {},
) {
  const response = await apiRequest<unknown>("/api/chats/groups", {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify(input),
  });
  return { ...response, data: groupChatSchema.parse(response.data) };
}

export async function getGroup(chatId: number, options: RequestOptions = {}) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}`, {
    method: "GET",
    signal: options.signal,
  });
  return { ...response, data: groupChatSchema.parse(response.data) };
}

export async function updateGroup(
  chatId: number,
  input: { name?: string; description?: string | null },
  options: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}`, {
    method: "PATCH",
    signal: options.signal,
    body: JSON.stringify(input),
  });
  return { ...response, data: groupChatSchema.parse(response.data) };
}

export async function uploadGroupAvatar(chatId: number, file: File, options: RequestOptions = {}) {
  const formData = new FormData();
  formData.set("avatar", file, file.name);
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/avatar`, {
    method: "POST",
    body: formData,
    signal: options.signal,
    timeoutMs: 60_000,
  });
  return { ...response, data: groupChatSchema.parse(response.data) };
}

export async function listGroupMembers(chatId: number, options: RequestOptions = {}) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/members`, {
    method: "GET",
    signal: options.signal,
  });
  return { ...response, data: groupMembersSchema.parse(response.data) };
}

export async function addGroupMember(chatId: number, userId: number, options: RequestOptions = {}) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/members`, {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify({ userId }),
  });
  return { ...response, data: addedGroupMemberSchema.parse(response.data) };
}

export async function removeGroupMember(chatId: number, userId: number, options: RequestOptions = {}) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/members/${userId}`, {
    method: "DELETE",
    signal: options.signal,
  });
  return { ...response, data: removedGroupMemberSchema.parse(response.data) };
}

export async function leaveGroup(chatId: number, options: RequestOptions = {}) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/leave`, {
    method: "POST",
    signal: options.signal,
  });
  return { ...response, data: leaveGroupResultSchema.parse(response.data) };
}

export async function deleteGroup(chatId: number, options: RequestOptions = {}) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}`, {
    method: "DELETE",
    signal: options.signal,
  });
  return { ...response, data: deleteGroupResultSchema.parse(response.data) };
}

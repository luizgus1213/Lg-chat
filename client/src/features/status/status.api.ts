import { z } from "zod";

import { ApiError, apiRequest, type ApiSuccess } from "../../api/apiClient";
import {
  createTextStatusInputSchema,
  deleteStatusResultSchema,
  myStatusGroupSchema,
  statusGroupsSchema,
  statusMediaInputSchema,
  statusPostSchema,
  statusViewedResultSchema,
  statusViewersSchema,
  type CreateTextStatusInput,
  type StatusGroup,
  type StatusMediaInput,
  type StatusPost,
  type StatusViewedResult,
  type StatusViewer,
} from "./status.schemas";

type RequestOptions = { signal?: AbortSignal };

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new ApiError({
    statusCode: 502,
    code: "INVALID_STATUS_RESPONSE",
    message: "O servidor retornou dados de status incompatíveis.",
    details: z.treeifyError(result.error),
  });
}

function parseStatusId(statusId: number) {
  return z.number().int().positive("Status inválido.").parse(statusId);
}

export async function listStatuses(
  options: RequestOptions = {},
): Promise<ApiSuccess<StatusGroup[]>> {
  const response = await apiRequest<unknown>("/api/status", {
    method: "GET",
    signal: options.signal,
  });

  return { ...response, data: parseResponse(statusGroupsSchema, response.data) };
}

export async function listMyStatuses(
  options: RequestOptions = {},
): Promise<ApiSuccess<StatusGroup | null>> {
  const response = await apiRequest<unknown>("/api/status/me", {
    method: "GET",
    signal: options.signal,
  });

  return { ...response, data: parseResponse(myStatusGroupSchema, response.data) };
}

export async function createTextStatus(
  input: CreateTextStatusInput,
  options: RequestOptions = {},
): Promise<ApiSuccess<StatusPost>> {
  const validInput = createTextStatusInputSchema.parse(input);
  const response = await apiRequest<unknown>("/api/status/text", {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify(validInput),
  });

  return { ...response, data: parseResponse(statusPostSchema, response.data) };
}

export async function createMediaStatus(
  input: StatusMediaInput,
  options: RequestOptions = {},
): Promise<ApiSuccess<StatusPost>> {
  const validInput = statusMediaInputSchema.parse(input);
  const form = new FormData();
  form.set("media", validInput.file);
  if (validInput.text) form.set("text", validInput.text);

  const response = await apiRequest<unknown>("/api/status/media", {
    method: "POST",
    signal: options.signal,
    timeoutMs: 90_000,
    body: form,
  });

  return { ...response, data: parseResponse(statusPostSchema, response.data) };
}

export async function markStatusViewed(
  statusId: number,
  options: RequestOptions = {},
): Promise<ApiSuccess<StatusViewedResult>> {
  const id = parseStatusId(statusId);
  const response = await apiRequest<unknown>(`/api/status/${id}/view`, {
    method: "POST",
    signal: options.signal,
  });

  return {
    ...response,
    data: parseResponse(statusViewedResultSchema, response.data),
  };
}

export async function listStatusViewers(
  statusId: number,
  options: RequestOptions = {},
): Promise<ApiSuccess<StatusViewer[]>> {
  const id = parseStatusId(statusId);
  const response = await apiRequest<unknown>(`/api/status/${id}/views`, {
    method: "GET",
    signal: options.signal,
  });

  return { ...response, data: parseResponse(statusViewersSchema, response.data) };
}

export async function deleteStatus(
  statusId: number,
  options: RequestOptions = {},
): Promise<ApiSuccess<{ deleted: true }>> {
  const id = parseStatusId(statusId);
  const response = await apiRequest<unknown>(`/api/status/${id}`, {
    method: "DELETE",
    signal: options.signal,
  });

  return {
    ...response,
    data: parseResponse(deleteStatusResultSchema, response.data),
  };
}

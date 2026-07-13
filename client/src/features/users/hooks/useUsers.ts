import { useCallback, useEffect, useRef, useState } from "react";

import { isRequestCancellation } from "../../auth/auth.errors";
import { useAuth } from "../../auth/useAuth";
import { listAvailableUsers } from "../users.api";
import { getUsersErrorMessage } from "../users.errors";
import type { ChatUser } from "../users.schemas";

type UsersStatus = "loading" | "refreshing" | "ready" | "error";

type UsersState = {
  ownerId: number | null;
  users: ChatUser[];
  status: UsersStatus;
  errorMessage: string | null;
};

export function useUsers() {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [state, setState] = useState<UsersState>({
    ownerId: currentUserId,
    users: [],
    status: "loading",
    errorMessage: null,
  });

  const mountedRef = useRef(true);
  const usersRef = useRef<ChatUser[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);

  const loadUsers = useCallback(async (preserveUsers: boolean) => {
    if (currentUserId === null) return;

    const ownerId = currentUserId;
    requestRef.current?.abort();

    const controller = new AbortController();
    const generation = ++requestGenerationRef.current;
    requestRef.current = controller;

    setState({
      ownerId,
      users: preserveUsers ? usersRef.current : [],
      status: preserveUsers ? "refreshing" : "loading",
      errorMessage: null,
    });

    try {
      const response = await listAvailableUsers({ signal: controller.signal });

      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        generation !== requestGenerationRef.current ||
        ownerId !== currentUserId
      ) {
        return;
      }

      usersRef.current = response.data;
      setState({
        ownerId,
        users: response.data,
        status: "ready",
        errorMessage: null,
      });
    } catch (error: unknown) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        generation !== requestGenerationRef.current ||
        ownerId !== currentUserId ||
        isRequestCancellation(error)
      ) {
        return;
      }

      const retainedUsers = preserveUsers ? usersRef.current : [];
      setState({
        ownerId,
        users: retainedUsers,
        status: retainedUsers.length > 0 ? "ready" : "error",
        errorMessage: getUsersErrorMessage(error),
      });
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }, [currentUserId]);

  const refresh = useCallback(async () => {
    if (requestRef.current) return;
    await loadUsers(usersRef.current.length > 0);
  }, [loadUsers]);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    requestRef.current?.abort();
    requestGenerationRef.current += 1;
    usersRef.current = [];

    if (currentUserId !== null) {
      queueMicrotask(() => {
        if (active) void loadUsers(false);
      });
    }

    return () => {
      active = false;
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [currentUserId, loadUsers]);

  if (state.ownerId !== currentUserId) {
    return {
      users: [],
      status: "loading" as const,
      errorMessage: null,
      refresh,
    };
  }

  return {
    users: state.users,
    status: state.status,
    errorMessage: state.errorMessage,
    refresh,
  };
}

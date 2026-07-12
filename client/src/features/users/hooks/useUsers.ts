import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../../../api/apiClient";
import { getAuthErrorMessage } from "../../auth/auth.errors";
import { listAvailableUsers } from "../users.api";
import type { ChatUser } from "../users.schemas";

type UsersStatus = "loading" | "ready" | "error";

function isCancellation(error: unknown) {
  return error instanceof ApiError && error.code === "REQUEST_CANCELLED";
}

export function useUsers() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [status, setStatus] = useState<UsersStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await listAvailableUsers();
      setUsers(response.data);
      setStatus("ready");
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void listAvailableUsers({ signal: controller.signal })
      .then((response) => {
        if (!active) return;

        setUsers(response.data);
        setErrorMessage(null);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active || isCancellation(error)) return;

        setErrorMessage(getAuthErrorMessage(error));
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return { users, status, errorMessage, refresh };
}

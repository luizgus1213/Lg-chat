import { useCallback, useEffect, useState } from "react";

import { getAuthErrorMessage } from "../../auth/auth.errors";
import { listAvailableUsers } from "../users.api";

import type { ChatUser } from "../users.schemas";

type UsersStatus = "loading" | "ready" | "error";

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
    let cancelled = false;

    void listAvailableUsers()
      .then((response) => {
        if (cancelled) return;

        setUsers(response.data);
        setErrorMessage(null);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setErrorMessage(getAuthErrorMessage(error));

        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    users,
    status,
    errorMessage,
    refresh,
  };
}

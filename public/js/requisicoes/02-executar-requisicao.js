async function executeRequest(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const isFormData = options.body instanceof FormData;
    const timeoutMs = Number(
      options.timeoutMs ||
        (method === "GET" ? DEFAULT_GET_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
    );

    let lastError = null;

    for (let attempt = 0; attempt <= Number(options.retries ?? MAX_GET_RETRIES); attempt += 1) {
      const timeout = createTimeoutController(timeoutMs, options.signal);

      const headers = {
        Accept: "application/json",
        Authorization: state.token ? `Bearer ${state.token}` : "",
        ...(options.headers || {}),
      };

      if (!isFormData) {
        headers["Content-Type"] = "application/json";
      }

      try {
        const response = await fetch(path, {
          ...options,
          method,
          headers,
          signal: timeout.controller.signal,
        });

        const data = await parseResponse(response);

        if (!response.ok || data?.success === false) {
          const error = new Error(getErrorMessage(data));
          error.statusCode = response.status;
          error.data = data;
          throw error;
        }

        return data;
      } catch (error) {
        lastError = error;

        if (isAbortError(error)) {
          throw new Error("A requisição demorou demais. Verifique sua internet e tente novamente.");
        }

        if (!canRetry(method, attempt, options)) {
          if (!navigator.onLine) {
            throw new Error("Você está offline. Verifique sua conexão.");
          }

          console.error("Erro de conexão com a API:", error);
          throw error instanceof Error ? error : new Error("Não foi possível conectar ao servidor.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
      } finally {
        timeout.clear();
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Erro na requisição.");
  }

async function request(path, options = {}) {
    const dedupeKey = makeDedupeKey(path, options);

    if (dedupeKey && inflightGetRequests.has(dedupeKey)) {
      return inflightGetRequests.get(dedupeKey);
    }

    const promise = executeRequest(path, options);

    if (dedupeKey) {
      inflightGetRequests.set(dedupeKey, promise);
      promise.finally(() => {
        inflightGetRequests.delete(dedupeKey);
      });
    }

    return promise;
  }

window.LGChat.api = {
    request,
    getErrorMessage,
  };

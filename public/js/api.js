(() => {
  const state = window.LGChat.state;

  function getErrorMessage(data, fallback = "Erro na requisição.") {
    if (data && data.error && Array.isArray(data.error.fields)) {
      return data.error.fields
        .map((field) => `${field.path}: ${field.message}`)
        .join(" | ");
    }

    if (data && data.error && data.error.message) {
      return data.error.message;
    }

    if (data && data.message) {
      return data.message;
    }

    return fallback;
  }

  async function request(path, options = {}) {
    let response;

    const isFormData = options.body instanceof FormData;

    const headers = {
      Authorization: state.token ? `Bearer ${state.token}` : "",
      ...(options.headers || {}),
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    try {
      response = await fetch(path, {
        ...options,
        headers,
      });
    } catch (error) {
      console.error("Erro de conexão com a API:", error);
      throw new Error("Não foi possível conectar ao servidor.");
    }

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.success === false) {
      throw new Error(getErrorMessage(data));
    }

    return data;
  }

  window.LGChat.api = {
    request,
    getErrorMessage,
  };
})();

(() => {
  window.LGChat = window.LGChat || {};

  const PARTIAL_CACHE_VERSION = "partials-responsivo-v10";

  const appPartials = [
    { target: "authRoot", path: "features/auth/auth.html" },
    { target: "sidebarRoot", path: "features/sidebar/sidebar.html" },
    { target: "chatMainRoot", path: "features/chat-main/chat-main.html" },
    { target: "infoPanelRoot", path: "features/info-panel/info-panel.html" },
    { target: "usersPanelRoot", path: "features/users-panel/users-panel.html" },
    { target: "groupPanelRoot", path: "features/group-panel/group-panel.html" },
    {
      target: "globalInputsRoot",
      path: "features/global-inputs/global-inputs.html",
    },
    { target: "toastRoot", path: "features/toast/toast.html" },
  ];

  const lazyPartials = {
    statusPanel: {
      target: "statusPanelRoot",
      path: "features/status-panel/status-panel.html",
    },
  };

  const partialPromises = new Map();

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getCacheKey(path) {
    return `lgchat:partial:${PARTIAL_CACHE_VERSION}:${path}`;
  }

  function readPartialFromCache(path) {
    try {
      return sessionStorage.getItem(getCacheKey(path));
    } catch (_error) {
      return null;
    }
  }

  function writePartialToCache(path, html) {
    try {
      if (html && html.length < 120_000) {
        sessionStorage.setItem(getCacheKey(path), html);
      }
    } catch (_error) {
      // Cache opcional.
    }
  }

  async function fetchPartialFromServer(path) {
    const url = `${path}?v=${PARTIAL_CACHE_VERSION}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Erro ao carregar ${path}. Status HTTP: ${response.status}`,
      );
    }

    return response.text();
  }

  async function fetchPartial(path) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const html = await fetchPartialFromServer(path);

        writePartialToCache(path, html);

        return html;
      } catch (error) {
        lastError = error;

        const message =
          error instanceof Error ? error.message : "Erro desconhecido";

        console.warn(
          `[LG Chat] Falha ao carregar partial ${path}. Tentativa ${attempt}/3.`,
          message,
        );

        if (attempt < 3) {
          await wait(500 * attempt);
        }
      }
    }

    const cached = readPartialFromCache(path);

    if (cached) {
      console.warn(`[LG Chat] Usando partial em cache: ${path}`);
      return cached;
    }

    throw lastError || new Error(`Erro ao carregar ${path}`);
  }

  async function loadPartial(partial) {
    const target = document.getElementById(partial.target);

    if (!target) {
      throw new Error(`Elemento não encontrado: ${partial.target}`);
    }

    if (
      target.dataset.partialLoaded === partial.path &&
      target.innerHTML.trim()
    ) {
      return target;
    }

    const key = `${partial.target}:${partial.path}`;

    if (partialPromises.has(key)) {
      return partialPromises.get(key);
    }

    const promise = fetchPartial(partial.path)
      .then((html) => {
        target.innerHTML = html;
        target.dataset.partialLoaded = partial.path;
        return target;
      })
      .finally(() => {
        partialPromises.delete(key);
      });

    partialPromises.set(key, promise);

    return promise;
  }

  async function loadPartials() {
    const results = await Promise.allSettled(appPartials.map(loadPartial));

    const failed = results
      .map((result, index) => ({
        result,
        partial: appPartials[index],
      }))
      .filter((item) => item.result.status === "rejected");

    if (failed.length > 0) {
      console.error(
        "[LG Chat] Partials que falharam:",
        failed.map((item) => item.partial.path),
      );

      throw new Error(
        `Falha ao carregar interface: ${failed
          .map((item) => item.partial.path)
          .join(", ")}`,
      );
    }
  }

  async function loadStatusPanelPartial() {
    return loadPartial(lazyPartials.statusPanel);
  }

  window.LGChat.loadPartial = loadPartial;
  window.LGChat.loadPartials = loadPartials;
  window.LGChat.loadStatusPanelPartial = loadStatusPanelPartial;
})();

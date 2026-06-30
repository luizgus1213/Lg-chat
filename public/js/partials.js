(() => {
  window.LGChat = window.LGChat || {};

  const PARTIAL_CACHE_VERSION = "visual-call-fix-v1";

  const appPartials = [
    { target: "authRoot", path: "features/auth/auth.html" },
    { target: "sidebarRoot", path: "features/sidebar/sidebar.html" },
    { target: "chatMainRoot", path: "features/chat-main/chat-main.html" },
    { target: "infoPanelRoot", path: "features/info-panel/info-panel.html" },
    { target: "usersPanelRoot", path: "features/users-panel/users-panel.html" },
    { target: "groupPanelRoot", path: "features/group-panel/group-panel.html" },
    { target: "globalInputsRoot", path: "features/global-inputs/global-inputs.html" },
    { target: "toastRoot", path: "features/toast/toast.html" },
  ];

  const lazyPartials = {
    statusPanel: { target: "statusPanelRoot", path: "features/status-panel/status-panel.html" },
  };

  const partialPromises = new Map();

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
      // Cache em sessionStorage é opcional.
    }
  }

  async function fetchPartial(path) {
    const cached = readPartialFromCache(path);

    if (cached) {
      return cached;
    }

    const response = await fetch(path, { cache: "force-cache" });

    if (!response.ok) {
      throw new Error(`Erro ao carregar ${path}`);
    }

    const html = await response.text();

    writePartialToCache(path, html);

    return html;
  }

  async function loadPartial(partial) {
    const target = document.getElementById(partial.target);

    if (!target) {
      throw new Error(`Elemento não encontrado: ${partial.target}`);
    }

    if (target.dataset.partialLoaded === partial.path && target.innerHTML.trim()) {
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
    await Promise.all(appPartials.map(loadPartial));
  }

  async function loadStatusPanelPartial() {
    return loadPartial(lazyPartials.statusPanel);
  }

  window.LGChat.loadPartial = loadPartial;
  window.LGChat.loadPartials = loadPartials;
  window.LGChat.loadStatusPanelPartial = loadStatusPanelPartial;
})();

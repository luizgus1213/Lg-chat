(() => {
  window.LGChat = window.LGChat || {};

  const prefetched = new Set();

  function canPrefetch() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (connection && connection.saveData) return false;
    if (connection && ["slow-2g", "2g"].includes(connection.effectiveType)) return false;

    return true;
  }

  function prefetchAsset(url, as = "script") {
    if (!canPrefetch()) return;
    if (prefetched.has(url)) return;

    prefetched.add(url);

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    link.as = as;
    link.crossOrigin = "anonymous";

    document.head.appendChild(link);
  }

  function preloadStyle(url) {
    if (!canPrefetch()) return;
    if (prefetched.has(`style:${url}`)) return;

    prefetched.add(`style:${url}`);

    const link = document.createElement("link");
    link.rel = "preload";
    link.href = url;
    link.as = "style";
    link.onload = () => {
      link.rel = "stylesheet";
    };

    document.head.appendChild(link);
  }

  function onIntent(selector, callback) {
    const bind = () => {
      const element = document.querySelector(selector);

      if (!element || element.dataset.prefetchBound === "true") return;

      element.dataset.prefetchBound = "true";

      ["pointerenter", "focus", "touchstart"].forEach((eventName) => {
        element.addEventListener(eventName, callback, {
          once: true,
          passive: true,
        });
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bind, { once: true });
    } else {
      bind();
    }

    const observer = new MutationObserver(bind);

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.setTimeout(() => observer.disconnect(), 20_000);
  }

  function runWhenIdle(callback, timeout = 2200) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout });
      return;
    }

    window.setTimeout(callback, Math.min(timeout, 900));
  }

  function bindIntentPrefetch() {
    onIntent("#openStatusPanelButton", () => {
      preloadStyle("features/status-panel/status-panel.css");
      prefetchAsset("features/status-panel/status-panel.html", "fetch");
      prefetchAsset("js/status.js", "script");
    });

    onIntent("#openUsersButton", () => {
      preloadStyle("features/users-panel/users-panel.css");
      prefetchAsset("features/users-panel/users-panel.html", "fetch");
    });

    onIntent("#openGroupButton", () => {
      preloadStyle("features/group-panel/group-panel.css");
      prefetchAsset("features/group-panel/group-panel.html", "fetch");
    });

    onIntent("#chatHeaderProfileButton", () => {
      preloadStyle("features/info-panel/info-panel.css");
      prefetchAsset("features/info-panel/info-panel.html", "fetch");
    });

    onIntent("#startVoiceCallButton", () => {
      prefetchAsset("js/call.js", "script");
    });

    onIntent("#startVideoCallButton", () => {
      prefetchAsset("js/call.js", "script");
    });
  }

  function prefetchIdleAssets() {
    runWhenIdle(() => {
      if (document.visibilityState !== "visible") return;

      prefetchAsset("js/pwa.js", "script");

      if (window.matchMedia && window.matchMedia("(min-width: 821px)").matches) {
        prefetchAsset("features/info-panel/info-panel.html", "fetch");
      }
    });
  }

  bindIntentPrefetch();
  prefetchIdleAssets();

  window.LGChat.prefetch = {
    prefetchAsset,
    preloadStyle,
  };
})();

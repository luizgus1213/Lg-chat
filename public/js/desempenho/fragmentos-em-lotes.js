function appendFragmentInChunks(target, nodes, options = {}) {
    const chunkSize = Number(options.chunkSize || 18);
    const mode = options.mode === "prepend" ? "prepend" : "append";

    return new Promise((resolve) => {
      let index = 0;

      function runChunk() {
        const fragment = document.createDocumentFragment();
        const end = Math.min(index + chunkSize, nodes.length);

        while (index < end) {
          fragment.appendChild(nodes[index]);
          index += 1;
        }

        if (mode === "prepend") {
          target.prepend(fragment);
        } else {
          target.appendChild(fragment);
        }

        if (index >= nodes.length) {
          resolve();
          return;
        }

        window.requestAnimationFrame(runChunk);
      }

      runChunk();
    });
  }

function observeVideosForPerformance() {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target;

        if (!(video instanceof HTMLVideoElement)) continue;

        if (!entry.isIntersecting && !video.paused) {
          video.pause();
        }

        if (!entry.isIntersecting) {
          video.preload = "metadata";
        }
      }
    }, {
      rootMargin: "160px",
      threshold: 0.05,
    });

    const bindVideo = (video) => {
      if (!(video instanceof HTMLVideoElement)) return;
      if (video.dataset.performanceVideoObserved === "true") return;

      video.dataset.performanceVideoObserved = "true";
      observer.observe(video);
    };

    document.querySelectorAll("video").forEach(bindVideo);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            bindVideo(node);
            return;
          }

          if (node instanceof HTMLElement) {
            node.querySelectorAll("video").forEach(bindVideo);
          }
        });
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

function cleanupOldLocalCaches() {
    try {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;

      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);

        if (!key || !key.startsWith("lgchat:")) continue;

        const raw = localStorage.getItem(key);

        if (!raw) continue;

        const parsed = JSON.parse(raw);

        if (parsed && parsed.savedAt && now - Number(parsed.savedAt) > maxAge) {
          localStorage.removeItem(key);
        }
      }
    } catch (_error) {
      // Limpeza de cache local é opcional.
    }
  }

function bindVisibleRefresh() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;

      if (window.LGChat.performance && typeof window.LGChat.performance.scheduleLoadChats === "function") {
        window.LGChat.performance.scheduleLoadChats("visible", 500).catch((error) => {
          console.error("Erro ao atualizar chats ao voltar para aba:", error);
        });
      }
    });
  }

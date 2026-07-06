window.LGChat = window.LGChat || {};

const scriptPromises = new Map();

const stylePromises = new Map();

function runWhenIdle(callback, timeout = 1100) {
    const perf = window.LGChat.performance;

    if (perf && typeof perf.runWhenIdle === "function") {
      perf.runWhenIdle(callback, timeout);
      return;
    }

    window.setTimeout(callback, 1);
  }

function loadScriptOnce(src) {
    if (scriptPromises.has(src)) {
      return scriptPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-lazy-src="${src}"]`);

      if (existing && existing.dataset.loaded === "true") {
        resolve(existing);
        return;
      }

      const script = existing || document.createElement("script");

      script.src = src;
      script.defer = true;
      script.dataset.lazySrc = src;

      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve(script);
      }, { once: true });

      script.addEventListener("error", () => {
        reject(new Error(`Erro ao carregar ${src}`));
      }, { once: true });

      if (!existing) {
        document.body.appendChild(script);
      }
    });

    scriptPromises.set(src, promise);

    return promise;
  }

function loadStyleOnce(href) {
    if (stylePromises.has(href)) {
      return stylePromises.get(href);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${href}"]`);

      if (existing) {
        resolve(existing);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;

      link.addEventListener("load", () => resolve(link), { once: true });
      link.addEventListener("error", () => reject(new Error(`Erro ao carregar ${href}`)), {
        once: true,
      });

      document.head.appendChild(link);
    });

    stylePromises.set(href, promise);

    return promise;
  }

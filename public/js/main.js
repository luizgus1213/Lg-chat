(() => {
  "use strict";

  const VERSAO = "principal-modular-portugues-v1";
  const MODULOS = [
    "01-estado-e-dependencias.js",
    "02-eventos-interface-parte-1.js",
    "03-eventos-interface-parte-2.js",
    "04-eventos-interface-parte-3.js",
    "05-eventos-interface-parte-4.js",
    "06-document-addeventlistener-domcontentload.js"
  ];

  function mostrarErroDeCarregamento(erro) {
    console.error("[LG Chat] Erro ao carregar módulos principais", erro);

    const ui = window.LGChat && window.LGChat.ui;
    if (ui && typeof ui.showToast === "function") {
      ui.showToast("error", "Não foi possível carregar módulos principais. Atualize a página.");
    }
  }

  function carregarModulo(nomeDoArquivo) {
    const requisicao = new XMLHttpRequest();
    const caminho = `/js/principal/${nomeDoArquivo}?v=${VERSAO}`;

    requisicao.open("GET", caminho, false);
    requisicao.send(null);

    if (requisicao.status < 200 || requisicao.status >= 300) {
      throw new Error(`Falha ao carregar ${caminho}: HTTP ${requisicao.status}`);
    }

    return `\n/* ${nomeDoArquivo} */\n${requisicao.responseText}`;
  }

  try {
    const codigoCompleto =
      MODULOS.map(carregarModulo).join("\n") +
      "\n//# sourceURL=lgchat-principal.js";

    Function(codigoCompleto)();
  } catch (erro) {
    mostrarErroDeCarregamento(erro);
  }
})();

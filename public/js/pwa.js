(() => {
  "use strict";

  const VERSAO = "app-instalavel-sem-numeros-v1";
  const MODULOS = [
    "estado-global.js",
    "som-notificacao.js",
    "sincronizar-interface.js",
    "service-worker.js"
  ];

  function mostrarErroDeCarregamento(erro) {
    console.error("[LG Chat] Erro ao carregar módulos de app instalável", erro);

    const ui = window.LGChat && window.LGChat.ui;
    if (ui && typeof ui.showToast === "function") {
      ui.showToast("error", "Não foi possível carregar app instalável. Atualize a página.");
    }
  }

  function carregarModulo(nomeDoArquivo) {
    const requisicao = new XMLHttpRequest();
    const caminho = `/js/app-instalavel/${nomeDoArquivo}?v=${VERSAO}`;

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
      "\n//# sourceURL=lgchat-app-instalavel.js";

    Function(codigoCompleto)();
  } catch (erro) {
    mostrarErroDeCarregamento(erro);
  }
})();

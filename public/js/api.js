(() => {
  "use strict";

  const VERSAO = "requisicoes-modular-portugues-v1";
  const MODULOS = [
    "01-estado-api.js",
    "02-executar-requisicao.js"
  ];

  function mostrarErroDeCarregamento(erro) {
    console.error("[LG Chat] Erro ao carregar módulos de requisições", erro);

    const ui = window.LGChat && window.LGChat.ui;
    if (ui && typeof ui.showToast === "function") {
      ui.showToast("error", "Não foi possível carregar módulos de requisições. Atualize a página.");
    }
  }

  function carregarModulo(nomeDoArquivo) {
    const requisicao = new XMLHttpRequest();
    const caminho = `/js/requisicoes/${nomeDoArquivo}?v=${VERSAO}`;

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
      "\n//# sourceURL=lgchat-requisicoes.js";

    Function(codigoCompleto)();
  } catch (erro) {
    mostrarErroDeCarregamento(erro);
  }
})();

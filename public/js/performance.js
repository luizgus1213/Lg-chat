(() => {
  "use strict";

  const VERSAO = "desempenho-sem-numeros";
  const MODULOS = [
    "estado-global.js",
    "observar-midia-preguicosa.js",
    "fragmentos-em-lotes.js",
    "iniciar-desempenho.js"
  ];

  function mostrarErroDeCarregamento(erro) {
    console.error("[LG Chat] Erro ao carregar módulos de desempenho", erro);

    const ui = window.LGChat && window.LGChat.ui;
    if (ui && typeof ui.showToast === "function") {
      ui.showToast("error", "Não foi possível carregar desempenho. Atualize a página.");
    }
  }

  function carregarModulo(nomeDoArquivo) {
    const requisicao = new XMLHttpRequest();
    const caminho = `/js/desempenho/${nomeDoArquivo}?v=${VERSAO}`;

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
      "\n//# sourceURL=lgchat-desempenho.js";

    Function(codigoCompleto)();
  } catch (erro) {
    mostrarErroDeCarregamento(erro);
  }
})();

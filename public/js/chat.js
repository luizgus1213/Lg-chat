(() => {
  "use strict";

  /*
    LG Chat - loader modular da pasta public/js/conversa
    Use este arquivo quando quiser manter os 41 arquivos separados.
  */

  const VERSAO_DA_CONVERSA = "conversa-corrigida-v2";

  const MODULOS_DA_CONVERSA = [
    "01-estado-e-atualizacao.js",
    "02-status-usuario-e-avatares.js",
    "03-arquivos-permitidos-e-validacao.js",
    "04-anexos-preview-lista.js",
    "05-bloqueio-e-privacidade.js",
    "06-menu-opcoes-conversa-parte-1.js",
    "07-menu-opcoes-conversa-parte-2.js",
    "08-status-mensagem-e-leitura.js",
    "09-resposta-estado-inicial.js",
    "10-menu-acoes-mensagem.js",
    "11-barra-edicao-resposta.js",
    "12-busca-conversa.js",
    "13-resultado-busca.js",
    "14-favoritas-e-escolha-encaminhar.js",
    "15-encaminhar-mensagem.js",
    "16-previa-resposta-e-reacoes.js",
    "17-editar-apagar-mensagem.js",
    "18-visualizador-midia.js",
    "19-preview-midia-envio.js",
    "20-audio-utilitarios.js",
    "21-gravador-audio.js",
    "22-cache-mensagens-inicial.js",
    "23-cache-mensagens-ordenacao.js",
    "24-mensagens-antigas-e-renderizacao.js",
    "25-cache-local-conversas.js",
    "26-carregar-conversas.js",
    "27-renderizar-lista-conversas-parte-1.js",
    "28-renderizar-lista-conversas-parte-2.js",
    "29-abrir-conversa.js",
    "30-informacoes-conversa-parte-1.js",
    "31-informacoes-conversa-parte-2.js",
    "32-informacoes-conversa-parte-3.js",
    "33-grupo-acoes-membros.js",
    "34-montar-mensagem-parte-1.js",
    "35-montar-mensagem-parte-2.js",
    "36-montar-mensagem-parte-3.js",
    "37-adicionar-mensagem-e-usuario.js",
    "38-usuarios-e-grupo.js",
    "39-enviar-mensagem.js",
    "40-enviar-midia-digitacao-avatar.js",
    "41-status-usuario-api-final.js",
  ];

  function mostrarErroDeCarregamento(erro) {
    console.error("[LG Chat] Erro ao carregar módulos da conversa:", erro);

    const ui = window.LGChat && window.LGChat.ui;

    if (ui && typeof ui.showToast === "function") {
      ui.showToast(
        "error",
        "Não foi possível carregar a conversa. Atualize a página.",
      );
    }
  }

  function carregarModulo(nomeDoArquivo) {
    const requisicao = new XMLHttpRequest();
    const caminho = `/js/conversa/${nomeDoArquivo}?v=${VERSAO_DA_CONVERSA}`;

    requisicao.open("GET", caminho, false);
    requisicao.send(null);

    if (requisicao.status < 200 || requisicao.status >= 300) {
      throw new Error(`Falha ao carregar ${caminho}: HTTP ${requisicao.status}`);
    }

    return `\n/* public/js/conversa/${nomeDoArquivo} */\n${requisicao.responseText}`;
  }

  try {
    if (!window.LGChat) {
      throw new Error("window.LGChat não foi inicializado antes do chat.js.");
    }

    if (!window.LGChat.state || !window.LGChat.api || !window.LGChat.ui) {
      throw new Error("state, api ou ui não foram carregados antes do chat.js.");
    }

    const codigoCompleto =
      MODULOS_DA_CONVERSA.map(carregarModulo).join("\n") +
      "\n//# sourceURL=lgchat-conversa-corrigida.js";

    Function(codigoCompleto)();
  } catch (erro) {
    mostrarErroDeCarregamento(erro);
  }
})();

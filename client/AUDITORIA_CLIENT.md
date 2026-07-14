# Auditoria do cliente LG Chat

Data da revisão: 13 de julho de 2026.

## Resultado executivo

O frontend React/TypeScript em `client` é a aplicação oficial de produção. O servidor entrega `client/dist`, mantém somente `/uploads` apontando para arquivos gerados pelo backend e não publica o frontend legado de `public`. Rotas React recebem fallback de SPA; `/api`, `/socket.io`, `/uploads`, `/health` e nomes com extensão nunca são capturados pelo fallback.

A autenticação foi migrada para cookie de sessão `HttpOnly`, `Secure` em produção e `SameSite` configurável. O cliente não recebe nem persiste JWT. Mutações autenticadas usam double-submit CSRF; Socket.IO autentica pelo cookie da mesma sessão. O backend continua sendo a autoridade para associação ao chat, bloqueios, permissões de grupo, propriedade de mensagens, limites e assinatura real dos uploads.

## Funcionalidades existentes e verificadas

- Cadastro, login, confirmação e reenvio de código de e-mail, restauração de sessão e logout.
- Conversas privadas e grupos, incluindo criação, alteração, avatar, membros, saída e exclusão de grupo.
- Preferências de conversa: fixar, arquivar, silenciar, bloquear, limpar e excluir para mim.
- Mensagens de texto e mídia, resposta, edição, exclusão, reação, favorita e encaminhamento.
- Histórico paginado por cursor, preservação de scroll e busca com contexto real ao redor da mensagem.
- Envio otimista com reconciliação de ACK/broadcast e retry idempotente pelo mesmo `clientId`.
- Indicadores reais `enviando`, `enviada` e `lida`; leitura é confirmada apenas com a página visível, focada e no final.
- Lista global paginada de favoritas em uma consulta agregada, sem N+1 por conversa.
- Diretório de usuários paginado e busca backend com debounce e cancelamento.
- Presença, “visto por último”, digitação, atualizações e chamadas em tempo real por Socket.IO, sem polling periódico.
- Status de texto/imagem/vídeo, visualização, contagem de visualizadores e exclusão.
- Chamadas de voz/vídeo WebRTC, com STUN e endpoint autenticado para credenciais TURN temporárias.
- Gravador de áudio com permissão, duração, pausa/retomada quando suportada, cancelamento, prévia e cleanup de tracks/ObjectURL.
- Visualizador interno acessível de imagem/vídeo com zoom, loading, erro, abrir e baixar.
- Notificações do sistema enquanto a página está aberta.
- PWA com manifest, instalação, atualização de service worker e cache exclusivo do app shell/assets públicos.
- Erros globais: boundary React, `window.error`, `unhandledrejection`, toast recuperável, erro do SocketProvider e diagnóstico sanitizado com deduplicação/rate limit local.

## Funcionalidades deliberadamente não simuladas

- **Entrega ao dispositivo:** não existe recibo persistido de entrega no protocolo atual. A interface mostra somente `sent` após persistência no servidor e `read` após confirmação real de leitura pelos demais participantes. Não é exibido um estado “entregue” inventado.
- **Push com o aplicativo fechado:** requer VAPID, assinatura por dispositivo, persistência e um worker de envio no backend. Apenas notificações com a página aberta permanecem ativas.
- **TURN operacional:** o código está pronto para coturn/serviço compatível com TURN REST, mas chamadas entre NATs restritivos dependem de `TURN_URLS` e `TURN_SHARED_SECRET` configurados na infraestrutura. Sem isso, o endpoint informa `hasTurn: false` e fornece STUN.
- **Offline de dados privados:** mensagens, respostas autenticadas, tokens, uploads e mídia não entram no cache do service worker. A tela pode abrir pelo app shell, mas conteúdo privado exige rede e sessão válida.
- **E2E em navegador real:** a suíte adicionada cobre integração React, HTTP com MSW, stores e adaptadores. Playwright continua recomendado em um ambiente de CI com PostgreSQL, câmera/microfone virtuais e dois contextos autenticados.

## Rotas HTTP consumidas pelo React

| Área         | Método e rota                                           | Uso                            |
| ------------ | ------------------------------------------------------- | ------------------------------ |
| Auth         | `POST /api/auth/register`                               | Cadastro                       |
| Auth         | `POST /api/auth/login`                                  | Cria cookies de sessão/CSRF    |
| Auth         | `POST /api/auth/verify-email`                           | Confirma e cria sessão         |
| Auth         | `POST /api/auth/resend-verification`                    | Reenvia código                 |
| Auth         | `GET /api/auth/me`                                      | Restaura sessão e garante CSRF |
| Auth         | `POST /api/auth/logout`                                 | Revoga cookies no navegador    |
| Usuários     | `GET /api/users/directory?q=&page=&limit=`              | Busca paginada                 |
| Usuários     | `PATCH /api/users/me`                                   | Perfil                         |
| Usuários     | `POST /api/users/me/avatar`                             | Avatar                         |
| Chats        | `GET /api/chats`                                        | Snapshot de conversas          |
| Chats        | `POST /api/chats/private`                               | Conversa privada               |
| Chats        | `POST /api/chats/groups`                                | Grupo                          |
| Chats        | `GET/PATCH/DELETE /api/chats/:chatId`                   | Detalhe/administração          |
| Chats        | `POST /api/chats/:chatId/leave`                         | Sair do grupo                  |
| Chats        | `GET/POST /api/chats/:chatId/members`                   | Listar/adicionar membros       |
| Chats        | `DELETE /api/chats/:chatId/members/:userId`             | Remover membro                 |
| Chats        | `POST /api/chats/:chatId/avatar`                        | Avatar do grupo                |
| Preferências | `PATCH /api/chats/:chatId/preferences`                  | Fixar/arquivar/silenciar       |
| Preferências | `PATCH /api/chats/:chatId/block`                        | Bloqueio                       |
| Preferências | `POST /api/chats/:chatId/clear`                         | Limpar para mim                |
| Preferências | `POST /api/chats/:chatId/delete-for-me`                 | Excluir para mim               |
| Mensagens    | `GET/POST /api/chats/:chatId/messages`                  | Paginação/envio HTTP           |
| Mensagens    | `GET /api/chats/:chatId/messages/search`                | Busca                          |
| Mensagens    | `GET /api/chats/:chatId/messages/:messageId/context`    | Contexto da busca              |
| Mensagens    | `PATCH/DELETE /api/chats/:chatId/messages/:messageId`   | Editar/excluir                 |
| Mensagens    | `POST /api/chats/:chatId/messages/:messageId/reactions` | Reação                         |
| Mensagens    | `POST /api/chats/:chatId/messages/:messageId/star`      | Favorita                       |
| Mensagens    | `POST /api/chats/:chatId/messages/:messageId/forward`   | Encaminhar                     |
| Mensagens    | `POST /api/chats/:chatId/media`                         | Upload de mídia                |
| Mensagens    | `POST /api/chats/:chatId/read`                          | Confirmação de leitura         |
| Favoritas    | `GET /api/chats/messages/starred?beforeId=&limit=`      | Agregado paginado              |
| Status       | `GET /api/status` e `GET /api/status/me`                | Listagens                      |
| Status       | `POST /api/status/text` e `POST /api/status/media`      | Publicação                     |
| Status       | `POST /api/status/:statusId/view`                       | Visualização                   |
| Status       | `GET /api/status/:statusId/views`                       | Visualizadores                 |
| Status       | `DELETE /api/status/:statusId`                          | Exclusão                       |
| Chamadas     | `GET /api/calls/ice-servers`                            | STUN/TURN efêmero              |
| Diagnóstico  | `POST /api/diagnostics/client-error`                    | Erro sanitizado                |

`GET /api/users` e `GET /api/messages/:userId` foram preservados para compatibilidade do backend, mas não são usados pelo React oficial.

## Eventos Socket.IO

### Enviados pelo cliente

- `join_chat`
- `chat_message` com ACK validado e `clientId`
- `typing_start`, `typing_stop`
- `call:start`, `call:accept`, `call:reject`, `call:end`, `call:signal`

### Recebidos pelo cliente

- `chat_message`, `chat_message_updated`, `chat_updated`, `chat_read`
- `user_status`, `typing_start`, `typing_stop`
- `call:incoming`, `call:accepted`, `call:rejected`, `call:ended`, `call:signal`
- `server_error`, além de `connect`, `disconnect` e erros de reconexão do transporte

Payloads e ACKs de mensagem/chamada são validados com Zod. Eventos desconhecidos ou inválidos não são aplicados ao estado.

## Contratos compartilhados e alterações de contrato

`src/shared/publicContracts.ts` é importado pelo backend e pelo Vite por alias `@shared`. Ele contém somente dados públicos:

- limites de upload por categoria;
- MIME types aceitos para chat;
- códigos que comprovam sessão inválida;
- nomes canônicos dos eventos Socket.IO.

Alterações coordenadas:

- Login/verificação retornam `{ user }`; JWT deixou de fazer parte da resposta pública.
- Autenticação HTTP e Socket.IO usa cookie; `Authorization: Bearer` e token de handshake foram removidos.
- Mensagem recebeu `clientId` persistido e `deliveryStatus: "sent" | "read"`.
- Novo evento `chat_read` atualiza leitura real.
- Foram adicionados contexto de mensagem, favoritas agregadas, diretório paginado e configuração ICE.
- Participantes de chamada e autores/visualizadores de status deixaram de expor e-mail desnecessário.

## Segurança

### Riscos corrigidos

- JWT removido de `localStorage`; chaves antigas são somente apagadas na migração local.
- Cookies com `HttpOnly`, `Secure` em produção, `SameSite`, expiração e remoção coordenada.
- CSRF double-submit e comparação em tempo constante nas mutações autenticadas.
- CSP ativa, `frame-ancestors 'none'`, `object-src 'none'`, HSTS em produção, referrer policy e `nosniff`.
- CORS com allowlist e credenciais; nenhum curinga para origens.
- URLs de mídia aceitas no cliente somente na origem atual e sob `/uploads/`.
- MIME declarado, tamanho e assinatura binária do arquivo verificados no backend.
- Logs não incluem query string, conteúdo, e-mail, código, token, SDP, candidato ICE ou payload bruto. Erros registram tipo, código seguro, frames e identificadores operacionais.
- Diagnósticos do browser são sanitizados duas vezes, deduplicados e limitados.
- O service worker ignora API, Socket.IO, uploads, health e qualquer método não GET.
- Credencial TURN permanente permanece apenas no servidor; o bundle recebe credencial curta por endpoint autenticado.

### Riscos restantes

- A chave JWT ainda é o segredo de assinatura do cookie; rotação/revogação imediata entre dispositivos exigiria uma tabela de sessões ou versão de sessão por usuário.
- E-mail continua público no diretório de usuários e em conversas privadas porque é parte da identificação atual do produto. Foi removido dos contratos que não o usam.
- Uploads são servidos com URL estável. Controle de acesso por download assinado exigiria mover os arquivos para storage privado e alterar o contrato.
- O endpoint de conversas ainda entrega o snapshot completo. Mensagens, favoritas e usuários são paginados; para contas com milhares de chats, o próximo passo é cursor server-side para conversas com merge incremental no cliente.
- `npm audit` reporta duas ocorrências moderadas do mesmo advisory transitivo em `sequelize -> uuid@8.3.2`, sem correção compatível disponível. A falha exige as variantes UUID v3/v5/v6 com buffer; o Sequelize usa v1/v4. Um override forçado para UUID 11 quebraria a faixa suportada pelo Sequelize 6 e não foi aplicado.

## Refatoração por responsabilidade

- `CallProvider`: runtime/estado e timeouts em `callRuntime.ts`, API ICE em `calls.api.ts`, schemas/ACKs em `calls.schemas.ts` e eventos recebidos em `CallProvider/useCallSocketEvents.ts`.
- Mensagens: regras puras/reconciliação em `messages.store.ts`, validação em `messages.validation.ts`, HTTP em `api/messages.api.ts` e eventos em `hooks/useMessageSocketEvents.ts`.
- Conversas: merge de snapshot, ordenação e aplicação de mensagens em `conversations.store.ts`; efeitos e ações permanecem no hook público.
- Status: store puro em `status.store.ts` e playback/timers/mídia em `StatusViewer/StatusPlayback.tsx`.
- Mídia: `MessageItem/MessageMedia.tsx`, `MediaViewer` e `useAudioRecorder` têm responsabilidades isoladas.
- `NewConversationDialog` usa o `Modal` compartilhado para Escape, foco, scroll e restauração de foco.
- A aplicação autenticada, status e favoritas são carregados com `React.lazy`; WebRTC não entra na rota pública.
- O servidor de demonstração morto `src/index.ts` foi removido.

## Testes adicionados

- Backend: resposta segura de `AppError`, Zod e contratos públicos.
- HTTP/MSW: cookie/CSRF e evento global de sessão inválida.
- React Testing Library + `user-event`: login, cadastro, verificação de e-mail, troca de usuário, sessão inválida, preservação em 5xx e error boundary.
- Mensagens: ACK antes/depois do broadcast, ACK ausente com broadcast, retry pelo mesmo `clientId`, reação, regra de leitura, upload e limites compartilhados.
- Conversas: corrida snapshot/evento, atualização comum, não lidas, edição/exclusão da última mensagem, bloqueio, arquivamento, limpar e excluir para mim.
- Status: criação/merge, exclusão e recomputação de não vistos.
- Chamadas: fases puras e timeouts defensivos.
- Áudio: gravação, pausa/retomada, prévia, cancelamento, tracks e ObjectURL.
- Diagnósticos: remoção de segredos e limites de metadados.

## Desempenho e bundle

- Rotas autenticadas e funcionalidades pesadas são chunks separados.
- Source maps ficam desligados no build normal e disponíveis somente em `build:analysis`.
- Mensagens usam paginação por cursor, carregamento incremental e scroll preservado; nenhuma virtualização foi adicionada porque ela poderia quebrar âncora/teclado/acessibilidade sem uma medição de DOM que a justificasse.
- Imagens usam lazy loading; vídeos/áudios usam `preload="metadata"`.
- Tracks, peers, listeners, timers e ObjectURLs têm cleanup explícito.
- Favoritas usam uma requisição agregada, e busca de usuário usa uma requisição paginada por termo.

Principais chunks JavaScript do build final:

| Chunk                            | Tamanho bruto |      Gzip |
| -------------------------------- | ------------: | --------: |
| Inicial (`index`)                |     376,14 kB | 115,61 kB |
| Aplicação autenticada + chamadas |     131,18 kB |  36,85 kB |
| Status                           |      28,97 kB |   9,15 kB |
| API de mensagens                 |       3,41 kB |   1,06 kB |
| Favoritas                        |       2,65 kB |   1,19 kB |
| Modal                            |       2,54 kB |   1,17 kB |

## Decisões arquiteturais

- Não foram adotados npm workspaces: há apenas raiz/backend e um cliente, e os scripts `--prefix client` mantêm locks e ciclo de deploy explícitos sem reorganização de pacotes.
- Não foi adicionada biblioteca global de estado. Stores puras e hooks locais resolvem concorrência mantendo dependências pequenas.
- WebSocket é o único transporte Socket.IO para cumprir a ausência de polling de rede.
- O frontend legado foi preservado e adaptado ao cookie, mas não é servido em produção. Ele pode ser removido em uma mudança posterior após observação operacional.
- A validação do frontend melhora UX; toda decisão de segurança e regra de negócio permanece no backend.

## Execução

### Desenvolvimento

```bash
npm ci
npm --prefix client ci
copy .env.example .env
npm run db:migrate
npm run dev
```

Backend: `http://localhost:5000`. Vite: `http://localhost:5173`.

### Produção

```bash
npm ci
npm --prefix client ci
npm run db:migrate
npm run build
set NODE_ENV=production
npm start
```

Em PowerShell, use `$env:NODE_ENV = "production"` antes de `npm start`. Configure HTTPS no proxy reverso, os segredos reais no ambiente e, para chamadas confiáveis entre redes, `TURN_URLS` e `TURN_SHARED_SECRET`.

### Validação local/CI

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run validate
```

O workflow `.github/workflows/ci.yml` executa instalação limpa da raiz e do cliente seguida de `npm run validate` em Node 22.

## Registro da validação final

Resultados observados nesta revisão:

- `npm ci`: raiz, 308 pacotes instalados; cliente, 303 pacotes instalados.
- `npm run format:check`: passou, todos os arquivos correspondem ao Prettier.
- `npm run lint`: passou sem erros; cobertura gerada é ignorada como artefato.
- `npm run typecheck`: passou no backend e no cliente.
- `npm run test`: 5/5 testes backend e 34/34 testes cliente passaram.
- `npm run test:coverage`: passou; backend selecionado 86,93% linhas e cliente selecionado 67,98% linhas.
- `npm run build`: passou; 249 módulos transformados pelo Vite.
- `npm run validate`: passou integralmente (formatação, lint, tipos, testes e build).
- Build normal: zero arquivos `.map`; nenhum segredo TURN/JWT/DB foi incorporado no bundle do cliente.
- Smoke de produção: `/health` respondeu 200; todas as oito rotas SPA testadas responderam 200; `/api`, `/uploads`, asset inexistente e `/socket.io` não foram capturados pelo SPA.
- Headers: CSP restritiva e HSTS presentes; `index.html` com `no-store`; asset com hash e cache imutável de um ano.
- Socket.IO em WebSocket: handshake alcançou o servidor e foi corretamente rejeitado sem cookie com `SOCKET_AUTH_REQUIRED`.
- `npm audit`: cliente com zero vulnerabilidades; raiz com duas moderadas transitivas, descritas em “Riscos restantes”.

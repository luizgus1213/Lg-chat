# LG Chat — Frontend v2

Frontend atual do LG Chat, construído com React, TypeScript, Vite, React Router, Socket.IO Client, Zod e CSS Modules.

## Requisitos

- Node.js compatível com o projeto
- Backend do LG Chat rodando em `http://localhost:5000`

## Desenvolvimento

```powershell
npm install
npm run dev
```

O Vite abre em `http://localhost:5173` e encaminha `/api`, `/socket.io` e `/uploads` para o backend na porta 5000.

## Validação

```powershell
npm run lint
npm run build
```

## Estrutura

```text
src/
├── api/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── conversations/
│   ├── messages/
│   └── users/
├── socket/
├── styles/
├── App.tsx
└── main.tsx
```

Componentes visuais usam, quando apropriado:

```text
NomeDoComponente/
├── index.tsx
└── styles.module.css
```

O `global.css` contém apenas reset, variáveis, tipografia base e estilos globais compartilhados.

## Segurança

As verificações do React melhoram a experiência, mas não substituem o backend. Autenticação, autorização, participação no chat, bloqueios, limites, permissões e regras de negócio precisam continuar sendo validados no servidor.

## Atualizações automáticas

Não existe polling periódico de conversas ou mensagens. O frontend usa Socket.IO. Há apenas sincronizações pontuais:

- carregamento inicial;
- ação manual de atualizar;
- uma sincronização após reconexão;
- uma sincronização acionada por evento quando chega referência a um chat ainda ausente localmente.

O contador de reenvio de código usa um intervalo apenas local e não faz requisições repetidas.

## Limitações que dependem do backend

- Cookie `HttpOnly`: o token ainda usa `localStorage`; migrar exige mudança coordenada no backend.
- Nova conversa para outro usuário já conectado: o servidor deve emitir um evento pessoal com a conversa completa ou adicionar o socket do destinatário à nova sala.
- Reenvio seguro de mensagem com erro: requer idempotência persistida por `clientId` no backend para evitar duplicação.

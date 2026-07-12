# Resumo da refatoração

## Principais correções

- Recuperação e reorganização do código-fonte React.
- TypeScript estrito habilitado.
- CSS específico removido do arquivo global e migrado para CSS Modules.
- Isolamento das conversas por usuário, evitando resposta obsoleta de outra sessão.
- Cancelamento e descarte de requisições antigas.
- Estados de carregamento, atualização, erro, vazio e busca sem resultado separados.
- Reconciliação otimista de mensagens protegida contra corrida entre broadcast e ACK.
- Mensagens apagadas e mídias renderizadas de forma segura.
- Rolagem preservada ao carregar histórico e sem forçar o usuário ao fim.
- Leitura confirmada somente com janela focada, página visível e viewport no fim.
- Modal de nova conversa com Escape, foco preso, restauração de foco e cancelamento.
- Layout responsivo para desktop, celular, telas baixas e teclado virtual.
- Sincronização por Socket.IO sem polling.

## Arquivos não incluídos no pacote

- `node_modules/`
- `dist/`

Execute `npm install` depois de extrair.

## Validação realizada

- `npm run lint`: aprovado sem erros ou avisos.
- `npm run build`: aprovado.

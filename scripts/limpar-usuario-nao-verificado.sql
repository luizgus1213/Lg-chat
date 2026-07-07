-- Use somente para limpar usuários de teste que ficaram presos sem verificação.
-- Troque o email antes de executar.
DELETE FROM users
WHERE email = 'troque-o-email-aqui@example.com'
  AND email_verificado = false;

# Fluxo de Autenticação

- Não há mais login tradicional.
- Criação de conta exige confirmação por SMS integrada ao botão "Criar Conta".
- Link para Redefinir Senha disponível na tela, que dispara `supabase.auth.resetPasswordForEmail`.
- Convites (invite_code) aplicam company_id e role no profile após verificação do SMS e associação do email/senha ao usuário.

# Diagnóstico rápido para admin-create-user

Execute no PowerShell (substitua <project_ref> e <service_role_key>):

- Listar funções:
  supabase functions list --project-ref <project_ref>

- Listar secrets (verifique SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY e SUPABASE_URL/PROJECT_URL):
  supabase functions secrets list --project-ref <project_ref>

- Invocar função (teste):
  supabase functions invoke admin-create-user --project-ref <project_ref> --body '{"email":"teste@example.com","password":"senha123","first_name":"Teste","company_id":null}'
  # Observação: a invocação só terá sucesso se o token (Authorization) pertencer a um usuário com role 'master'. No painel, use um usuário Mestre.

- Logs da função:
  supabase functions logs admin-create-user --project-ref <project_ref>

Se quiser, cole aqui o resultado de `supabase functions list` e `supabase functions secrets list` que eu analiso.
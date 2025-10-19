# Diagnóstico rápido para admin-create-user

Execute no PowerShell (substitua <project_ref> e <service_role_key>):

- Listar funções:
  supabase functions list --project-ref <project_ref>

- Listar secrets:
  supabase functions secrets list --project-ref <project_ref>

- Invocar função (teste):
  supabase functions invoke admin-create-user --project-ref <project_ref> --body '{"email":"teste@example.com","password":"senha123","first_name":"Teste","company_id":null}'

- Logs da função:
  supabase functions logs admin-create-user --project-ref <project_ref>

Se quiser, cole aqui o resultado de `supabase functions list` e `supabase functions secrets list` que eu analiso.
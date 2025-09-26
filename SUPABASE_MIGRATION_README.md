# Aplicar migration e validar RPC — instruções rápidas

Este passo-a-passo ajuda a aplicar a migration SQL e validar a RPC `admin_update_permissions`.

1) Aplicar migration no Supabase
- Abra seu projeto no painel Supabase.
- Vá para `SQL Editor` → `New query`.
- Cole o conteúdo de `supabase/migrations/20250925120000_fix_admin_update_permissions_and_policy.sql` e execute.
- Se a execução falhar, copie o erro e cole aqui.

2) Testar a RPC via CLI (PowerShell)
- Defina variáveis de ambiente e rode o helper:

```powershell
$env:SUPABASE_URL = "https://<your-project>.supabase.co"
$env:SUPABASE_KEY = "<service_role_or_admin_key>" # preferencialmente service_role
.\scripts\run_test_rpc.ps1 -Target "<TARGET_USER_UUID>" -Perms '["products.manage","dashboard.view"]'
```

- Verifique a saída: o script chamará a RPC e fará um `SELECT` probe. Cole a saída no chat.

3) Testar via frontend (obrigatório)
- Abra o app no seu navegador, DevTools → Network e Console.
- Reproduza: ERP → Controle de Acesso → Editar usuário → Salvar.
- Cole aqui:
  - Request payload (body) da chamada RPC ou do fallback `profiles.update`.
  - Response body e status.
  - Console logs relacionados.

4) Próximos passos após receber os logs
- Eu validarei a gravação e, se necessário, aplicarei correções adicionais (ajuste na função RPC, no frontend ou instruções para ajustar triggers/RLS).


Observações de segurança
- Nunca exponha sua `service_role` em público. Use o script localmente e cole apenas o output (não a chave).


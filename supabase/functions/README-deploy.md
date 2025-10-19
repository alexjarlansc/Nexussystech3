# Deploy das Funções Edge (admin-create-user / admin-delete-user)

Requisitos:
- Supabase CLI instalado e autenticado (`supabase login`).
- Você precisa do `SUPABASE_PROJECT_REF` (ID do projeto) e da `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API > Service role key).

## Opção 1: Script PowerShell (Windows)

No diretório do projeto, execute:

```powershell
# Preencha as variáveis conforme solicitado pelo script
./scripts/deploy_edge_functions.ps1
```

O script irá:
- Definir as secrets SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY e SUPABASE_URL/PROJECT_URL para as funções.
- Fazer o deploy de `admin-create-user` e `admin-delete-user`.

Você pode também passar as variáveis via ambiente:

```powershell
$env:SUPABASE_PROJECT_REF = "<seu_ref>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service_role_key>"
$env:SUPABASE_URL = "https://<seu_ref>.supabase.co"
./scripts/deploy_edge_functions.ps1
```

## Opção 2: CLI manual

```powershell
# 1) Defina as secrets
supabase functions secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key> SERVICE_ROLE_KEY=<service_role_key> --project-ref <project_ref>
supabase functions secrets set SUPABASE_URL=https://<project_ref>.supabase.co PROJECT_URL=https://<project_ref>.supabase.co --project-ref <project_ref>

# 2) Deploy de cada função
supabase functions deploy admin-create-user --project-ref <project_ref>
supabase functions deploy admin-delete-user --project-ref <project_ref>
```

## Teste rápido (opcional)

Após o deploy, no painel Supabase > Functions, teste a função `admin-create-user` enviando um JSON:

```json
{
  "email": "novo.usuario@example.com",
  "password": "senha123",
  "first_name": "Novo Usuário",
  "company_id": "<uuid_da_empresa>"
}
```

Obs.: Apenas usuários com perfil `master` podem invocar com sucesso.

Se aparecer “Service role not configured”, confira se a secret foi definida e redeploy a função.
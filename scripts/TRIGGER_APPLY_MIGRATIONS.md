Trigger: aplicar migrations via GitHub Actions

Este arquivo é um marcador opcional. Depois de configurar o secret `SUPABASE_DATABASE_URL`
no repositório (Settings → Secrets and variables → Actions), um push para a branch `main`
acionará o workflow `.github/workflows/apply-supabase-migrations.yml` que aplica todos os
arquivos SQL em `supabase/migrations`.

Como usar:

1. Adicione o secret no GitHub (não cole aqui):
   - Nome: SUPABASE_DATABASE_URL
   - Valor: a URL de conexão Postgres do Supabase (ex: postgres://user:pass@host:5432/dbname)

2. Faça um commit e push neste repositório (exemplo PowerShell):
   git add scripts/TRIGGER_APPLY_MIGRATIONS.md
   git commit -m "chore: trigger apply supabase migrations (after secret)"
   git push origin main

3. Após o push, verifique o Actions → Apply Supabase migrations para ver a execução e logs.

Se preferir, eu posso criar o commit por você (local) e você apenas pushar; me diga se quer que eu
adicione o commit aqui no repositório (eu criarei o arquivo e o commit para você revisar).

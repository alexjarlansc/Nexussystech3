Resumo
======
Este PR contém duas migrations para suportar hierarquia de produtos (Categoria > Setor > Sessão) e para corrigir referências legadas no estoque.

Arquivos incluídos
------------------
- `20250909091500_add_product_group_id_to_products.sql` — adiciona coluna `product_group_id` (uuid) em `products`, índice, FK (se aplicável) e trigger que popula `category` textual a partir do FK.
- `20250909094500_map_product_stock_codes_to_ids.sql` — helper seguro que cria `product_stock_backup_20250909`, adiciona `product_id_resolved`, tenta mapear `product_stock.product_id` para `products.id` (ou `products.code`) e cria a view `product_stock_resolved` para revisão.

Objetivo
--------
- Permitir que o frontend persista `product_group_id` sem gerar erro PGRST204.
- Fornecer um procedimento seguro para migrar `product_stock` que contenha códigos (legacy) para os UUIDs dos produtos.

Instruções de aplicação (ordem sugerida)
--------------------------------------
1) Preparar backup do banco (sempre faça isso em produção).

2) Aplicar migration que cria `product_group_id` na tabela `products`:
   - Via Supabase CLI (recomendado):
     ```powershell
     cd "C:\Alex Jarlan\Nexussystech3"
     npm run db:push
     # ou
     supabase db push
     ```
   - Ou via psql executando o arquivo `supabase/migrations/20250909091500_add_product_group_id_to_products.sql`.

3) Verificar se a tabela `product_groups` existe e está populada. Se não existir, crie as categorias/sets/sessões antes de associar produtos.

4) Aplicar a migration de mapeamento do `product_stock` (opcional, recomendado se você tiver `product_stock.product_id` contendo códigos):
   - Execute `supabase db push` ou rode manualmente o arquivo `supabase/migrations/20250909094500_map_product_stock_codes_to_ids.sql`.
   - Após execução, inspecione a view `product_stock_resolved`:
     ```sql
     SELECT * FROM public.product_stock_resolved WHERE product_id_resolved IS NULL LIMIT 200;
     SELECT * FROM public.product_stock_resolved WHERE product_id_resolved IS NOT NULL LIMIT 50;
     ```
   - Revise mapeamentos antes de aplicar o update final.

5) (Opcional) Aplicar update definitivo — manual e somente após validação:
   - Faça backup extra.
   - Atualize `product_stock.product_id` com `product_id_resolved::text` (ou altere tipo para uuid e atualize com uuid).
   - Exemple:
     ```sql
     BEGIN;
     UPDATE public.product_stock ps SET product_id = ps.product_id_resolved::text WHERE ps.product_id_resolved IS NOT NULL;
     COMMIT;
     ```

6) Reiniciar o PostgREST/Supabase (ou aguardar recarga de cache) para evitar erro PGRST204.

Notas
-----
- As migrations neste PR são escritas de forma resiliente (`IF NOT EXISTS`) para reduzir impacto em ambientes variados.
- Se você utilizar Row-Level Security (RLS), configure as permissões necessárias após aplicar as migrations.

Se precisar, posso também:
- Aplicar as migrations diretamente via Supabase CLI (se autorizar),
- Criar um script para validar automaticamente os mapeamentos antes do update final.

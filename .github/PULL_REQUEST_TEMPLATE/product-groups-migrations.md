# Migrations: product_groups & product_stock mapping

Use este checklist ao revisar/aplicar este PR. Ele complementa o `supabase/README-migrations-product-groups.md` incluído no PR.

## Objetivo
- Adicionar suporte a `product_group_id` em `products` e migrar referências legadas de `product_stock` que armazenam códigos em vez de IDs.

## Checklist pré-aplicação (executar em staging primeiro)
- [ ] Fazer backup completo do banco (dump) do ambiente onde será aplicado.
- [ ] Verificar que a branch atual contém os arquivos:
  - `supabase/migrations/20250909091500_add_product_group_id_to_products.sql`
  - `supabase/migrations/20250909094500_map_product_stock_codes_to_ids.sql`
  - `supabase/README-migrations-product-groups.md`

## Aplicação das migrations (ordem sugerida)
1. [ ] Aplicar a migration que adiciona `product_group_id`:
   - `npm run db:push` ou `supabase db push` (recomendado)
   - ou executar manualmente o arquivo `supabase/migrations/20250909091500_add_product_group_id_to_products.sql`.
2. [ ] Verificar que a tabela `product_groups` está presente e populada. Se necessário, aplicar migrations que criam/populam `product_groups` antes.
3. [ ] Aplicar a migration de mapeamento do `product_stock` (opcional, recomendado para bases legadas):
   - `npm run db:push` ou executar `supabase/migrations/20250909094500_map_product_stock_codes_to_ids.sql`.

## Validação (obrigatória antes de qualquer update definitivo)
- [ ] Inspecionar a view `public.product_stock_resolved`:
  - `SELECT * FROM public.product_stock_resolved WHERE product_id_resolved IS NULL LIMIT 200;` — revisar linhas não mapeadas.
  - `SELECT * FROM public.product_stock_resolved WHERE product_id_resolved IS NOT NULL LIMIT 200;` — validar mapeamentos.
- [ ] Conferir amostras manuais (ids, códigos, quantidades) para confirmar mapeamentos.

## Atualização definitiva (aplicar somente após validação)
- [ ] Criar backup adicional antes de atualizar.
- [ ] Atualizar `product_stock.product_id` com os valores resolvidos **somente** se consistente:
  - Se `product_stock.product_id` for TEXT: `UPDATE public.product_stock ps SET product_id = ps.product_id_resolved::text WHERE ps.product_id_resolved IS NOT NULL;`
  - Se `product_stock.product_id` for UUID: `UPDATE public.product_stock ps SET product_id = ps.product_id_resolved WHERE ps.product_id_resolved IS NOT NULL;`
- [ ] (Opcional) remover coluna `product_id_resolved` e view `product_stock_resolved` após validação.

## Pós-aplicação
- [ ] Reiniciar PostgREST/Supabase (ou aguardar recarga do schema cache) para evitar `PGRST204`.
- [ ] Testar no frontend:
  - Criar/editar produto e selecionar Categoria → Setor → Sessão e salvar.
  - Validar que `product_group_id` está sendo persistido e que relatório "Estoque completo" mostra produtos e valores corretamente.
- [ ] Ajustar permissões / RLS se aplicável.

## Rollback
- [ ] Se algo falhar, restaurar backup do banco.
- [ ] Se update final do `product_stock` já tiver sido executado, restaure `product_stock` a partir do backup criado no início.

---
Referência: `supabase/README-migrations-product-groups.md` para detalhes e comandos alternativos.

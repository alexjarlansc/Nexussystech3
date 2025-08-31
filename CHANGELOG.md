# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

## [0.1.3] - 2025-08-31
### Build / Otimizações
- Adição de `manualChunks` no `vite.config.ts` para dividir dependências principais (react, router, supabase, recharts) e reduzir o tamanho do bundle principal (~329 kB), preparando terreno para futuros lazy loads de rotas/modais.
- Nenhuma mudança de API pública.

## [0.1.2] - 2025-08-31
### Refatorações
- Remoção de regex `/[-:TZ.]/` na geração de IDs fallback para números de pedidos/orçamentos e vendas, substituída por montagem manual de timestamp (YYMMDDHHMM).
- Atualização do CHANGELOG incluída no histórico.

## [0.1.1] - 2025-08-31
### Refatorações
- Separação do `AuthProvider` em arquivo dedicado para reduzir warnings de Fast Refresh.
- Extração de tipos de autenticação para `authTypes.ts` e simplificação da assinatura de `signUp`.

## [0.1.0] - 2025-08-31
### Funcionalidades
- Suporte à role `pdv` na geração de códigos de convite.
- Tipagem forte para códigos de convite (`InviteCode`) e retorno de `getInviteCodes`.

---
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/), versionamento seguindo semver inicial.

# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

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

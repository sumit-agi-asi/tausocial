# TauSocial

## Repository purpose

TauSocial is a social media platform with accountability built into the product experience and AI-driven monitoring for trust and safety.

## Architecture summary

This monorepo contains:

- React Native mobile application
- Next.js web application
- Kotlin and Swift native bridge modules
- Shared domain and UI packages
- Backend API and worker services
- AI and moderation infrastructure
- Cloud and deployment abstraction layers

## Repository structure

```text
apps/
  mobile/
  web/
packages/
  shared/
  domain/
  ui/
  design-system/
  data/
  state/
  infra/
services/
  api/
  workers/
  ai/
  integrations/
  realtime/
native/
  android/
  ios/
infrastructure/
  cloud/
  docker/
  kubernetes/
  terraform/
  observability/
  security/
docs/
tests/
tooling/
```

## Design principles

- Mobile and web remain thin UI surfaces
- Shared domain logic lives outside platform apps
- Backend and AI are modular by capability
- Moderation and safety are integrated at the platform level
- Cloud provider dependency is abstracted
- Repo is prepared for growth without major refactors

## Next steps

- Create platform-specific app manifests
- Define domain contracts and service interfaces
- Add CI/CD workflows
- Add ADRs and architecture documentation
- Add environment configuration templates


# ADR 0001: npm workspaces monorepo
Status: accepted. `apps/web` and `apps/server` share tooling (TypeScript base config, ESLint flat config, Vitest) and root scripts delegate to workspaces. Alternatives (pnpm/Nx) add tooling without clear benefit at this size.

# Distrito Hobby NI

Repository foundation for a small business in Nicaragua that will sell comics, manga, figures, collectibles, cards, and related merchandise. The repository uses the existing workspace name, `distrito-hobby-ni`.

## Current status

This project is currently in the foundation/architecture phase. E-commerce domain architecture, database models, authentication flows, payments, inventory, checkout, and admin functionality will be designed before implementation.

The application currently serves only a responsive, accessible coming-soon page. Its neutral styling and system font are temporary, not a final brand identity. Search indexing is disabled in page metadata until launch is planned.

## Technology stack

| Area                        | Foundation                                                                      |
| --------------------------- | ------------------------------------------------------------------------------- |
| Runtime and package manager | Node.js 24, pnpm 12.6.0                                                         |
| Application                 | Next.js 16, App Router, React 19, TypeScript strict mode                        |
| UI tooling                  | Tailwind CSS 4, shadcn/ui configuration and utilities, Lucide React, Motion     |
| Validation, forms, state    | Zod, React Hook Form, Zustand                                                   |
| Persistence                 | Prisma ORM and client **7.10.0**, with PostgreSQL as the agreed future database |
| Authentication              | Better Auth installed; integration deferred                                     |
| Testing                     | Vitest, React Testing Library, Playwright                                       |
| Code quality                | ESLint, Prettier, EditorConfig                                                  |

Exact dependency versions are recorded in `package.json` and `pnpm-lock.yaml`. Prisma and its client are pinned to version 7; do not upgrade them to Prisma 8. Installed feature libraries are intentionally unused until the relevant architecture is approved.

PostgreSQL is not provisioned or required to run this foundation. There is no Prisma schema, migration, generated client, database connection, or authentication endpoint. Database version, hosting, driver setup, and model design belong to the architecture phase.

## Prerequisites

- Git and access to the private repository.
- Node.js **24.11.0 or later within major 24**. `.nvmrc` and `.node-version` select Node 24; other majors are outside the declared project runtime.
- pnpm **12.6.0**, as declared in `packageManager`.

If using nvm:

```sh
nvm install
nvm use
node --version
```

Install the declared package manager if needed:

```sh
npm install --global pnpm@12.6.0
pnpm --version
```

## Installation

```sh
git clone https://github.com/Lenin-Miranda/distrito-hobby-ni.git
cd distrito-hobby-ni
pnpm install --frozen-lockfile
```

The committed lockfile is required. Use pnpm for dependency changes and commit the resulting lockfile. Package-manager settings, including exact version saving and the dependency build-script allowlist, live in `pnpm-workspace.yaml`; this is a single application, not a monorepo.

## Environment setup

No environment values are needed for the temporary page, tests, or production build. When preparing a local environment file:

```sh
cp .env.example .env.local
```

Leave the placeholders blank during this phase:

| Placeholder        | Reserved purpose                               |
| ------------------ | ---------------------------------------------- |
| `DATABASE_URL`     | Future PostgreSQL connection                   |
| `AUTH_SECRET`      | Future authentication secret                   |
| `CLOUDINARY_URL`   | Future media integration                       |
| `EMAIL_API_KEY`    | Future email service                           |
| `PAYMENT_PROVIDER` | Future provider selection; no provider assumed |

These names are planning placeholders, not an implemented environment contract. For example, mapping `AUTH_SECRET` to Better Auth configuration will be decided when authentication is implemented. Do not generate or add real credentials now. `.env*` files are ignored except for the blank `.env.example`. Never put secrets in client code or `NEXT_PUBLIC_*` variables.

## Development commands

| Command             | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Start development at `http://localhost:3000`                     |
| `pnpm build`        | Create a production build                                        |
| `pnpm start`        | Serve an existing production build                               |
| `pnpm lint`         | Run ESLint; warnings fail the check                              |
| `pnpm typecheck`    | Generate Next.js route types and run strict TypeScript checks    |
| `pnpm test`         | Run unit/component tests once                                    |
| `pnpm test:watch`   | Watch unit/component tests                                       |
| `pnpm test:e2e`     | Build and test the production app in desktop and mobile Chromium |
| `pnpm format`       | Format source and documentation                                  |
| `pnpm format:check` | Check formatting without editing files                           |

Next.js does not run ESLint as part of the production build; run the quality commands separately.

ESLint is pinned to 9.39.5 because the lint plugins shipped with this Next.js version declare support through ESLint 9. npm marks that major deprecated; move to ESLint 10 when the Next.js plugin set supports it. The current dependency graph has no peer conflicts.

## Testing and verification

Install the Playwright browser once per development machine:

```sh
pnpm exec playwright install chromium
```

On Linux CI, use `pnpm exec playwright install --with-deps chromium` to include required system libraries.

Before committing:

```sh
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

`test:e2e` runs a production build, starts a dedicated production server on `127.0.0.1:3100`, and stops it when tests finish. It invokes Next.js directly so Playwright owns and cleans up the server process. Keep that port available. Do not run builds and E2E tests concurrently because they share `.next`. To verify compilation on its own, run `pnpm build`.

The component smoke test verifies the page's accessible landmark and heading. E2E checks cover successful HTTP rendering, metadata, content visibility, horizontal overflow at desktop and mobile sizes, and browser errors. These tests verify the foundation; they do not validate any future commerce behavior. Test reports and traces are ignored by Git.

## Repository structure

```text
src/
  app/                 App Router layout, temporary page, styles, component test
  components/ui/       Reserved for shadcn/ui components when needed
  config/              Reserved for shared configuration
  lib/utils.ts         shadcn-compatible class-name utility
  types/               Reserved for genuinely shared types
tests/
  e2e/home.spec.ts      Desktop and mobile browser smoke test
  setup.ts             React Testing Library / Vitest setup
components.json        shadcn/ui aliases and neutral theme configuration
eslint.config.mjs      Next.js and TypeScript lint rules
next.config.ts         Minimal Next.js configuration
playwright.config.ts   Production-server browser test configuration
vitest.config.ts       Component/unit test configuration
.env.example           Blank integration placeholders
```

Empty shared directories are intentionally retained with `.gitkeep` files. Add code when a concrete requirement needs it; avoid speculative service layers, repositories, state stores, or domain modules.

shadcn/ui is configured for source components added on demand. After the UI is designed, use `pnpm exec shadcn add <component>` and review generated code and dependency changes. No component collection or final theme has been introduced.

## Development conventions

- Use short-lived branches and reviewed pull requests into `main` after this initial foundation commit.
- Write conventional commits, such as `chore: initialize project foundation` or `fix: correct page metadata`.
- Keep TypeScript strict. Prefer `@/*` imports for shared source code.
- Use Server Components by default; add client boundaries only when interaction requires them.
- Preserve semantic HTML and verify responsive behavior for UI changes.
- Keep tests proportional to behavior. Add meaningful coverage alongside future features.
- Run formatting, types, lint, unit tests, and production browser tests before merging.
- Keep Prisma and `@prisma/client` on the same exact **7.x** version.
- Review dependency upgrades and dependency lifecycle scripts explicitly; do not broadly allow all install scripts.
- Keep credentials, local environment files, generated output, and customer data out of version control.

## Intentionally deferred

The next phase will design domain architecture, database schema, authentication, payment boundaries, and UI/UX before implementing them. There are no products, categories, inventory, cart, checkout, orders, customer flows, admin tools, discounts, wishlists, reviews, webhooks, or email sending in this repository.

Cloudinary, email, and payment services are not configured. Stripe is not installed. The payment layer will be designed around a provider abstraction suitable for Nicaragua, with BAC Credomatic E-Commerce as one possible provider; no provider has been selected or implemented.

Deployment, production secrets, data handling, and operational policies remain for a later phase. This foundation is not a live store.

## Setup references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui manual setup](https://ui.shadcn.com/docs/installation/manual)
- [pnpm project settings](https://pnpm.io/settings)
- [Prisma ORM 7 documentation](https://www.prisma.io/docs/orm/v7)

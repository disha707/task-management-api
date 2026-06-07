# 10-Day Learning Journey — Task Management API

**Apprentice:** Disha  
**Organisation:** Incubyte  
**Period:** Days 1–10  
**Project:** Full-stack Task Management Application (NestJS + React + TypeScript)

---

## Overview

This document is a personal reflection on ten days of structured learning at Incubyte. The goal was not just to build a working application — it was to internalise *how* Incubyte builds software: with craftsmanship, discipline, and a mindset of continuous improvement. The Task Management API and its React frontend were the vehicle; TDD, clean code, and shipping to production were the destination.

---

## Day 1 — Culture, Craft, and the Incubyte Way

**What I did:** Read the Incubyte blog, studied core values, watched the Three Laws of TDD and SOLID Principles videos, and set up Node.js, TypeScript, and VS Code.

**Key learnings:**

- **Kaizen** (改善) literally means "change for better." In software it is not about big rewrites — it is about making one thing slightly better every single day. A cleaner test name, a more honest variable, a helper that removes duplication. Over time these compound.
- The **Three Laws of TDD** (Uncle Bob) gave me a mental model I keep returning to:
  1. You may not write production code unless it is to make a failing test pass.
  2. You may not write more of a test than is sufficient to fail.
  3. You may not write more production code than is sufficient to make the failing test pass.
  The discipline is not about the tests themselves — it is about *trust*. When you follow the laws, you know exactly what every line of production code is doing and why it exists.
- **SOLID** was not new to me as a set of acronyms, but seeing it explained in the context of a real codebase made the Dependency Inversion Principle click. NestJS is DIP made tangible: you inject abstractions, not concrete classes.
- TypeScript strict mode was uncomfortable at first. Being forced to name every type, annotate every edge case, felt slow. By day ten I could not imagine going back.

**Honest reflection:** I underestimated how much Incubyte's culture section would affect my thinking. The phrase *"software craftsmanship over code-as-commodity"* stayed with me. It changed what I noticed when I wrote code — not just "does it work?" but "would I be comfortable showing this to someone I respect?"

---

## Day 2 — NestJS, TDD Discipline, and the First Red Test

**What I built:** Task Management API scaffold — modules, controllers, services, Vitest.

**Key learnings:**

- **NestJS architecture** maps almost perfectly onto the SOLID principles from Day 1. Modules are the boundary. Services hold business logic. Controllers are thin HTTP adapters. This separation matters — it is what makes unit testing possible without a running server.
- Writing the *test first* was genuinely hard. My instinct was to write the handler and then prove it worked. The discipline of writing a failing test first forces you to think about the API — what does this method accept, what does it return, what does failure look like — before you think about the implementation. That is a different kind of thinking.
- **Dependency injection** in NestJS is not magic. It is a container that wires up the object graph for you. Once I understood that `@Injectable()` just registers a class with that container, and that `@Module({ providers: [...] })` is the registration, the framework stopped feeling opaque.
- **DTOs with class-validator** taught me that validation at the boundary is a first-class concern, not an afterthought.

**Honest reflection:** I wrote production code before a failing test on day two, caught myself, deleted it, and wrote the test first. That is the only way to build the habit — noticing the slip and correcting immediately.

---

## Day 3 — Drizzle ORM: Type-Safety All the Way Down

**What I built:** PostgreSQL schema, migrations, CRUD operations wired to the database.

**Key learnings:**

- **Drizzle** feels different from other ORMs because it does not hide SQL — it gives you type-safe SQL. When you write `.where(eq(tasks.id, id))`, you are writing a query, not configuring a magic method chain. This keeps the mental model honest.
- Schema definition in Drizzle is the single source of truth. The TypeScript types for your rows are *inferred* from the schema, not declared separately. If you rename a column in the schema, every query that references the old name breaks at compile time.
- **Integration tests with a real database** taught me something the unit tests cannot: the difference between "the logic is correct" and "the SQL is correct." A mock that always returns what you tell it can hide a broken query. A test that hits a real Postgres container cannot.
- The `mockChain` utility (built to fake Drizzle's builder pattern in unit tests) was a lesson in the cost of the builder pattern for testability. It is the right trade-off, but it is a trade-off.

**Honest reflection:** Setting up the `mockChain` took longer than I expected because Drizzle's fluent API chains through many methods before resolving. I learned that understanding the thing you are mocking is a prerequisite to mocking it well.

---

## Day 4 — Full CRUD, Pagination, and Testing Edge Cases

**What I built:** POST, PATCH, DELETE endpoints; pagination; search; bulk delete; transaction handling.

**Key learnings:**

- **Pagination** is not just adding `limit` and `offset` — it requires a separate `COUNT(*)` query to know the total, which then informs `totalPages`. Getting this right exposed a gap in my unit tests: the mock needed to return two different responses from two consecutive `db.select` calls. The `mockReturnValueOnce` chaining pattern solved this.
- **Transactions** in Drizzle protect atomic operations. The `deleteTasksInBatch` method that deletes multiple tasks in a single transaction was the most complex piece of business logic I wrote. Testing it required mocking `db.transaction` to invoke the callback directly.
- Writing tests *before* the bulk-delete endpoint revealed an API design question I had not thought about: what should happen when only *some* of the requested IDs exist? Thinking through the test first forced a decision (return 404 for partial mismatch) before writing a line of implementation.
- **The value of testing edge cases** became concrete: the "not found" path, the empty array, the id-that-does-not-exist. These are the cases that production users hit first.

**Honest reflection:** I reached ~80% coverage but the number itself is not the point. The gaps in coverage pointed to gaps in my understanding of what the code actually needed to handle.

---

## Day 5 — React, TypeScript, and Testing in the Browser

**What I built:** Vite + React + TypeScript frontend; Task and TaskList components; Tailwind CSS; Vitest + React Testing Library.

**Key learnings:**

- React with TypeScript forces you to define *what* a component receives and *what* it renders before you write the rendering logic. Interfaces for props are the frontend equivalent of DTOs.
- **React Testing Library** pushes you to test behaviour, not implementation. Queries like `screen.getByRole('button', { name: /create/i })` test what the user sees, not what the component's internal state is. This was a shift from how I had thought about component tests before.
- Vite's fast HMR made the TDD loop comfortable in the frontend. Write test, see red, write component, see green — within seconds.
- `useEffect` for data fetching is clean when the happy path works, but error and loading states require deliberate design. I had to write the tests for loading and error first to force myself to handle them.

**Honest reflection:** I underestimated how different frontend TDD feels from backend TDD. The "unit" in a component test is a rendered UI, not a function return value. Adjusting took most of day five.

---

## Day 6 — API Integration, Custom Hooks, and MSW

**What I built:** `useTasks` custom hook; create task form; MSW handlers for API mocking in tests.

**Key learnings:**

- **Custom hooks** are the right abstraction boundary for data fetching. The component should not know about `fetch` — it should know about `tasks` and `createTask`. The hook owns the HTTP concern.
- **MSW (Mock Service Worker)** intercepts requests at the network level. The test does not care whether the component uses `fetch` or `axios` or something else. This makes MSW tests much more honest about what the user's browser actually receives.
- I learned about `VITE_API_URL` as an environment variable baked in at build time. In production the variable points to the Render backend; in tests it points to `localhost:3000` and MSW intercepts the calls. The same code path exercises both.
- **AuthContext** pattern — keeping JWT and user state in a context that wraps the whole app — is the right place for auth state. Moving `useAuth` to its own file (to satisfy the `react-refresh/only-export-components` lint rule) also turned out to be a cleaner design: the hook is independently importable.

**Honest reflection:** The CORS issue in production (frontend on Vercel, backend on Render) was the first real "works on my machine" failure I encountered. Reading the error message carefully and tracing it back to the `FRONTEND_URL` environment variable was a debugging exercise in patience.

---

## Day 7 — Authentication End-to-End

**What I built:** User schema, registration, login, JWT issuance, bcrypt hashing, `JwtAuthGuard`, protected routes in React.

**Key learnings:**

- **JWT authentication** in NestJS follows a clear pattern: `AuthModule` provides `JwtStrategy` (validates incoming tokens) and `JwtAuthGuard` (applies that strategy to routes). The separation between the strategy and the guard is good SOLID design.
- **bcrypt** hashing is intentionally slow. Using `vi.mocked(bcrypt.hash).mockResolvedValue(...)` in unit tests instead of running the real hash function keeps tests fast without hiding correctness — the integration tests run the real bcrypt.
- Testing auth required me to think carefully about *what layer* each test belongs to. Unit tests verify that the service calls `bcrypt.hash` with the right arguments. Integration tests verify that registering a user and then logging in returns a valid token. E2E tests verify that the HTTP endpoints return the right status codes.
- I made a meaningful error early: I returned `ConflictException` from the service but the test was asserting on the HTTP status code. This forced me to understand the full call chain and where each assertion belonged.

**Honest reflection:** Auth is the feature where the "classical vs mockist" testing distinction was clearest. The mockist tests verify the service calls `bcrypt.hash` — they will break if I swap hashing libraries. The classical tests verify that a user registered with password X can login with password X — they will not. I now have a clearer intuition for which assertions belong in which style.

---

## Day 8 — AI-Assisted Development with BEE and Learn Plugins

**What I explored:** BEE plugin philosophy, agent routing, Incubyte AI workflow patterns; Learn plugin composition.

**Key learnings:**

- The analogy that stuck: *"Developer is the driver, Claude Code is the car, BEE is the GPS."* The GPS does not drive. It does not decide the destination. It offers the best route given where you are and where you want to go — and you are always free to override it.
- BEE's triage routing (TRIVIAL vs EPIC) is itself a form of the Single Responsibility Principle. A specialist agent for architecture advice is different from one for test writing, which is different from one for code review. Dividing responsibilities produces better outputs.
- The most important thing I learned about AI-assisted development: **the craft does not go away, it shifts.** You still need to know what good code looks like to review what the AI produces. You still need to understand TDD to write the test the AI will implement against. The skill requirement changes shape, not magnitude.
- Using BEE for a feature in the Task Management app showed me that AI tools are most valuable when you give them precise context — the spec, the constraints, the existing patterns. Vague prompts produce vague code.

**Honest reflection:** I caught myself accepting AI-generated code I did not fully understand. I flagged it, read it carefully, and pushed back on two design choices. That review instinct — not treating AI output as authoritative — is a craft skill.

---

## Day 9 — Docker, Environment Config, and Production Readiness

**What I built:** Dockerfiles for backend and frontend; `docker-compose` for local dev; health check endpoint; environment-based config with Joi validation.

**Key learnings:**

- **Docker** makes the "works on my machine" problem go away by making *your machine* reproducible. The backend `Dockerfile` using a multi-stage build (builder → production) keeps the final image lean — no `devDependencies`, no source TypeScript.
- The `GET /health` endpoint returning `{ status: 'ok', timestamp }` is one of the simplest pieces of infrastructure with disproportionately high value. Load balancers, container orchestrators, and deployment workflows all depend on a reliable health signal.
- **Environment validation with Joi at startup** was a revelation. Instead of a runtime crash when `JWT_SECRET` is missing (which might happen at 2 AM in production), the app refuses to start with a clear message about what is wrong. Fail fast, fail loudly.
- `render.yaml` as infrastructure-as-code means the deployment configuration is version-controlled alongside the application. If something breaks in deployment, the git log tells the story.

**Honest reflection:** The `tsconfig.build.json` fix (excluding Cypress and test files from the NestJS build) was a debugging session that took longer than expected. I had never thought carefully about the distinction between "files TypeScript needs to compile" and "files NestJS `nest build` should include." That distinction matters in production.

---

## Day 10 — CI/CD, Production Deployment, and Shipping

**What I built:** GitHub Actions workflows (Backend CI, Frontend CI, Docker Build & Push, Deploy Backend, Deploy Frontend); Render + Neon + Vercel production stack; `docs/RUNBOOK.md`.

**Key learnings:**

- **GitHub Actions** turned the repository into a delivery pipeline. Every push runs lint, unit tests, and integration tests. Every merge to `main` builds Docker images, deploys the backend to Render, and deploys the frontend to Vercel — automatically, without any manual steps.
- **The lint pipeline had 328 errors** when I first ran `npx eslint src --max-warnings 0` in CI. Fixing them systematically (type-unsafe `any`, unbound methods, Prettier formatting, floating Promises) taught me more about TypeScript's type system than a week of reading documentation would have. The errors were a curriculum.
- The ESLint spec-file override was an important design decision: test files have inherently different typing requirements from production code (mocking requires `any`). Acknowledging that in configuration — rather than littering test files with disable comments — keeps the intent clear.
- **The `void bootstrap()` pattern** in `main.ts` for a top-level Promise was a small thing with a big lesson: ignoring a Promise without being explicit about it is a bug waiting to happen.
- Writing the deployment runbook forced me to think like an on-call engineer reading the document at 2 AM — what do they need, in what order, with what context? Documentation is an act of empathy for your future self.

**Honest reflection:** The moment the GitHub Actions CI turned green after 328 lint errors was the best moment of the ten days. Not because the errors were hard to fix individually, but because fixing them required understanding *why* each rule existed. That understanding would not have come from reading about lint rules in the abstract.

---

## What I Built

A production-grade full-stack application consisting of:

| Layer | Technology | Hosted at |
|-------|-----------|-----------|
| Backend API | NestJS + TypeScript + Drizzle ORM | Render |
| Database | PostgreSQL | Neon |
| Frontend | React + TypeScript + Vite | Vercel |
| Container images | Docker (multi-stage) | GitHub Container Registry |
| CI/CD | GitHub Actions (5 workflows) | GitHub |

Endpoint coverage: `GET /health`, `POST /auth/register`, `POST /auth/login`, full CRUD for tasks, pagination, search, filtering, sorting, bulk delete, stats.

Test coverage: unit (classical + mockist), integration (real DB), E2E (full HTTP pipeline), frontend component tests (React Testing Library + MSW).

---

## Patterns and Principles I Will Carry Forward

**TDD red-green-refactor is not a rule — it is a guarantee.** When I follow it, every line of production code has a reason to exist and a test that proves it. When I skip it, I am borrowing confidence from somewhere it does not exist.

**Classical tests verify outcomes; mockist tests verify collaboration.** Both are useful. Classical tests are more robust to refactoring. Mockist tests are more precise about interactions. The test name should tell you which style it is and why.

**The layer that receives input is the layer that validates it.** DTOs with `class-validator` at the HTTP boundary. Joi schema at the environment boundary. The database schema at the persistence boundary. Each layer owns its own contracts.

**Type-safety is not a constraint — it is a communication tool.** The TypeScript compiler is telling future-you (and your teammates) exactly what this function expects and what it returns. `any` is a lie to the compiler and to your readers.

**Kaizen in practice:** At the end of day ten the test files had stub helpers. At the start of day ten they had `(db.select as any).mockReturnValueOnce(mockChain([...]))` repeated eight times. The improvement was not planned — it was noticed, questioned, and acted on. That is the habit.

---

## What I Would Do Differently

1. **Set up ESLint with `--max-warnings 0` on day one,** not day ten. The lint debt that accumulated over nine days took a full session to pay off. Running CI locally from the start would have caught each issue in the commit that introduced it.

2. **Write the `RUNBOOK.md` earlier** — at least by day nine when the deployment topology was decided. Writing it at the end meant reconstructing context I had already lived through.

3. **Be more deliberate about which test style to use before writing.** Several times I started writing a classical test that was really asking a mockist question, or vice versa. The question to ask first: "Am I testing what this returns, or who this calls?"

4. **Explore MSW earlier in the frontend journey.** Using `fetch` directly in component tests works until it doesn't. Having MSW from the start would have made the frontend tests more honest from day five onward.

---

## Next Steps

| Area | What I want to learn next |
|------|--------------------------|
| Testing | Mutation testing (Stryker) to verify the test suite's strength |
| Architecture | Hexagonal architecture — ports and adapters in a NestJS context |
| Observability | Structured logging, distributed tracing, error tracking (e.g. Sentry) |
| Database | Advanced Drizzle patterns — relations, transactions across services |
| Frontend | React Query or SWR to replace manual `useEffect` data fetching |
| AI tooling | Deeper BEE usage — running full feature slices with spec-first workflow |
| Craft | Code review practice — giving and receiving feedback on real PRs |
| Deployment | Zero-downtime deploys, rollback strategies, feature flags |

---

## Closing Reflection on Craftsmanship

Before this ten days I thought craftsmanship in software was about writing clever code. I now think it is the opposite: it is about writing code that does not require cleverness to understand — by anyone, including yourself six months from now.

The test that fails before the code is written. The lint rule that catches the unhandled Promise. The helper function that names what the setup is doing. The runbook that explains what to do at 2 AM. These are all the same instinct: leave things clearer than you found them.

Kaizen is not a methodology. It is what happens when you pay attention.

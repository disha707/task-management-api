## Context Summary

Analysis method: text-based pattern matching

### Project Structure
- **Stack**: TypeScript, NestJS 11 (backend), React 19 + Vite (frontend), Node, PostgreSQL
- **Build**: `nest build` (backend via NestJS CLI), Vite (frontend); `npm` in both roots
- **Layout**: Monorepo-style with two independent roots — `/` (NestJS API) and `/frontend/` (React SPA). Backend source lives in `src/` with feature folders (`tasks/`, `auth/`, `users/`, `db/`). Frontend source is `frontend/src/` with `components/`, `hooks/`, `mocks/`, `pages/`, `context/`, `types/`.
- **Key dependencies**: Drizzle ORM + `pg` driver, class-validator + class-transformer (NestJS validation), Passport + JWT (auth), MSW 2 (frontend API mocking), React Testing Library + userEvent, Vitest (both sides), Tailwind CSS 4 (@tailwindcss/vite plugin)

### Architecture Pattern
- **Detected**: MVC (backend) / Simple feature-hook pattern (frontend)
- **Evidence**: Backend has `TasksController` → `TasksService` → Drizzle `db` singleton; no repository interface, no domain layer, no ports. Frontend uses a single `useTasks` hook that owns all fetch/state logic; pages compose hook + UI components with no intermediate service layer.
- **Dependency direction**: Controller imports Service; Service imports `db` directly (no repository abstraction). Frontend: `TasksPage` → `useTasks` hook + presentational components; `CreateTaskForm` and `Task` receive everything via props.

### Test Infrastructure
- **Framework**: Vitest (both backend and frontend)
- **Location**: Co-located — backend tests live beside source as `*.spec.ts`; frontend tests live beside components as `*.test.tsx`
- **Naming**:
  - Backend: `[name].service.unit.spec.ts`, `[name].service.integration.spec.ts`, `[name].controller.unit.spec.ts`, `[name].controller.mockist.spec.ts`
  - Frontend: `[ComponentName].test.tsx`, `useTasks.test.tsx`
- **Run command**: `npm test` (backend, runs vitest); `npm test` inside `frontend/` (runs `vitest run`)
- **Mocking**:
  - Backend: `vi.mock('../db/db', ...)` with a `mockChain()` helper that makes Drizzle's builder pattern chainable. `vi.spyOn(service, ...)` used in unit tests.
  - Frontend: MSW 2 (`msw/node` + `setupServer`) intercepts real fetch calls; `vi.fn()` for component prop callbacks.
- **Integration test setup**: Backend integration tests use a real PostgreSQL DB via `DATABASE_URL` in `.env`; each test creates its own rows and cleans them in `afterEach` via `inArray` delete. Frontend integration is done via MSW — no test DB.
- **Test style**: Classical/Detroit style (real collaborators, only DB mocked). The `mockChain()` helper is duplicated across `tasks.service.unit.spec.ts` and `tasks.controller.unit.spec.ts`.

### Project Conventions
- **CLAUDE.md**: Absent. A `.claude/bee-state.local.md` is present indicating this feature (`task-priority-levels`) is in `triaged` phase.
- **Linting**: ESLint 9 (flat config, `eslint.config.mjs`) + Prettier (`.prettierrc`); both backend and frontend have separate ESLint configs.
- **Commit style**: Conventional commits (`feat:`, `refactor:`) based on git log.
- **Code patterns**:
  - DTOs use class-validator decorators; optional fields annotated `@IsOptional()` first, then type decorator, then constraints.
  - `updateTask` uses a `Record<string, unknown>` accumulator for partial updates — only defined fields are written.
  - `GetTasksQueryDto` uses `@Transform` for boolean coercion and `@Type(() => Number)` for numeric coercion from query strings.
  - Frontend `useTasks` uses optimistic updates with snapshot-based rollback for toggle and delete; `createTask` prepends to state.
  - All `TaskData` types flow from `/frontend/src/types/task.ts` — the single source of truth for the frontend shape.
  - MSW handlers in `handlers.ts` export `defaultTasks` array and `API` constant so tests can reuse them directly.
  - Frontend setup file (`test/setup.ts`) starts MSW with `onUnhandledRequest: 'error'` — any unhandled route will fail the test, enforcing explicit handler coverage.

### Change Area

**Backend — files to modify:**

1. `/Users/disha/task-management-api/src/db/schema.ts`
   - Add `priority` column: `pgEnum('task_priority', ['High', 'Medium', 'Low'])` + column with `.default('Medium').notNull()`.

2. `/Users/disha/task-management-api/drizzle/` (new migration file)
   - Run `drizzle-kit generate` after schema change to produce the migration SQL.

3. `/Users/disha/task-management-api/src/tasks/dto/create-task.dto.ts`
   - Add optional `priority?: 'High' | 'Medium' | 'Low'` with `@IsOptional()` + `@IsIn(['High', 'Medium', 'Low'])`.

4. `/Users/disha/task-management-api/src/tasks/dto/update-task.dto.ts`
   - Same addition as CreateTaskDto (optional priority field).

5. `/Users/disha/task-management-api/src/tasks/dto/get-tasks-query.dto.ts`
   - Add `priority?: 'High' | 'Medium' | 'Low'` filter field (mirrors the `completed` filter pattern).
   - Add `'priority'` to the `@IsIn(['title', 'createdAt'])` sortBy allowlist to enable sort-by-priority.

6. `/Users/disha/task-management-api/src/tasks/tasks.service.ts`
   - Destructure `priority` from query in `getTasks`; add `eq(tasks.priority, priority)` condition alongside the `completed` condition.
   - Extend the `sortColumn` selector to handle `sortBy === 'priority'`.
   - Pass `priority` in the `createTask` insert values block.
   - Add `if (dto.priority !== undefined) updateData.priority = dto.priority` in `updateTask`.

**Frontend — files to modify:**

7. `/Users/disha/task-management-api/frontend/src/types/task.ts`
   - Add `priority: 'High' | 'Medium' | 'Low'` to `TaskData` interface.

8. `/Users/disha/task-management-api/frontend/src/hooks/useTasks.ts`
   - Add `priority` parameter to `createTask(title, description?, priority?)` and include it in the POST body.

9. `/Users/disha/task-management-api/frontend/src/components/CreateTaskForm.tsx`
   - Add a `<select>` for priority with options High / Medium / Low (default Medium).
   - Thread priority through the `onSubmit` prop signature.

10. `/Users/disha/task-management-api/frontend/src/components/Task.tsx`
    - Add a priority badge alongside the existing completed badge (same `rounded-full px-2 py-0.5 text-xs font-semibold` pattern, different colors per level).

11. `/Users/disha/task-management-api/frontend/src/pages/TasksPage.tsx`
    - Optionally: add a priority filter control that passes a query param to `useTasks` (if `useTasks` is extended to accept filter params).

12. `/Users/disha/task-management-api/frontend/src/mocks/handlers.ts`
    - Add `priority: 'Medium'` to `defaultTasks` fixtures.
    - Update the POST handler to echo back the `priority` field from the request body.

**Integration points:**
- The `sortBy` union type in `GetTasksQueryDto` and the `sortColumn` switch in `tasks.service.ts` must be kept in sync.
- The `TaskData` interface in `frontend/src/types/task.ts` is consumed by `Task.tsx`, `TaskList.tsx`, `useTasks.ts`, all test `baseTask` fixtures, and MSW handlers — all must be updated together.
- The `CreateTaskForm` `onSubmit` prop signature is typed in both the component and its call site in `TasksPage.tsx` — changing the signature requires updating both.
- MSW `onUnhandledRequest: 'error'` means any new API shape (e.g., priority in POST body) must be explicitly handled in the mock — existing handler already echoes the body so it will pass through automatically, but `defaultTasks` fixtures need the new field added or TypeScript will complain.

**Cross-cutting concerns:**
- Auth: all task routes are behind `@UseGuards(JwtAuthGuard)` — no change needed.
- Validation: priority must be validated with `@IsIn` in all three DTOs; backend will reject invalid values automatically via `ValidationPipe`.
- DB migration: Drizzle uses file-based migrations in `/drizzle/`; `drizzle-kit generate` + `drizzle-kit migrate` required before integration tests pass.
- No caching or audit trail found.

### Existing Documentation
- **Specs**: None found in `docs/specs/`.
- **ADRs**: None found in `docs/adrs/`.
- **Other**: `README.md` present at root and in `frontend/`; `.claude/bee-state.local.md` records feature triage state (size: FEATURE, risk: MODERATE, current phase: triaged).

### Tidy Opportunities
- `mockChain()` helper is duplicated verbatim in `/Users/disha/task-management-api/src/tasks/tasks.service.unit.spec.ts` (line 47–54) and `/Users/disha/task-management-api/src/tasks/tasks.controller.unit.spec.ts` (line 48–53). Extracting it to a shared test utility (e.g., `src/test/mock-chain.ts`) would reduce duplication before adding new tests that will need it again.
- The initial SQL migration at `/Users/disha/task-management-api/drizzle/0000_productive_bromley.sql` only has `id` and `title` columns — it does not match the current schema (which also has `description`, `completed`, `createdAt`). The migration history appears incomplete or was never re-generated after schema growth. This should be confirmed before adding a new migration to avoid a broken migration chain.
- `makeTask()` factory is also duplicated across `tasks.service.unit.spec.ts` and `tasks.controller.unit.spec.ts` with identical shape — same extraction opportunity as `mockChain`.

### Design System
- **UI-involved**: yes
- **Has design system**: yes
- **Detected signals**:
  - Tailwind CSS 4 via `@tailwindcss/vite` plugin (`/Users/disha/task-management-api/frontend/vite.config.ts`, line 3)
  - `@import "tailwindcss"` in `/Users/disha/task-management-api/frontend/src/index.css`
  - All components use Tailwind utility classes exclusively (no CSS modules, no custom CSS beyond the base import)
  - Consistent badge pattern already established in `Task.tsx` (lines 26–34): `rounded-full px-2 py-0.5 text-xs font-semibold` with color variants via conditional class strings — priority badge should follow this exact pattern
  - Color vocabulary in use: `indigo-600` (primary actions), `green-100/700` (completed), `yellow-100/700` (incomplete), `red-50/500` (destructive/delete), `gray-*` (neutral/text). Priority badge colors should be chosen from complementary Tailwind palette values (e.g., `red-*` for High, `yellow-*` for Medium, `blue-*` for Low) that don't clash with the existing completed/incomplete badges.
  - No component library (no shadcn, MUI, Radix, etc.) — all components are hand-rolled with Tailwind.

### Developer Clarification Answers
- Priority filtering and sorting: **backend (query params)** — works correctly with pagination
- Priority required?: **optional, defaults to Medium** — tasks always have a priority; Medium if not specified

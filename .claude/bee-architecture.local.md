# Architecture — Task Priority Levels

## Decisions

### 1. DB column type: pgEnum
Use `pgEnum('task_priority', ['High', 'Medium', 'Low'])` in Drizzle schema. Constraint lives in the database, not just the DTO layer. Keep `@IsIn` in the DTO for a structured 400 before the DB is hit.

### 2. Slice order: no reorder needed
Current order is correct:
- Slice 1: DB + backend core
- Slice 2: Backend tests
- Slice 3: Frontend types + hook
- Slice 4: Frontend UI
- Slice 5: Frontend tests

Note: mockChain() and makeTask() extraction is already done (completed in the tidy step before spec). No additional tidy needed in Slice 2.

### 3. useTasks filter: direct parameter (not filters object)
Use `useTasks(priority?: 'High' | 'Medium' | 'Low')` — a direct named parameter, not a `filters` object wrapper. Avoids the object-identity trap in `useEffect` dependencies. Simpler to type. If a second filter is added later, introduce the object form then.

### 4. Migration strategy: regenerate from scratch (Path A)
The existing migration chain is broken — `0000_productive_bromley.sql` only records id+title, while the live schema has description, completed, createdAt, and users. The project is pre-production. Clean path:
1. Update schema.ts with full current schema + priority column
2. Delete drizzle/ directory contents (sql + meta/)
3. Run drizzle-kit generate
4. Run drizzle-kit migrate against a fresh local DB
5. Confirm integration tests pass

## Pattern
MVC (backend) / Feature-hook pattern (frontend) — unchanged from existing architecture.

## Files to create/modify
### Backend
- `src/db/schema.ts` — add pgEnum + priority column
- `drizzle/` — regenerate from scratch
- `src/tasks/dto/create-task.dto.ts` — add optional priority with @IsOptional() @IsIn()
- `src/tasks/dto/update-task.dto.ts` — same
- `src/tasks/dto/get-tasks-query.dto.ts` — add priority filter, add 'priority' to sortBy allowlist
- `src/tasks/tasks.service.ts` — filter/sort by priority, include in create/update
- `src/tasks/tasks.service.unit.spec.ts` — add priority test cases
- `src/tasks/tasks.service.mockist.spec.ts` — add priority interaction tests
- `src/tasks/tasks.controller.unit.spec.ts` — add priority test cases
- `src/tasks/tasks.controller.mockist.spec.ts` — add priority test cases
- `src/tasks/tasks.service.integration.spec.ts` — add integration test cases

### Frontend
- `frontend/src/types/task.ts` — add priority field to TaskData
- `frontend/src/hooks/useTasks.ts` — accept priority param, pass as query param
- `frontend/src/components/Task.tsx` — priority badge with PRIORITY_CLASSES lookup
- `frontend/src/components/CreateTaskForm.tsx` — priority select, update onSubmit signature
- `frontend/src/pages/TasksPage.tsx` — priorityFilter state, filter strip, wire to useTasks
- `frontend/src/mocks/handlers.ts` — add priority to defaultTasks fixtures
- `frontend/src/components/Task.test.tsx` — priority badge tests
- `frontend/src/components/CreateTaskForm.test.tsx` — priority select tests
- `frontend/src/pages/TasksPage.test.tsx` (or App.test.tsx) — filter strip tests
- `frontend/src/hooks/useTasks.test.tsx` — priority param + re-fetch tests

## Risk notes
- Object-identity `useEffect` trap avoided by using primitive param in useTasks
- All three DTOs must be updated together — partial update is incomplete without all three
- MSW `onUnhandledRequest: 'error'` means all fixtures must include the priority field or TypeScript will reject them

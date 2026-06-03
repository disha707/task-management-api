# Spec: Task Priority Levels

## Overview

Add a High / Medium / Low priority field to tasks so users can signal urgency. Priority is optional on create (defaults to Medium), filterable by query param on the backend, and visible as a color-coded badge on each task card with a toggle filter strip on the tasks page.

---

## Slice 1: DB + Backend Core

Add the priority enum and column to the schema, generate the migration, and wire priority through all DTOs, the service, and the controller.

### Schema

- [x] A `pgEnum('task_priority', ['High', 'Medium', 'Low'])` is defined in `src/db/schema.ts`
- [x] The `tasks` table has a `priority` column typed to that enum, with `.default('Medium').notNull()`
- [x] Running `drizzle-kit generate` produces a new migration file in `drizzle/` that adds the enum type and the column
- [x] Running `drizzle-kit migrate` (or the project's migrate command) applies the migration without error against a local PostgreSQL database

### DTOs

- [x] `CreateTaskDto` has an optional `priority` field decorated `@IsOptional()`, `@IsIn(['High', 'Medium', 'Low'])`
- [x] `UpdateTaskDto` has the same optional `priority` field with the same decorators
- [x] `GetTasksQueryDto` has an optional `priority` field decorated `@IsOptional()`, `@IsIn(['High', 'Medium', 'Low'])`
- [x] `GetTasksQueryDto.sortBy` accepts `'priority'` as a valid value (the `@IsIn` list becomes `['title', 'createdAt', 'priority']`)
- [x] Sending `priority: 'Critical'` in a POST or PATCH body returns a 400 response with a validation error message

### Service

- [x] `TasksService.createTask` inserts the `priority` value from the DTO into the new row; when `priority` is absent the stored value is `'Medium'`
- [x] `TasksService.updateTask` writes `priority` into the update accumulator only when `dto.priority !== undefined`, leaving the existing value untouched otherwise
- [x] `TasksService.getTasks` filters by `eq(tasks.priority, priority)` when `priority` is present in the query, analogous to the existing `completed` filter
- [x] `TasksService.getTasks` sorts by `tasks.priority` when `sortBy === 'priority'`, in the direction specified by `sortOrder`
- [x] When both `priority` filter and `completed` filter are supplied, both conditions are applied together (AND logic)

### Controller / API shape

```
POST   /tasks          body: { title, description?, priority? }
                       response: TaskRow (includes priority)

PATCH  /tasks/:id      body: { priority? }  (any subset of updatable fields)
                       response: TaskRow (includes priority)

GET    /tasks          query: ?priority=High&sortBy=priority&sortOrder=asc
                       response: { data: TaskRow[], meta: { ... } }
```

- [x] `GET /tasks` without a `priority` query param returns tasks of all priorities
- [x] `GET /tasks?priority=High` returns only tasks where priority is `'High'`
- [x] `GET /tasks?sortBy=priority&sortOrder=asc` returns tasks ordered Low → Medium → High (alphabetical ascending on the enum string)

---

## Slice 2: Backend Tests

Unit and integration test coverage for all priority behaviors added in Slice 1.

### Unit tests — TasksService (`tasks.service.unit.spec.ts`)

- [x] `createTask` with `priority: 'High'` passes `priority: 'High'` in the Drizzle insert values
- [x] `createTask` without `priority` passes `priority: undefined` (DB default applies)
- [x] `getTasks` with `{ priority: 'Low' }` in the query adds an `eq(tasks.priority, 'Low')` condition
- [x] `getTasks` without `priority` does not add a priority condition
- [x] `getTasks` with `{ sortBy: 'priority', sortOrder: 'asc' }` selects `tasks.priority` as the sort column
- [x] `updateTask` with `{ priority: 'Low' }` sets `updateData.priority = 'Low'`
- [x] `updateTask` without `priority` in the DTO does not set `updateData.priority`

### Unit tests — TasksController (`tasks.controller.unit.spec.ts` or `tasks.controller.mockist.spec.ts`)

- [x] `createTask` forwards `priority` from the DTO to `tasksService.createTask`
- [x] `getTasks` forwards `priority` query param to `tasksService.getTasks`

### Integration tests (`tasks.service.integration.spec.ts`)

- [x] Creating a task with `priority: 'High'` persists `'High'` and the returned row contains `priority: 'High'`
- [x] Creating a task without `priority` persists `'Medium'` and the returned row contains `priority: 'Medium'`
- [x] `getTasks({ priority: 'Low' })` returns only `'Low'` priority tasks when the test database contains tasks of mixed priority
- [x] `getTasks({ sortBy: 'priority', sortOrder: 'asc' })` returns rows in ascending priority order
- [x] `updateTask` with `{ priority: 'Low' }` changes the stored priority to `'Low'`
- [x] `updateTask` without `priority` leaves the existing priority unchanged
- [x] Sending `priority: 'Critical'` via the POST endpoint returns a 400 error (ValidationPipe rejects it)

---

## Slice 3: Frontend Types + Hook

Update the shared `TaskData` type and `useTasks` hook so the frontend correctly represents and transmits priority.

### `TaskData` interface (`frontend/src/types/task.ts`)

- [x] `TaskData` has a `priority: 'High' | 'Medium' | 'Low'` field (required, not optional — every task from the API will carry it)

### `useTasks` hook (`frontend/src/hooks/useTasks.ts`)

- [x] `createTask` accepts an optional third parameter: `priority?: 'High' | 'Medium' | 'Low'`
- [x] When `priority` is provided, it is included in the POST request body as `{ title, description, priority }`
- [x] When `priority` is omitted, it is not included in the POST body (the backend default applies)
- [x] `useTasks` accepts an optional `filters` object `{ priority?: 'High' | 'Medium' | 'Low' }` — when `priority` is present, the fetch URL includes `?priority=High` (or Medium/Low)
- [x] Changing the `filters.priority` value triggers a re-fetch and replaces the task list (no accumulation)
- [x] The loading state (`isLoading: true`) is set while the re-fetch caused by a filter change is in progress

### MSW handlers (`frontend/src/mocks/handlers.ts`)

- [x] `defaultTasks` fixtures each include a `priority` field (`'Medium'` for both existing fixtures) so they satisfy the updated `TaskData` type
- [x] The POST handler echoes `priority` from the request body (falls back to `'Medium'` when absent) in the created task response

---

## Slice 4: Frontend UI

Render the priority badge on task cards, add the priority select to the create form, and add the filter strip to the tasks page.

### Priority badge — `Task.tsx`

- [x] Each task card renders a `<span>` with the priority value ("High", "Medium", or "Low") as its text content
- [x] The badge uses `rounded-full px-2 py-0.5 text-xs font-semibold` (matching the existing status badge pattern)
- [x] High priority badge has classes `bg-red-100 text-red-700`
- [x] Medium priority badge has classes `bg-orange-100 text-orange-700`
- [x] Low priority badge has classes `bg-blue-100 text-blue-700`
- [x] The priority badge is rendered immediately after the completed/incomplete status badge, inside the same `flex items-center gap-2 flex-wrap` row
- [x] When a task is completed (title has `line-through`), the priority badge retains its full color — it is not dimmed
- [x] Priority colors are derived from a `PRIORITY_CLASSES` lookup object, not an inline ternary chain

### Priority select — `CreateTaskForm.tsx`

- [x] The form renders a `<select>` with `id="task-priority"` and `aria-label="Priority"`
- [x] The select has three `<option>` elements: `value="High"`, `value="Medium"`, `value="Low"` with matching display text
- [x] The select is initialized to `'Medium'` and is controlled state
- [x] The select is placed between the Description textarea and the "Add task" button
- [x] The select label reads "Priority", uses `htmlFor="task-priority"`, and has classes `mb-1 block text-sm font-medium text-gray-700`
- [x] The select element uses classes `w-full cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`
- [x] The `onSubmit` prop signature is `(title: string, description?: string, priority?: 'High' | 'Medium' | 'Low') => Promise<void>`
- [x] On submit, `onSubmit` is called with the currently selected priority value
- [x] After a successful submit, the select resets to `'Medium'`

### Priority filter strip — `TasksPage.tsx`

- [x] The page renders a `<div role="group" aria-label="Filter by priority">` containing four `<button>` elements: "All", "High", "Medium", "Low"
- [x] The filter strip is placed below the heading row and above `CreateTaskForm`
- [x] The button group has class `flex gap-2 mb-4`
- [x] Each button has `aria-pressed` set to `true` when it is the active filter and `false` otherwise
- [x] Clicking a priority button sets it as the active filter and triggers a re-fetch with `?priority=<value>`
- [x] Clicking "All" clears the priority filter and re-fetches without a priority query param
- [x] The default active filter is "All" on first render
- [x] An inactive button uses classes `rounded-full px-3 py-1 text-xs font-semibold text-gray-500 bg-white border border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-colors cursor-pointer`
- [x] The active "All" button uses classes `rounded-full px-3 py-1 text-xs font-semibold bg-indigo-600 text-white border border-indigo-600`
- [x] The active "High" button uses classes `rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 border border-red-200`
- [x] The active "Medium" button uses classes `rounded-full px-3 py-1 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200`
- [x] The active "Low" button uses classes `rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200`
- [x] During a filter-triggered re-fetch the loading skeleton (`animate-pulse`) is shown, consistent with the initial load behavior
- [x] `priorityFilter` state lives in `TasksPage` (local `useState`), not inside `useTasks`
- [x] `CreateTaskForm`'s `onSubmit` prop at the call site in `TasksPage` is updated to pass `priority` as the third argument to `createTask`

---

## Slice 5: Frontend Tests

Update existing tests that break due to the `TaskData` type change, and add new tests for every new behavior introduced in Slice 4.

### Updated fixtures

- [x] Every `baseTask` or `makeTask()` fixture in `*.test.tsx` and `*.test.ts` files includes `priority: 'Medium'` (or the relevant priority for the test) so TypeScript compiles and existing assertions still pass

### `Task.test.tsx` — priority badge

- [x] Renders a badge with text "High" and classes `bg-red-100 text-red-700` when `task.priority` is `'High'`
- [x] Renders a badge with text "Medium" and classes `bg-orange-100 text-orange-700` when `task.priority` is `'Medium'`
- [x] Renders a badge with text "Low" and classes `bg-blue-100 text-blue-700` when `task.priority` is `'Low'`
- [x] The priority badge is still present and has full color when `task.completed` is `true`

### `CreateTaskForm.test.tsx` — priority select

- [x] The priority select renders with label "Priority"
- [x] The select has "Medium" selected by default
- [x] Changing the select to "High" and submitting calls `onSubmit` with `(title, description, 'High')`
- [x] After a successful submit the select resets to "Medium"
- [x] The existing "shows validation error when title is too short" test still passes (priority select does not affect title validation)

### `TasksPage.test.tsx` — filter strip

- [x] The filter strip renders four buttons: "All", "High", "Medium", "Low"
- [x] "All" button has `aria-pressed="true"` on initial render; the other three have `aria-pressed="false"`
- [x] Clicking "High" sets `aria-pressed="true"` on "High" and `aria-pressed="false"` on "All"
- [x] Clicking "All" after "High" is active resets to `aria-pressed="true"` on "All"
- [x] The MSW GET handler in the test is updated (or overridden per-test) to handle requests with `?priority=High` and return a filtered subset

### `useTasks.test.tsx` — priority in hook

- [x] `createTask('Buy milk', undefined, 'High')` makes a POST request with body `{ title: 'Buy milk', priority: 'High' }`
- [x] `createTask('Buy milk')` makes a POST request without a `priority` key in the body
- [x] Passing `{ priority: 'Low' }` as the filter argument triggers a GET request to `?priority=Low`
- [x] Changing the filter from `'Low'` to `'High'` triggers a new GET request to `?priority=High`

---

## Out of Scope

- Editing priority on an existing task via the UI (UpdateTaskDto accepts it but no edit form is specified)
- Sort-by-priority UI control (backend supports it but no sort selector is added to the frontend)
- Dark mode
- Priority icons or visual indicators beyond text labels and badge color
- Pagination interaction with priority filter beyond what the existing backend query param layer already handles

---

## Technical Context

- Patterns to follow:
  - DTO field order: `@IsOptional()` first, then type decorator, then constraints (matches existing `completed` in `GetTasksQueryDto`)
  - Service partial-update accumulator: `if (dto.x !== undefined) updateData.x = dto.x` (matches existing `title`, `description`, `completed`)
  - Frontend badge: `PRIORITY_CLASSES` lookup object, same `rounded-full px-2 py-0.5 text-xs font-semibold` shell as the status badge
  - Frontend hook: `createTask` callback follows the existing `useCallback` + `setTasks(prev => [created, ...prev])` prepend pattern
  - MSW setup: `onUnhandledRequest: 'error'` is active — every new URL shape (e.g., `?priority=High`) must be handled in `handlers.ts` or overridden in the specific test
- Key dependencies:
  - `src/db/schema.ts` — single source of truth for the DB shape; must be changed before DTOs and service
  - `frontend/src/types/task.ts` — single source of truth for the frontend type; must be changed before any component or hook update
  - `CreateTaskForm` `onSubmit` prop — typed in both the component and its call site in `TasksPage.tsx`; both must be updated together
- Tidy opportunity (address before adding new tests):
  - `mockChain()` helper is duplicated in `tasks.service.unit.spec.ts` and `tasks.controller.unit.spec.ts`; extract to `src/test/mock-chain.ts` before writing new tests that will need it
  - `makeTask()` factory is similarly duplicated; extract alongside `mockChain()`
- Risk level: MODERATE

[ ] Reviewed

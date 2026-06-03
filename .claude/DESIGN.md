# Design Brief — Task Priority Levels

**Feature**: Add High / Medium / Low priority to tasks
**Scope**: Priority badge on Task cards, Priority select in CreateTaskForm, Priority filter on TasksPage
**Date**: 2026-06-03

---

## Existing Design System

**Framework**: Tailwind CSS 4 (`@import "tailwindcss"` via `@tailwindcss/vite` plugin). No component library. All components are hand-rolled with utility classes. No custom theme extensions — uses Tailwind's default scale throughout.

**Base font**: `system-ui, sans-serif` (set in `index.css`). No heading/body font split.

**Established color vocabulary**

| Token (semantic) | Tailwind classes | Used for |
|---|---|---|
| Primary | `bg-indigo-600`, `hover:bg-indigo-700`, `accent-indigo-600` | Buttons, checkbox accent, focus rings |
| Completed badge | `bg-green-100 text-green-700` | Status badge — completed state |
| Incomplete badge | `bg-yellow-100 text-yellow-700` | Status badge — incomplete state |
| Destructive | `hover:bg-red-50 hover:text-red-500` | Delete button hover |
| Neutral / text | `text-gray-800`, `text-gray-500`, `text-gray-400` | Body text, descriptions, placeholders |
| Surface | `bg-white`, `bg-gray-50` | Cards, page background |
| Borders | `border-gray-200`, `border-gray-300` | Card borders, input borders |

**Focus ring pattern**: `focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500` — applied consistently on all text inputs and textarea.

**Badge pattern** (established in `Task.tsx` lines 27–34):
```
rounded-full px-2 py-0.5 text-xs font-semibold
```
Color variants are applied as conditional class strings on the same element. The priority badge must follow this exact pattern.

**Card shell** (`Task.tsx` line 11):
```
flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm
```

**Spacing scale**: Tailwind default (4px base). In use: `gap-3`, `gap-2`, `p-4`, `px-2`, `py-0.5`, `mt-1`, `mb-3`, `mb-4`, `mb-6`, `mb-8`, `px-4`, `py-10`.

**Container**: `mx-auto max-w-2xl px-4` — single-column, centered, 672px max-width.

---

## Priority Colors

These three values are chosen to not clash with the existing green/yellow/red-adjacent palette. Red-700-on-red-100, orange-700-on-orange-100, and blue-700-on-blue-100 all exceed the WCAG AA 4.5:1 contrast ratio requirement for normal text.

| Priority level | Background | Text | Tailwind classes |
|---|---|---|---|
| High | `red-100` (#fee2e2) | `red-700` (#b91c1c) | `bg-red-100 text-red-700` |
| Medium | `orange-100` (#ffedd5) | `orange-700` (#c2410c) | `bg-orange-100 text-orange-700` |
| Low | `blue-100` (#dbeafe) | `blue-700` (#1d4ed8) | `bg-blue-100 text-blue-700` |

**Color-blind safety**: color alone is not the only signal — each badge also renders the label text ("High", "Medium", "Low"). No icon is required given the text label, but the text must always be present. Never rely on badge color alone.

**Clash check**: `red-100/700` for High does not clash with the delete button's `red-50/500` hover state because the delete button uses a lighter red and is only visible on hover; the priority badge is a persistent element in a different region of the card. No adjustment needed.

---

## 1. Priority Badge — `Task.tsx`

### Placement

Insert the priority badge immediately after the existing completed/incomplete badge, within the same `flex items-center gap-2 flex-wrap` row.

```
[ checkbox ]  [ title text ]  [ Completed | Incomplete badge ]  [ High | Medium | Low badge ]  →  [ delete button ]
```

Both badges sit in the `flex-wrap` row so they wrap gracefully on narrow viewports. The delete button remains in the far-right column (it is already `shrink-0`).

### Markup pattern

```tsx
<span
  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}
>
  {task.priority}
</span>
```

Where `priorityClass` is derived from a lookup — not inline ternary chains:

```ts
const PRIORITY_CLASSES: Record<'High' | 'Medium' | 'Low', string> = {
  High:   'bg-red-100 text-red-700',
  Medium: 'bg-orange-100 text-orange-700',
  Low:    'bg-blue-100 text-blue-700',
};
```

Badge label text is the priority value verbatim: "High", "Medium", "Low". No abbreviations, no icons.

### Completed-task state

When `task.completed` is true, the title gets `line-through text-gray-400`. The priority badge retains its full color — do not dim or mute it. Priority remains relevant metadata even on completed tasks.

---

## 2. Priority Select — `CreateTaskForm.tsx`

### Control type

Use a `<select>` element. The three options (High / Medium / Low) do not benefit from a segmented control at this density — a native select is consistent with the form's existing inputs, is keyboard-accessible by default, and works on all viewport widths within the `max-w-2xl` container.

### Placement

Insert the priority field between the Description textarea and the submit button. This preserves the natural top-to-bottom flow: required fields first (Title), optional fields next (Description, Priority), then the action.

```
[ Title input ]
[ Description textarea ]
[ Priority select ]       ← new
[ Add task button ]
```

### Label and default

- Label text: "Priority"
- `htmlFor` / `id`: `task-priority`
- Default selected option: "Medium"
- The `<select>` value is controlled state, initialized to `'Medium'`.
- All three options are always visible in the dropdown — no placeholder/empty option needed because Medium is always a valid selection.

### Styling

Match the existing input styling exactly:

```
w-full rounded-md border border-gray-300 px-3 py-2 text-sm
focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
```

Add `cursor-pointer` to reinforce interactivity. Wrap in the same `mb-4` div pattern used by Description:

```tsx
<div className="mb-4">
  <label htmlFor="task-priority" className="mb-1 block text-sm font-medium text-gray-700">
    Priority
  </label>
  <select
    id="task-priority"
    aria-label="Priority"
    value={priority}
    onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}
    className="w-full cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm
               focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
  >
    <option value="High">High</option>
    <option value="Medium">Medium</option>
    <option value="Low">Low</option>
  </select>
</div>
```

### Prop signature change

The `onSubmit` prop on `CreateTaskFormProps` must be extended to `(title: string, description?: string, priority?: 'High' | 'Medium' | 'Low') => Promise<void>`. The call site in `TasksPage.tsx` passes `createTask` directly — `createTask` in `useTasks.ts` must accept the same optional third parameter.

---

## 3. Priority Filter — `TasksPage.tsx`

### Control type

Use a group of three toggle buttons rendered as a horizontal pill strip (not a `<select>`). Rationale: the task list is already visible when filtering; a quick visual toggle is faster than a dropdown and makes the active selection immediately obvious without opening a menu. Three options fit comfortably in the `max-w-2xl` container alongside an "All" reset.

### Options

Four states: All (default) / High / Medium / Low. "All" clears the priority filter.

### Placement

Insert the filter strip between the page heading row and `CreateTaskForm`. This position follows the convention that filters/controls sit above the content they affect, and the form is an additive action below them.

```
[ Task Manager heading ]  [ Sign out ]
[ Priority filter strip ]              ← new
[ CreateTaskForm ]
[ error alert (conditional) ]
[ TaskList ]
```

### Visual design

The strip is a single `flex` row of four buttons. Use `mb-4` below the strip to maintain spacing rhythm before the form.

**Inactive button** (not selected):
```
rounded-full px-3 py-1 text-xs font-semibold text-gray-500 bg-white
border border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-colors cursor-pointer
```

**Active button** (currently selected filter):
```
rounded-full px-3 py-1 text-xs font-semibold
```
Active color matches the priority it represents:
- "All" active: `bg-indigo-600 text-white border border-indigo-600`
- "High" active: `bg-red-100 text-red-700 border border-red-200`
- "Medium" active: `bg-orange-100 text-orange-700 border border-orange-200`
- "Low" active: `bg-blue-100 text-blue-700 border border-blue-200`

The active priority buttons use the same palette as the badges — this creates a direct visual link between the filter selection and the badge color on each card.

### Accessibility

- Wrap the button group in a `<div role="group" aria-label="Filter by priority">`.
- Each button needs `aria-pressed={isActive}` so screen readers announce the active state.
- The selected button must have a visible focus ring (the existing `focus:ring-indigo-500` pattern applies).

### Strip layout

```tsx
<div role="group" aria-label="Filter by priority" className="flex gap-2 mb-4">
  {(['All', 'High', 'Medium', 'Low'] as const).map((level) => (
    <button
      key={level}
      aria-pressed={priorityFilter === level}
      onClick={() => setPriorityFilter(level)}
      className={level === priorityFilter ? activeClass(level) : inactiveClass}
    >
      {level}
    </button>
  ))}
</div>
```

### State and data flow

- Add `priorityFilter` state to `TasksPage` (local `useState`, not in `useTasks`).
- When `priorityFilter` is not "All", pass `priority=High` (or Medium/Low) as a query param to the fetch in `useTasks`.
- `useTasks` should accept an optional `filters` object (e.g., `{ priority?: 'High' | 'Medium' | 'Low' }`) and re-fetch when it changes. Use a `useEffect` dependency on the filter value.
- Changing the filter replaces the task list — no accumulation. Show the loading skeleton (`animate-pulse`) during the re-fetch, consistent with the initial load behavior.

---

## Responsive Behavior

The container is `max-w-2xl` (672px). All three new elements are designed within this constraint:

- **Badge row** (`flex-wrap`): already wraps — two badges side by side are ~130px combined, well within any card width above 320px.
- **Priority select**: `w-full` — fills the form column at all widths.
- **Filter strip**: four pill buttons at ~60px each = ~264px including gaps. Fits on a 375px phone without wrapping. If a future locale requires longer labels, wrap the group: add `flex-wrap` to the strip container.

---

## Accessibility Constraints

These apply across all three components:

1. **Contrast**: all badge and active-filter color pairs verified above WCAG AA 4.5:1.
2. **Color not sole signal**: every badge and filter button includes text labels ("High", "Medium", "Low") — color is reinforcement, not the only differentiator.
3. **Focus rings**: use the established `focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500` pattern on the select. Buttons in the filter strip must show visible focus (use `focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1`).
4. **Touch targets**: filter buttons use `px-3 py-1` — at `text-xs` this yields ~28px height. Increase to `py-1.5` to approach 32px; ensure the surrounding `gap-2` does not tighten the tap target. Note: 44px is the ideal minimum; these are secondary filter controls, but err toward larger padding on mobile.
5. **Keyboard navigation**: the `<select>` is keyboard-native. Filter buttons are `<button>` elements — all reachable via Tab, activated via Enter/Space.
6. **Screen reader**: `aria-pressed` on filter buttons, `aria-label="Priority"` on the select, `role="group"` with `aria-label="Filter by priority"` on the strip wrapper.
7. **`prefers-reduced-motion`**: the `transition-colors` on filter buttons is safe — it affects color, not movement. No additional `prefers-reduced-motion` guard needed for these components.

---

## What This Brief Does Not Cover

- Sort-by-priority UI (no sort control is requested in this feature scope)
- Editing priority on an existing task (not in scope — `UpdateTaskDto` accepts priority but no edit UI is specified)
- Dark mode (not present in the existing system)
- Pagination interaction with filters (handled by the backend query param layer; frontend re-fetches on filter change)

---

[ ] Reviewed

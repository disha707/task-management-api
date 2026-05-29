/**
 * Unit tests for the TaskList component.
 *
 * Scope:
 *   These tests verify that TaskList correctly composes Task components from an
 *   array of task data, delegates callbacks, and handles empty/loading states.
 *   No API calls are made — data is passed via props.
 *
 * Coverage:
 *   - Renders one Task card per item in the tasks array
 *   - Renders an empty-state message when the array is empty
 *   - Shows a loading skeleton when isLoading is true
 *   - Passes onToggle callback down to each Task
 *   - Passes onDelete callback down to each Task
 *
 * What is NOT covered:
 *   - Task component internals → Task.test.tsx
 *   - API fetching and hook behaviour → App.test.tsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskList } from './TaskList';
import type { TaskData } from '../types/task';

const makeTasks = (count: number): TaskData[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Task ${i + 1}`,
    description: null,
    completed: false,
    createdAt: '2024-01-01T00:00:00.000Z',
  }));

describe('TaskList', () => {
  it('renders one task card per item', () => {
    const tasks = makeTasks(3);
    render(<TaskList tasks={tasks} isLoading={false} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Task 3')).toBeInTheDocument();
  });

  it('renders an empty-state message when tasks array is empty', () => {
    render(<TaskList tasks={[]} isLoading={false} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('shows a loading indicator when isLoading is true', () => {
    render(<TaskList tasks={[]} isLoading={true} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument();
  });

  it('passes onToggle to each task card', async () => {
    const onToggle = vi.fn();
    const tasks = makeTasks(1);
    render(<TaskList tasks={tasks} isLoading={false} onToggle={onToggle} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('passes onDelete to each task card', async () => {
    const onDelete = vi.fn();
    const tasks = makeTasks(1);
    render(<TaskList tasks={tasks} isLoading={false} onToggle={vi.fn()} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith(1);
  });
});

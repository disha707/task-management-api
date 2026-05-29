/**
 * Unit tests for the Task component.
 *
 * Scope:
 *   These tests verify that the Task component renders task data correctly and
 *   handles user interactions. No API calls are made — the component receives
 *   data via props.
 *
 * Coverage:
 *   - Renders the task title
 *   - Renders the task description when present
 *   - Omits the description element when description is null
 *   - Shows a "Completed" badge when completed is true
 *   - Shows an "Incomplete" badge when completed is false
 *   - Calls onToggle with the task id when the checkbox is clicked
 *   - Calls onDelete with the task id when the delete button is clicked
 *
 * What is NOT covered:
 *   - API integration (fetch/useEffect) → App.test.tsx
 *   - TaskList composition → TaskList.test.tsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Task } from './Task';
import type { TaskData } from '../types/task';

const baseTask: TaskData = {
  id: 1,
  title: 'Write unit tests',
  description: 'Use React Testing Library',
  completed: false,
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('Task', () => {
  it('renders the task title', () => {
    render(<Task task={baseTask} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Write unit tests')).toBeInTheDocument();
  });

  it('renders the description when present', () => {
    render(<Task task={baseTask} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Use React Testing Library')).toBeInTheDocument();
  });

  it('does not render description element when description is null', () => {
    const task: TaskData = { ...baseTask, description: null };
    render(<Task task={task} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByTestId('task-description')).not.toBeInTheDocument();
  });

  it('shows "Completed" badge when completed is true', () => {
    const task: TaskData = { ...baseTask, completed: true };
    render(<Task task={task} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows "Incomplete" badge when completed is false', () => {
    render(<Task task={baseTask} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Incomplete')).toBeInTheDocument();
  });

  it('calls onToggle with task id when checkbox is clicked', async () => {
    const onToggle = vi.fn();
    render(<Task task={baseTask} onToggle={onToggle} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('calls onDelete with task id when delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(<Task task={baseTask} onToggle={vi.fn()} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});

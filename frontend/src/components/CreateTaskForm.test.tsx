/**
 * Unit tests for the CreateTaskForm component.
 *
 * Scope:
 *   These tests verify the form's rendering, client-side validation, and
 *   callback behaviour. The onSubmit prop is a vi.fn() — no API calls happen
 *   here; API integration is covered in useTasks.test.tsx.
 *
 * Coverage:
 *   - Renders a title input and a submit button
 *   - Renders an optional description textarea
 *   - Shows a validation error when title is empty on submit
 *   - Shows a validation error when title is fewer than 3 characters
 *   - Does not call onSubmit when validation fails
 *   - Calls onSubmit with trimmed title (and description) when input is valid
 *   - Clears the form fields after successful submission
 *   - Disables the submit button while submission is in flight
 *
 * What is NOT covered:
 *   - API calls triggered by submission → useTasks.test.tsx
 *   - Rendering inside the full App → App.test.tsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateTaskForm } from './CreateTaskForm';

describe('CreateTaskForm', () => {
  it('renders a title input and a submit button', () => {
    render(<CreateTaskForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('renders a description textarea', () => {
    render(<CreateTaskForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('shows a validation error when submitted with an empty title', async () => {
    render(<CreateTaskForm onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a validation error when title is shorter than 3 characters', async () => {
    render(<CreateTaskForm onSubmit={vi.fn()} />);

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'AB');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not call onSubmit when validation fails', async () => {
    const onSubmit = vi.fn();
    render(<CreateTaskForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with trimmed title when input is valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateTaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), '  Buy groceries  ');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(onSubmit).toHaveBeenCalledWith('Buy groceries', undefined);
  });

  it('calls onSubmit with description when both fields are filled', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateTaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Buy groceries');
    await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'Milk and eggs');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(onSubmit).toHaveBeenCalledWith('Buy groceries', 'Milk and eggs');
  });

  it('clears both fields after successful submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateTaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Buy groceries');
    await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'Milk and eggs');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('');
      expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue('');
    });
  });

  it('disables the submit button while submission is in flight', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    render(<CreateTaskForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Buy groceries');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();

    resolve();
  });
});

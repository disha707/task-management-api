import { type FormEvent, useState } from 'react';

interface CreateTaskFormProps {
  onSubmit: (title: string, description?: string) => Promise<void>;
}

export function CreateTaskForm({ onSubmit }: CreateTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setValidationError('Title must be at least 3 characters');
      return;
    }

    setValidationError('');
    setIsSubmitting(true);

    try {
      const trimmedDesc = description.trim() || undefined;
      await onSubmit(trimmedTitle, trimmedDesc);
      setTitle('');
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="task-title"
          aria-label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {validationError && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {validationError}
          </p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="task-description" className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="task-description"
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details..."
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Adding...' : 'Add task'}
      </button>
    </form>
  );
}

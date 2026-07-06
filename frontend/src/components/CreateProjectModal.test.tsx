import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateProjectModal from '@/components/CreateProjectModal';

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe('CreateProjectModal', () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when not open', () => {
    render(<CreateProjectModal open={false} onClose={onClose} onCreated={onCreated} />);
    expect(screen.queryByText('Create project')).not.toBeInTheDocument();
  });

  it('should render form when open', () => {
    render(<CreateProjectModal open={true} onClose={onClose} onCreated={onCreated} />);
    expect(screen.getByRole('heading', { name: 'Create project' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('project-slug')).toBeInTheDocument();
  });

  it('should call onClose when Cancel button clicked', () => {
    render(<CreateProjectModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose on Escape key', () => {
    render(<CreateProjectModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

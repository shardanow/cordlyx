import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusDot } from '@/components/features/StatusDot';
import { TypeBadge } from '@/components/features/TypeBadge';
import { AssigneePicker } from '@/components/features/AssigneePicker';
import { FilterBar, type FilterValues } from '@/components/features/FilterBar';
import { TagChip } from '@/components/features/Chips';
import type { ProjectMember } from '@/lib/project-data';

vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

const members: ProjectMember[] = [
  { id: 'm1', userId: 'u1', role: 'member', name: 'Alice', email: 'a@x.com', avatarUrl: 'https://x/a.png' },
  { id: 'm2', userId: 'u2', role: 'member', name: 'Bob', email: 'b@x.com', avatarUrl: null },
];

const baseValues: FilterValues = {
  search: '',
  debouncedSearch: '',
  typeId: '',
  statusId: '',
  priorityId: '',
  assigneeId: '',
  planId: '',
};

const baseData = {
  types: [{ id: 't1', name: 'Bug', color: '#EF4444', icon: 'bug' }],
  statuses: [{ id: 's1', name: 'Todo', color: '#6B7280', category: 'todo' }],
  priorities: [{ id: 'p1', name: 'High', color: '#F97316', icon: null }],
  members,
  plans: [{ id: 'pl1', name: 'R1', color: null }],
  tags: [
    { id: 'g1', name: 'frontend', color: '#3B82F6' },
    { id: 'g2', name: 'plain', color: null },
  ],
};

describe('StatusDot', () => {
  it('renders the given color', () => {
    const { container } = render(<StatusDot color="#ff0000" />);
    expect(container.firstChild).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('falls back to a neutral color', () => {
    const { container } = render(<StatusDot />);
    expect(container.firstChild).toHaveStyle({ backgroundColor: '#7b8498' });
  });
});

describe('TypeBadge', () => {
  it('renders icon and name in type color', () => {
    const { container } = render(<TypeBadge icon="bug" color="#EF4444" name="Bug" />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ color: '#EF4444' });
  });
});

describe('AssigneePicker', () => {
  it('shows the current assignee photo and name', () => {
    render(<AssigneePicker value="u1" members={members} onChange={() => {}} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://x/a.png');
  });

  it('shows Unassigned when empty and selects a member', () => {
    const onChange = vi.fn();
    render(<AssigneePicker value="" members={members} onChange={onChange} />);
    fireEvent.click(screen.getByText('Unassigned'));
    fireEvent.click(screen.getByText('Bob'));
    expect(onChange).toHaveBeenCalledWith('u2');
  });
});

describe('FilterBar', () => {
  const renderBar = (props: Partial<React.ComponentProps<typeof FilterBar>> = {}) =>
    render(
      <FilterBar
        values={baseValues}
        onSearch={() => {}}
        onClearSearch={() => {}}
        onChange={() => {}}
        data={baseData}
        {...props}
      />,
    );

  it('renders search and all filters with type icons', () => {
    renderBar();
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
    expect(screen.getByText('Type: All')).toBeInTheDocument();
    expect(screen.getByText('Status: All')).toBeInTheDocument();
  });

  it('emits filter changes', () => {
    const onChange = vi.fn();
    renderBar({ onChange });
    fireEvent.click(screen.getByText('Status: All'));
    fireEvent.click(screen.getByText('Todo'));
    expect(onChange).toHaveBeenCalledWith({ statusId: 's1' });
  });

  it('hides status filter when showStatus is false (board)', () => {
    renderBar({ showStatus: false, layout: 'row' });
    expect(screen.queryByText('Status: All')).not.toBeInTheDocument();
    expect(screen.getByText('Type: All')).toBeInTheDocument();
  });

  it('shows member photos in assignee options', () => {
    renderBar();
    fireEvent.click(screen.getByText('Assignee: All'));
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://x/a.png');
  });

  it('toggles tag filter via checkboxes', () => {
    const onChange = vi.fn();
    renderBar({ onChange });
    fireEvent.click(screen.getByText('Tags: All'));
    fireEvent.click(screen.getByText('frontend'));
    expect(onChange).toHaveBeenCalledWith({ tagIds: ['g1'] });
  });
});

describe('TagChip', () => {
  it('renders a pill with fallback background when colorless', () => {
    const { container } = render(<TagChip tag={{ id: 'g2', name: 'plain', color: null }} small />);
    const pill = container.firstChild as HTMLElement;
    expect(pill).toHaveTextContent('plain');
    expect(pill.className).toMatch(/rounded-full/);
    expect(pill.className).toMatch(/bg-muted/);
  });

  it('tints the pill in the tag color', () => {
    const { container } = render(<TagChip tag={{ id: 'g1', name: 'frontend', color: '#3B82F6' }} small />);
    expect(container.firstChild).toHaveStyle({ color: '#3B82F6' });
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AvatarCircle } from '@/components/features/AvatarCircle';

describe('AvatarCircle', () => {
  it('renders the photo when avatarUrl is set', () => {
    render(<AvatarCircle name="Alice" avatarUrl="https://example.com/a.png" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.png');
    expect(img).toHaveAttribute('alt', 'Alice');
  });

  it('renders the initial letter when avatarUrl is missing', () => {
    const { container } = render(<AvatarCircle name="bob" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toBe('B');
  });

  it('renders the initial letter when avatarUrl is null', () => {
    const { container } = render(<AvatarCircle name="Bob" avatarUrl={null} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toBe('B');
  });
});

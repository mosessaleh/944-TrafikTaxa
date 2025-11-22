import React from 'react';
import { render, screen } from '@testing-library/react';
import Alert from '../../components/alert';

describe('Alert', () => {
  it('renders title and message', () => {
    render(<Alert title="Test Title" message="Test Message" />);

    expect(screen.getByText('Test Title')).toBeTruthy();
    expect(screen.getByText('Test Message')).toBeTruthy();
  });

  it('renders action when provided', () => {
    const action = <button>Click me</button>;
    render(<Alert title="Test Title" message="Test Message" action={action} />);

    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('does not render action when not provided', () => {
    render(<Alert title="Test Title" message="Test Message" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has correct CSS classes', () => {
    const { container } = render(<Alert title="Test Title" message="Test Message" />);

    const alertDiv = container.firstChild as HTMLElement;
    expect(alertDiv.className).toContain('border');
    expect(alertDiv.className).toContain('rounded-2xl');
    expect(alertDiv.className).toContain('p-4');
    expect(alertDiv.className).toContain('bg-yellow-50');
    expect(alertDiv.className).toContain('text-yellow-900');
  });

  it('renders title with font-semibold class', () => {
    render(<Alert title="Test Title" message="Test Message" />);

    const titleElement = screen.getByText('Test Title');
    expect(titleElement.className).toContain('font-semibold');
  });

  it('renders message with text-sm and mt-1 classes', () => {
    render(<Alert title="Test Title" message="Test Message" />);

    const messageElement = screen.getByText('Test Message');
    expect(messageElement.className).toContain('text-sm');
    expect(messageElement.className).toContain('mt-1');
  });
});
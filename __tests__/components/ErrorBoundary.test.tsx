import React from 'react';
import { render } from '@testing-library/react';
import ErrorBoundary from '../../components/error-boundary';

const ThrowError = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    expect(getByText('Test content')).toBeTruthy();
  });

  it('renders fallback UI when there is an error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText(/We encountered an unexpected error/)).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;
    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(getByText('Custom error message')).toBeTruthy();
  });

  it('displays error details in collapsed details element', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    const details = getByText('Error details');
    expect(details).toBeTruthy();
    expect(getByText('Test error')).toBeTruthy();
  });
});
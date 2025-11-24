import { useState, useEffect } from 'react';

/**
 * React hook for CSRF token management
 * Automatically fetches and manages CSRF tokens for authenticated users
 */
export function useCSRF() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCSRFToken();
  }, []);

  const fetchCSRFToken = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/csrf', {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, this is expected
          setCsrfToken(null);
          return;
        }
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.csrfToken) {
        setCsrfToken(data.csrfToken);
      } else {
        throw new Error('Invalid CSRF token response');
      }
    } catch (err) {
      console.error('CSRF token fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCsrfToken(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = () => {
    return fetchCSRFToken();
  };

  return {
    csrfToken,
    loading,
    error,
    refreshToken,
  };
}
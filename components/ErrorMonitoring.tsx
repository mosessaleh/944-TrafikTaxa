'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function ErrorMonitoring() {
  useEffect(() => {
    // Initialize Sentry with basic configuration
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 1.0,
      // Remove replay integration for now as it's not available in this version
    });

    // Global error handler
    const handleError = (event: ErrorEvent) => {
      Sentry.captureException(event.error, {
        tags: {
          component: 'global_error_handler',
          type: 'javascript_error',
        },
        extra: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      Sentry.captureException(event.reason, {
        tags: {
          component: 'global_error_handler',
          type: 'unhandled_promise_rejection',
        },
        extra: {
          reason: event.reason,
        },
      });
    };

    // Enhanced performance monitoring
    const handlePerformance = () => {
      if ('performance' in window && 'getEntriesByType' in window.performance) {
        // Monitor navigation timing
        const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          Sentry.captureMessage('Page Load Performance', {
            level: 'info',
            tags: {
              type: 'performance',
              metric: 'navigation_timing',
            },
            extra: {
              loadTime: navigation.loadEventEnd - navigation.loadEventStart,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              firstPaint: navigation.responseStart - navigation.requestStart,
              domInteractive: navigation.domInteractive - navigation.fetchStart,
              firstContentfulPaint: navigation.responseStart - navigation.fetchStart,
            },
          });
        }

        // Monitor resource loading
        const resources = window.performance.getEntriesByType('resource');
        const slowResources = resources.filter(entry => entry.duration > 1000); // Resources taking >1s
        if (slowResources.length > 0) {
          Sentry.captureMessage('Slow Resource Loading', {
            level: 'warning',
            tags: {
              type: 'performance',
              metric: 'slow_resources',
            },
            extra: {
              count: slowResources.length,
              resources: slowResources.map(r => ({
                name: r.name,
                duration: r.duration,
                size: (r as any).transferSize || 0,
              })),
            },
          });
        }

        // Monitor long tasks
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Long task >50ms
              Sentry.captureMessage('Long Task Detected', {
                level: 'warning',
                tags: {
                  type: 'performance',
                  metric: 'long_task',
                },
                extra: {
                  duration: entry.duration,
                  startTime: entry.startTime,
                },
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      }
    };

    // Set up event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Initialize performance monitoring
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handlePerformance);
    } else {
      handlePerformance();
    }

    // User feedback integration
    const handleUserFeedback = (feedback: any) => {
      Sentry.captureMessage('User Feedback', {
        level: 'info',
        tags: {
          type: 'user_feedback',
        },
        extra: feedback,
      });
    };

    // Expose feedback function globally
    (window as any).submitUserFeedback = handleUserFeedback;

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      document.removeEventListener('DOMContentLoaded', handlePerformance);
    };
  }, []);

  return null;
}
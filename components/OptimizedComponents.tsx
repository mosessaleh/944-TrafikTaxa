'use client';

import React, { lazy, Suspense, ComponentType } from 'react';
import Image from 'next/image';

// Error Boundary for Lazy Loading
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-64 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-gray-500 mb-2">Failed to load component</p>
              <button 
                onClick={() => this.setState({ hasError: false })}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Loading Components
export const SkeletonLoader = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="bg-gray-200 rounded-lg h-4 mb-2"></div>
    <div className="bg-gray-200 rounded-lg h-3 w-3/4"></div>
  </div>
);

export const BookingFormSkeleton = () => (
  <div className="space-y-6">
    <SkeletonLoader className="h-12 w-full" />
    <SkeletonLoader className="h-12 w-full" />
    <SkeletonLoader className="h-12 w-full" />
    <SkeletonLoader className="h-12 w-1/2" />
    <SkeletonLoader className="h-12 w-1/3" />
  </div>
);

export const AccountSkeleton = () => (
  <div className="space-y-6">
    {/* Profile Section */}
    <div className="bg-white rounded-lg p-6 border">
      <div className="flex items-center space-x-4 mb-4">
        <SkeletonLoader className="w-16 h-16 rounded-full" />
        <div className="space-y-2">
          <SkeletonLoader className="h-6 w-32" />
          <SkeletonLoader className="h-4 w-48" />
        </div>
      </div>
    </div>

    {/* Bookings Section */}
    <div className="bg-white rounded-lg p-6 border">
      <SkeletonLoader className="h-8 w-24 mb-4" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border rounded-lg">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <SkeletonLoader className="h-5 w-48" />
                <SkeletonLoader className="h-4 w-32" />
                <SkeletonLoader className="h-4 w-40" />
              </div>
              <SkeletonLoader className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="bg-white rounded-lg p-6 border">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-8 w-16" />
          </div>
          <SkeletonLoader className="w-12 h-12 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

// Lazy Loading Wrapper Component
export const LazyWrapper = ({ 
  children, 
  fallback = <SkeletonLoader className="h-32 w-full" />
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) => (
  <LazyErrorBoundary fallback={fallback}>
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  </LazyErrorBoundary>
);

// Performance-optimized component factories
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const LazyComponent = lazy(importFunc);
  
  return (props: React.ComponentProps<T>) => (
    <LazyWrapper>
      <LazyComponent {...props} />
    </LazyWrapper>
  );
}

// Preloading utility for critical components
export function preloadComponent(importFunc: () => Promise<any>) {
  // Only preload in browser environment
  if (typeof window !== 'undefined') {
    // Preload with slight delay to avoid blocking critical resources
    setTimeout(() => {
      importFunc().catch(console.error);
    }, 100);
  }
}

// HOC for performance monitoring
export function withPerformanceMonitoring<T extends ComponentType<any>>(Component: T) {
  return function PerformanceMonitoredComponent(props: React.ComponentProps<T>) {
    const startTime = React.useRef<number | undefined>(undefined);
    
    React.useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        startTime.current = performance.now();
        
        return () => {
          if (startTime.current) {
            const endTime = performance.now();
            const renderTime = endTime - startTime.current;
            console.log(`${Component.displayName || Component.name || 'Component'} render time: ${renderTime.toFixed(2)}ms`);
          }
        };
      }
    }, []);

    return <Component {...props} />;
  } as T;
}

// Optimized image wrapper with lazy loading
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  quality?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  quality = 85,
  ...props
}) => {
  if (!src || !alt) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      sizes={sizes}
      quality={quality}
      loading={priority ? 'eager' : 'lazy'}
      {...props}
    />
  );
};

// Enhanced component for heavy admin sections
// Note: AdminComponents removed to avoid server component import issues in client context
// export const AdminComponents = { ... };

// Utility for conditionally loading components based on user role
export function createRoleBasedComponent<T extends ComponentType<any>>(
  Component: T,
  requiredRole?: string,
  fallback?: React.ComponentType
) {
  return function RoleBasedComponent(props: React.ComponentProps<T> & { userRole?: string }) {
    const { userRole, ...componentProps } = props;
    
    if (requiredRole && userRole !== requiredRole) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent />;
      }
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">Access denied</p>
        </div>
      );
    }

    return <Component {...(componentProps as any)} />;
  };
}

// Hook for intersection observer (for lazy loading trigger)
export function useIntersectionObserver(
  callback: () => void,
  options: IntersectionObserverInit = {}
) {
  const targetRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const target = targetRef.current;
    if (!target || !('IntersectionObserver' in window)) {
      callback(); // Fallback: execute immediately
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        callback();
        observer.unobserve(target);
      }
    }, options);

    observer.observe(target);

    return () => observer.disconnect();
  }, [callback, options]);

  return targetRef;
}

// Virtual scrolling utility for large lists
export function createVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(window.scrollY / itemHeight));
  const endIndex = Math.min(items.length, startIndex + visibleCount + 1);
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    offsetY,
    startIndex,
    endIndex,
    totalHeight: items.length * itemHeight,
  };
}

// Performance utility hook
export function usePerformanceMonitor(componentName: string) {
  const startTime = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      startTime.current = performance.now();
      
      return () => {
        if (startTime.current) {
          const endTime = performance.now();
          const renderTime = endTime - startTime.current;
          console.log(`⚡ ${componentName} render time: ${renderTime.toFixed(2)}ms`);
        }
      };
    }
  }, [componentName]);

  return { renderTime: startTime.current };
}

// Export default performance utils
export default {
  LazyWrapper,
  SkeletonLoader,
  BookingFormSkeleton,
  AccountSkeleton,
  DashboardSkeleton,
  OptimizedImage,
  preloadComponent,
  withPerformanceMonitoring,
  createLazyComponent,
  createRoleBasedComponent,
  useIntersectionObserver,
  createVirtualList,
  usePerformanceMonitor,
};
import React from 'react';
import { render } from '@testing-library/react';
import { SkeletonLoader, BookingFormSkeleton, AccountSkeleton, DashboardSkeleton } from '../../components/OptimizedComponents';

describe('SkeletonLoader', () => {
  it('renders with default classes', () => {
    const { container } = render(<SkeletonLoader />);

    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('animate-pulse');
    expect(div.innerHTML).toContain('bg-gray-200');
    expect(div.innerHTML).toContain('rounded-lg');
    expect(div.innerHTML).toContain('h-4');
    expect(div.innerHTML).toContain('mb-2');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonLoader className="custom-class" />);

    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('animate-pulse');
    expect(div.className).toContain('custom-class');
  });
});

describe('BookingFormSkeleton', () => {
  it('renders skeleton structure for booking form', () => {
    const { container } = render(<BookingFormSkeleton />);

    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('space-y-6');

    // Should have 5 skeleton loaders
    const skeletonLoaders = div.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletonLoaders.length).toBe(5);
  });
});

describe('AccountSkeleton', () => {
  it('renders skeleton structure for account page', () => {
    const { container } = render(<AccountSkeleton />);

    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('space-y-6');

    // Should have profile and bookings sections
    const sections = div.querySelectorAll('[class*="bg-white"]');
    expect(sections.length).toBe(2);

    // Profile section should have avatar skeleton
    const profileSection = sections[0];
    const avatarSkeleton = profileSection.querySelector('[class*="w-16"][class*="h-16"]');
    expect(avatarSkeleton).toBeTruthy();

    // Bookings section should have multiple booking skeletons
    const bookingsSection = sections[1];
    const bookingItems = bookingsSection.querySelectorAll('[class*="p-4"][class*="border"]');
    expect(bookingItems.length).toBe(3);
  });
});

describe('DashboardSkeleton', () => {
  it('renders skeleton structure for dashboard', () => {
    const { container } = render(<DashboardSkeleton />);

    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('grid');
    expect(div.className).toContain('grid-cols-1');
    expect(div.className).toContain('md:grid-cols-2');
    expect(div.className).toContain('lg:grid-cols-3');
    expect(div.className).toContain('gap-6');

    // Should have 6 dashboard cards
    const cards = div.querySelectorAll('[class*="bg-white"]');
    expect(cards.length).toBe(6);
  });
});
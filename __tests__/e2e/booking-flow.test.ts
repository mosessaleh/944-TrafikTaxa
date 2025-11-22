import { test, expect } from '@playwright/test';

test.describe('Booking Flow E2E Tests', () => {
  test('should complete a full booking flow', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Click on book button/link
    const bookLink = page.locator('a[href="/book"], button').filter({ hasText: /book|حجز/i }).first();
    await expect(bookLink).toBeVisible();
    await bookLink.click();

    // Wait for booking page to load
    await page.waitForURL('**/book');
    await expect(page).toHaveURL(/\/book/);

    // Fill out booking form
    // Note: This is a basic test structure - actual form fields may vary
    const pickupInput = page.locator('input[placeholder*="pickup" i], input[name*="pickup" i]').first();
    if (await pickupInput.isVisible()) {
      await pickupInput.fill('Copenhagen Central Station');
    }

    const dropoffInput = page.locator('input[placeholder*="dropoff" i], input[name*="dropoff" i]').first();
    if (await dropoffInput.isVisible()) {
      await dropoffInput.fill('Copenhagen Airport');
    }

    // Select passengers
    const passengerSelect = page.locator('select[name*="passenger" i], input[name*="passenger" i]').first();
    if (await passengerSelect.isVisible()) {
      await passengerSelect.selectOption('2');
    }

    // Submit booking form
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /book|حجز|continue/i }).first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for next step or confirmation
    await page.waitForTimeout(2000); // Allow time for any async operations

    // Check if we progressed in the flow (either payment page or confirmation)
    const currentURL = page.url();
    const isOnPaymentPage = currentURL.includes('/pay') || currentURL.includes('payment');
    const hasBookingConfirmation = await page.locator('text=/booking.*confirm|حجز.*تأكيد/i').isVisible().catch(() => false);

    // Either we should be on payment page or see booking confirmation
    expect(isOnPaymentPage || hasBookingConfirmation).toBe(true);
  });

  test('should handle form validation errors', async ({ page }) => {
    await page.goto('/book');

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /book|حجز|continue/i }).first();

    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Wait for validation messages
      await page.waitForTimeout(1000);

      // Check for validation errors (either visible error messages or form still present)
      const hasErrors = await page.locator('text=/required|error|خطأ|مطلوب/i').isVisible().catch(() => false);
      const stillOnForm = await page.locator('form').isVisible().catch(() => false);

      expect(hasErrors || stillOnForm).toBe(true);
    }
  });

  test('should navigate between pages correctly', async ({ page }) => {
    // Test navigation to different sections
    await page.goto('/');

    // Check main navigation links exist
    const navLinks = [
      { href: '/', text: /home|الرئيسية/i },
      { href: '/book', text: /book|حجز/i },
      { href: '/pricing', text: /pricing|الأسعار/i },
      { href: '/contact', text: /contact|اتصل/i }
    ];

    for (const { href, text } of navLinks) {
      const link = page.locator(`a[href="${href}"]`).filter({ hasText: text });
      if (await link.isVisible()) {
        await link.click();
        await page.waitForURL(href === '/' ? '/' : `**${href}`);
        expect(page.url()).toMatch(href === '/' ? /\/$/ : new RegExp(href));
        await page.goto('/'); // Go back to home
      }
    }
  });

  test('should handle responsive design', async ({ page }) => {
    await page.goto('/');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Check if mobile menu exists or navigation is still accessible
    const mobileMenu = page.locator('button[aria-label*="menu" i], .mobile-menu, [data-testid="mobile-menu"]');
    const hasMobileMenu = await mobileMenu.isVisible().catch(() => false);

    // On mobile, either mobile menu should exist or navigation should be accessible
    if (hasMobileMenu) {
      await mobileMenu.click();
      const mobileNav = page.locator('nav, .mobile-nav, [role="navigation"]');
      await expect(mobileNav).toBeVisible();
    }

    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);

    // Desktop navigation should be visible
    const desktopNav = page.locator('nav:not(.mobile-nav), header nav');
    const navExists = await desktopNav.isVisible().catch(() => false);
    expect(navExists).toBe(true);
  });

  test('should handle geolocation features', async ({ page, context }) => {
    // Mock geolocation API
    await context.grantPermissions(['geolocation']);

    // Mock geolocation position
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: {
            latitude: 55.6761,
            longitude: 12.5683,
            accuracy: 100,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        } as GeolocationPosition);
      };
    });

    await page.goto('/book');

    // Wait for the page to load
    await page.waitForSelector('#trip-map');

    // Click the current location button
    const locationButton = page.locator('button').filter({ hasText: 'Use my location' });
    await expect(locationButton).toBeVisible();
    await locationButton.click();

    // Wait for location to be set
    await page.waitForTimeout(2000);

    // Check if pickup field has been filled
    const pickupInput = page.locator('input[name="pickup"]');
    const pickupValue = await pickupInput.inputValue();
    expect(pickupValue.length).toBeGreaterThan(0);

    // Check if map shows current location marker
    const mapContainer = page.locator('#trip-map');
    await expect(mapContainer).toBeVisible();
  });

  test('should allow map-based location selection', async ({ page }) => {
    await page.goto('/book');

    // Wait for the map to load
    await page.waitForSelector('#trip-map');

    // Click on the map (simulate clicking at coordinates)
    const mapContainer = page.locator('#trip-map');
    await mapContainer.click({
      position: { x: 100, y: 100 }
    });

    // Wait for location processing
    await page.waitForTimeout(2000);

    // Check if pickup field has been filled
    const pickupInput = page.locator('input[name="pickup"]');
    const pickupValue = await pickupInput.inputValue();
    expect(pickupValue.length).toBeGreaterThan(0);
  });

  test('should handle location permission denied', async ({ page, context }) => {
    // Deny geolocation permission
    await context.clearPermissions();
    // Don't grant geolocation permission

    await page.goto('/book');

    // Click the current location button
    const locationButton = page.locator('button').filter({ hasText: 'Use my location' });
    await expect(locationButton).toBeVisible();
    await locationButton.click();

    // Wait for error message
    await page.waitForTimeout(1000);

    // Check for error message
    const errorMessage = page.locator('text=/Location access denied/i');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(true);
  });
});
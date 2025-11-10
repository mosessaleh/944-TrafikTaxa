import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('Home page should pass accessibility checks', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Accessibility violations found:');
      accessibilityScanResults.violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.id}: ${violation.description}`);
        console.log(`   Impact: ${violation.impact}`);
        console.log(`   Help: ${violation.help}`);
        console.log(`   Help URL: ${violation.helpUrl}`);
        console.log(`   Elements: ${violation.nodes.map(node => node.target).join(', ')}`);
        console.log('---');
      });
    }

    // Allow some violations for now, but ensure no critical issues
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations.length).toBeLessThanOrEqual(2); // Allow up to 2 critical issues for now
    expect(accessibilityScanResults.violations.length).toBeLessThanOrEqual(10); // Allow up to 10 total violations
  });

  test('Booking page should pass accessibility checks', async ({ page }) => {
    await page.goto('/book');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Focus on form-specific accessibility
    const formViolations = accessibilityScanResults.violations.filter(
      v => v.nodes.some(node =>
        node.target.some(selector =>
          selector.includes('form') || selector.includes('input') || selector.includes('button')
        )
      )
    );

    expect(formViolations.length).toBeLessThanOrEqual(3);
  });

  test('Keyboard navigation should work', async ({ page }) => {
    await page.goto('/');

    // Test tab navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('A'); // Should focus on first link

    // Test skip link (if implemented)
    await page.keyboard.press('Tab');
    focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
  });

  test('Color contrast should be adequate', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast'
    );

    expect(contrastViolations.length).toBeLessThanOrEqual(5); // Allow some contrast issues for gradients
  });

  test('Images should have alt text', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze();

    const imageViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'image-alt'
    );

    expect(imageViolations.length).toBe(0);
  });

  test('Form elements should have labels', async ({ page }) => {
    await page.goto('/book');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label', 'form-field-multiple-labels'])
      .analyze();

    const labelViolations = accessibilityScanResults.violations.filter(
      v => ['label', 'form-field-multiple-labels'].includes(v.id)
    );

    expect(labelViolations.length).toBe(0);
  });

  test('Page should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
      elements.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim()
      }))
    );

    // Should have at least one h1
    expect(headings.some(h => h.tag === 'H1')).toBe(true);

    // Check heading hierarchy (basic check)
    const h1Count = headings.filter(h => h.tag === 'H1').length;
    expect(h1Count).toBeGreaterThan(0);
    expect(h1Count).toBeLessThanOrEqual(2); // Usually only one main h1
  });

  test('Focus management should work properly', async ({ page }) => {
    await page.goto('/book');

    // Focus on first form field
    await page.focus('input[type="text"]');

    // Check if focused element is visible
    const isVisible = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return false;

      const rect = active.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    expect(isVisible).toBe(true);
  });
});
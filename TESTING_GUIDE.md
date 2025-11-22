# دليل الاختبارات - Testing Guide

## نظرة عامة - Overview

يحتوي مشروع 944-TrafikTaxa على نظام اختبارات شامل يغطي جميع المستويات من الاختبارات: الوحدات، المكونات، التكامل، والنهاية إلى النهاية.

The 944-TrafikTaxa project includes a comprehensive testing system covering all levels: unit tests, component tests, integration tests, and end-to-end tests.

## أنواع الاختبارات - Test Types

### 1. اختبارات الوحدات - Unit Tests
- **الموقع**: `__tests__/lib/`
- **الأدوات**: Jest + React Testing Library
- **الغرض**: اختبار الوظائف الفردية والمنطق التجاري
- **الأمثلة**:
  - `price.test.ts` - اختبار منطق حساب الأسعار
  - `crypto.test.ts` - اختبار وظائف العملات المشفرة
  - `validation.test.ts` - اختبار قواعد التحقق

### 2. اختبارات المكونات - Component Tests
- **الموقع**: `__tests__/components/`
- **الأدوات**: Jest + React Testing Library
- **الغرض**: اختبار مكونات React الفردية
- **الأمثلة**:
  - `Alert.test.tsx` - اختبار مكون التنبيهات
  - `OptimizedComponents.test.tsx` - اختبار المكونات المحسنة

### 3. اختبارات النهاية إلى النهاية - E2E Tests
- **الموقع**: `__tests__/e2e/`
- **الأدوات**: Playwright
- **الغرض**: اختبار التدفقات الكاملة من منظور المستخدم
- **الأمثلة**:
  - `booking-flow.test.ts` - اختبار تدفق الحجز الكامل
  - `accessibility.test.ts` - اختبارات إمكانية الوصول

## تشغيل الاختبارات - Running Tests

### جميع الاختبارات - All Tests
```bash
yarn test
```

### اختبارات الوحدات فقط - Unit Tests Only
```bash
yarn test --testPathPatterns="lib|components"
```

### اختبارات E2E - E2E Tests
```bash
yarn test:e2e
```

### اختبارات E2E مع واجهة رسومية - E2E Tests with UI
```bash
yarn test:e2e:ui
```

### اختبارات E2E في وضع التصحيح - E2E Tests in Debug Mode
```bash
yarn test:e2e:debug
```

### تقرير التغطية - Coverage Report
```bash
yarn test:coverage
```

## إعداد البيئة - Environment Setup

### متطلبات التشغيل - Prerequisites
1. Node.js 18+
2. Yarn
3. متصفحات Playwright (تثبت تلقائياً)

### إعداد قاعدة البيانات للاختبار - Database Setup for Testing
```bash
# إنشاء قاعدة بيانات الاختبار
createdb test_944_trafik

# تشغيل الماكرات
yarn prisma:migrate

# زرع البيانات
yarn db:seed
```

## كتابة الاختبارات - Writing Tests

### هيكل اختبار الوحدة - Unit Test Structure
```typescript
import { functionToTest } from '../../lib/module';

describe('functionToTest', () => {
  it('should return expected result', () => {
    const result = functionToTest(input);
    expect(result).toBe(expectedOutput);
  });

  it('should handle edge cases', () => {
    expect(() => functionToTest(invalidInput)).toThrow();
  });
});
```

### هيكل اختبار المكون - Component Test Structure
```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import Component from '../../components/Component';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component prop="value" />);
    expect(screen.getByText('Expected Text')).toBeTruthy();
  });

  it('handles user interactions', () => {
    render(<Component prop="value" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('New Text')).toBeTruthy();
  });
});
```

### هيكل اختبار E2E - E2E Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test('should complete user flow', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Action")');
    await expect(page).toHaveURL('/expected-page');
  });
});
```

## أفضل الممارسات - Best Practices

### 1. تسمية الاختبارات - Test Naming
- استخدم أسماء وصفية باللغة الإنجليزية
- ابدأ بـ "should" (مثل: "should calculate price correctly")
- غطِ الحالات الإيجابية والسلبية

### 2. تنظيم الكود - Code Organization
- ضع كل اختبار في ملف منفصل
- اتبع نفس هيكل المشروع
- استخدم `describe` blocks لتجميع الاختبارات ذات الصلة

### 3. Mocking والتزييف - Mocking
- استخدم Jest mocks للوظائف الخارجية
- mock قاعدة البيانات والـ APIs
- تجنب الاعتماد على خدمات خارجية في الاختبارات

### 4. التغطية - Coverage
- هدف: 80% تغطية للكود
- ركز على المنطق التجاري المهم
- لا تطارد تغطية 100% على حساب الكود غير المهم

### 5. الاختبارات غير المتزامنة - Async Testing
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## استكشاف الأخطاء - Troubleshooting

### مشاكل شائعة - Common Issues

1. **Playwright Browsers**: `yarn playwright install`
2. **Database Connection**: تأكد من تشغيل قاعدة البيانات
3. **Environment Variables**: انسخ `.env.example` إلى `.env.local`
4. **Port Conflicts**: تأكد من عدم تشغيل الخادم على المنفذ 3000

### تصحيح الاختبارات - Debugging Tests
```bash
# تشغيل اختبار معين
yarn test --testNamePattern="specific test name"

# تشغيل اختبار معين في ملف معين
yarn test path/to/test/file.test.ts

# وضع المراقبة
yarn test:watch
```

## CI/CD

يتم تشغيل جميع الاختبارات تلقائياً في GitHub Actions:
- على كل push للفرع الرئيسي
- على كل pull request
- تقارير التغطية ترسل إلى Codecov

## المساهمة - Contributing

1. اكتب اختبارات لأي كود جديد
2. تأكد من مرور جميع الاختبارات
3. حافظ على تغطية عالية
4. اتبع أفضل الممارسات المذكورة أعلاه

## الموارد الإضافية - Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://kentcdodds.com/blog/common-testing-mistakes)
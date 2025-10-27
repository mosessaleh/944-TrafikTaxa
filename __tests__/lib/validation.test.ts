import {
  BookingFormSchema,
  RegisterSchema,
  LoginSchema,
  ProfileUpdateSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  CardPaymentSchema,
  CryptoPaymentSchema,
  ConfirmCryptoPaymentSchema,
} from '../../lib/validation';

describe('BookingFormSchema', () => {
  it('should validate valid booking form data', () => {
    const validData = {
      passengers: 2,
      pickupAddress: 'Test Street 1',
      dropoffAddress: 'Test Street 2',
      tripType: 'immediate' as const,
    };
    expect(() => BookingFormSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid passengers count', () => {
    const invalidData = {
      passengers: 0,
      pickupAddress: 'Test Street 1',
      dropoffAddress: 'Test Street 2',
      tripType: 'immediate' as const,
    };
    expect(() => BookingFormSchema.parse(invalidData)).toThrow();
  });
});

describe('RegisterSchema', () => {
  it('should validate valid registration data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+4512345678',
      street: 'Test Street',
      houseNumber: '1',
      postalCode: '1234',
      city: 'Test City',
    };
    expect(() => RegisterSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+4512345678',
      street: 'Test Street',
      houseNumber: '1',
      postalCode: '1234',
      city: 'Test City',
    };
    expect(() => RegisterSchema.parse(invalidData)).toThrow();
  });
});

describe('LoginSchema', () => {
  it('should validate valid login data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
    };
    expect(() => LoginSchema.parse(validData)).not.toThrow();
  });

  it('should reject empty password', () => {
    const invalidData = {
      email: 'test@example.com',
      password: '',
    };
    expect(() => LoginSchema.parse(invalidData)).toThrow();
  });
});

describe('CardPaymentSchema', () => {
  it('should validate valid card payment data', () => {
    const validData = {
      amountDkk: 100,
    };
    expect(() => CardPaymentSchema.parse(validData)).not.toThrow();
  });

  it('should reject negative amount', () => {
    const invalidData = {
      amountDkk: -100,
    };
    expect(() => CardPaymentSchema.parse(invalidData)).toThrow();
  });
});

describe('CryptoPaymentSchema', () => {
  it('should validate valid crypto payment data', () => {
    const validData = {
      amountDkk: 100,
      symbol: 'btc' as const,
      walletId: 'wallet123',
      network: 'bitcoin',
      address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      amountCoin: 0.001,
    };
    expect(() => CryptoPaymentSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid symbol', () => {
    const invalidData = {
      amountDkk: 100,
      symbol: 'invalid' as any,
      walletId: 'wallet123',
      network: 'bitcoin',
      address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      amountCoin: 0.001,
    };
    expect(() => CryptoPaymentSchema.parse(invalidData)).toThrow();
  });
});
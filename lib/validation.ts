import { z } from "zod";

// Enhanced validation with stricter rules and sanitization
const nameRegex = /^[a-zA-ZæøåÆØÅ\s\-'\.]+$/u;
const addressRegex = /^[a-zA-ZæøåÆØÅ0-9\s,.\-#&()\/]+$/u;
const phoneRegex = /^[\+]?[0-9\s\-\(\)]+$/;
const postalCodeRegex = /^[0-9]{4,10}$/; // Danish postal codes are 4 digits

// Booking Form Schema with enhanced validation
export const BookingFormSchema = z.object({
  riderName: z.string()
    .optional()
    .refine(val => !val || (val.length >= 2 && val.length <= 100 && nameRegex.test(val)),
      "Name must be 2-100 characters and contain only letters, spaces, hyphens, apostrophes, and periods"),
  passengers: z.number().int().min(1, "At least 1 passenger required").max(4, "Maximum 4 passengers per car"),
  pickupAddress: z.string()
    .min(3, "Pickup address must be at least 3 characters")
    .max(500, "Pickup address is too long")
    .regex(addressRegex, "Pickup address contains invalid characters"),
  dropoffAddress: z.string()
    .min(3, "Dropoff address must be at least 3 characters")
    .max(500, "Dropoff address is too long")
    .regex(addressRegex, "Dropoff address contains invalid characters"),
  tripType: z.enum(["immediate", "scheduled"], {
    errorMap: () => ({ message: "Trip type must be either immediate or scheduled" })
  }),
  pickupTime: z.string().optional().refine(val => {
    if (!val) return true; // Optional field
    const date = new Date(val);
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setDate(now.getDate() + 90); // Max 90 days in future
    return date > now && date <= maxFuture;
  }, "Pickup time must be in the future but within 90 days"),
});

export type BookingFormInput = z.infer<typeof BookingFormSchema>;

// User Registration Schema with enhanced validation
export const RegisterSchema = z.object({
  email: z.string()
    .email("Invalid email address")
    .max(254, "Email is too long")
    .refine(email => !email.includes('<') && !email.includes('>'), "Email contains invalid characters"),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password is too long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  firstName: z.string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name is too long")
    .regex(nameRegex, "First name contains invalid characters"),
  lastName: z.string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name is too long")
    .regex(nameRegex, "Last name contains invalid characters"),
  phone: z.string()
    .min(8, "Phone number must be at least 8 characters")
    .max(20, "Phone number is too long")
    .regex(phoneRegex, "Phone number contains invalid characters"),
  street: z.string()
    .min(3, "Street must be at least 3 characters")
    .max(100, "Street is too long")
    .regex(addressRegex, "Street contains invalid characters"),
  houseNumber: z.string()
    .min(1, "House number is required")
    .max(20, "House number is too long")
    .regex(/^[a-zA-Z0-9\s\-\/]+$/, "House number contains invalid characters"),
  postalCode: z.string()
    .min(4, "Postal code must be at least 4 characters")
    .max(10, "Postal code is too long")
    .regex(postalCodeRegex, "Postal code must contain only numbers"),
  city: z.string()
    .min(2, "City must be at least 2 characters")
    .max(50, "City is too long")
    .regex(/^[a-zA-ZæøåÆØÅ\s\-'\.]+$/u, "City contains invalid characters"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// Login Schema with enhanced validation
export const LoginSchema = z.object({
  email: z.string()
    .email("Invalid email address")
    .max(254, "Email is too long")
    .refine(email => !email.includes('<') && !email.includes('>'), "Email contains invalid characters"),
  password: z.string()
    .min(1, "Password is required")
    .max(128, "Password is too long"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// Profile Update Schema with enhanced validation
export const ProfileUpdateSchema = z.object({
  email: z.string()
    .email("Invalid email address")
    .max(254, "Email is too long")
    .refine(email => !email.includes('<') && !email.includes('>'), "Email contains invalid characters"),
  firstName: z.string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name is too long")
    .regex(nameRegex, "First name contains invalid characters"),
  lastName: z.string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name is too long")
    .regex(nameRegex, "Last name contains invalid characters"),
  phone: z.string()
    .min(8, "Phone number must be at least 8 characters")
    .max(20, "Phone number is too long")
    .regex(phoneRegex, "Phone number contains invalid characters"),
  street: z.string()
    .min(3, "Street must be at least 3 characters")
    .max(100, "Street is too long")
    .regex(addressRegex, "Street contains invalid characters"),
  houseNumber: z.string()
    .min(1, "House number is required")
    .max(20, "House number is too long")
    .regex(/^[a-zA-Z0-9\s\-\/]+$/, "House number contains invalid characters"),
  postalCode: z.string()
    .min(4, "Postal code must be at least 4 characters")
    .max(10, "Postal code is too long")
    .regex(postalCodeRegex, "Postal code must contain only numbers"),
  city: z.string()
    .min(2, "City must be at least 2 characters")
    .max(50, "City is too long")
    .regex(/^[a-zA-ZæøåÆØÅ\s\-'\.]+$/u, "City contains invalid characters"),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// Forgot Password Schema with enhanced validation
export const ForgotPasswordSchema = z.object({
  email: z.string()
    .email("Invalid email address")
    .max(254, "Email is too long")
    .refine(email => !email.includes('<') && !email.includes('>'), "Email contains invalid characters"),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// Reset Password Schema with enhanced validation
export const ResetPasswordSchema = z.object({
  token: z.string()
    .min(32, "Invalid reset token")
    .max(256, "Invalid reset token")
    .regex(/^[a-zA-Z0-9\-_\.]+$/, "Invalid reset token format"),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password is too long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// Email Verification Schema with enhanced validation
export const VerifyEmailSchema = z.object({
  email: z.string()
    .email("Invalid email address")
    .max(254, "Email is too long")
    .refine(email => !email.includes('<') && !email.includes('>'), "Email contains invalid characters"),
  code: z.string()
    .regex(/^\d{6}$/, "Code must be exactly 6 digits")
    .refine(code => !/^(\d)\1{5}$/.test(code), "Code cannot be all the same digit"), // Prevent common weak codes
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

// Card Payment Intent Schema with enhanced validation
export const CardPaymentIntentSchema = z.object({
  amountDkk: z.number()
    .positive("Amount must be positive")
    .max(50000, "Amount cannot exceed 50,000 DKK")
    .refine(val => Number(val.toFixed(2)) === val, "Amount must have at most 2 decimal places"),
  bookingId: z.number().int().positive("Invalid booking ID").optional(),
});

export type CardPaymentIntentInput = z.infer<typeof CardPaymentIntentSchema>;

// Card Payment Schema (for confirmation) with enhanced validation
export const CardPaymentSchema = z.object({
  amountDkk: z.number()
    .positive("Amount must be positive")
    .max(50000, "Amount cannot exceed 50,000 DKK")
    .refine(val => Number(val.toFixed(2)) === val, "Amount must have at most 2 decimal places"),
});

export type CardPaymentInput = z.infer<typeof CardPaymentSchema>;

// Crypto Payment Schema with enhanced validation
export const CryptoPaymentSchema = z.object({
  amountDkk: z.number()
    .positive("Amount must be positive")
    .max(50000, "Amount cannot exceed 50,000 DKK")
    .refine(val => Number(val.toFixed(8)) === val, "Amount must have at most 8 decimal places"),
  symbol: z.enum(["pi", "usdt", "usdc", "btc", "eth", "bnb", "xrp"], {
    errorMap: () => ({ message: "Invalid cryptocurrency symbol" })
  }),
  walletId: z.string()
    .min(1, "Wallet selection is required")
    .max(100, "Wallet ID is too long")
    .regex(/^[a-zA-Z0-9\-_\.]+$/, "Invalid wallet ID format"),
  network: z.string()
    .min(1, "Network is required")
    .max(50, "Network name is too long")
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, "Invalid network name"),
  address: z.string()
    .min(10, "Address must be at least 10 characters")
    .max(200, "Address is too long")
    .regex(/^[a-zA-Z0-9]+$/, "Address contains invalid characters"),
  amountCoin: z.number()
    .positive("Coin amount must be positive")
    .max(1000000, "Coin amount is too large")
    .refine(val => Number(val.toFixed(8)) === val, "Coin amount must have at most 8 decimal places"),
});

export type CryptoPaymentInput = z.infer<typeof CryptoPaymentSchema>;

// Confirm Crypto Payment Schema with enhanced validation
export const ConfirmCryptoPaymentSchema = z.object({
  symbol: z.enum(["pi","usdt","usdc","btc","eth","bnb","xrp"], {
    errorMap: () => ({ message: "Invalid cryptocurrency symbol" })
  }),
  walletId: z.string()
    .optional()
    .refine(val => !val || (val.length <= 100 && /^[a-zA-Z0-9\-_\.]+$/.test(val)), "Invalid wallet ID format"),
  network: z.string()
    .min(1, "Network is required")
    .max(50, "Network name is too long")
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, "Invalid network name"),
  address: z.string()
    .min(10, "Address must be at least 10 characters")
    .max(200, "Address is too long")
    .regex(/^[a-zA-Z0-9]+$/, "Address contains invalid characters"),
  amountDkk: z.number()
    .positive("Amount must be positive")
    .max(50000, "Amount cannot exceed 50,000 DKK")
    .refine(val => Number(val.toFixed(8)) === val, "Amount must have at most 8 decimal places"),
  amountCoin: z.number()
    .positive("Coin amount must be positive")
    .max(1000000, "Coin amount is too large")
    .refine(val => Number(val.toFixed(8)) === val, "Coin amount must have at most 8 decimal places"),
  txRef: z.string()
    .optional()
    .refine(val => !val || (val.length <= 200 && /^[a-zA-Z0-9\-_\.]+$/.test(val)), "Invalid transaction reference format"),
});

export type ConfirmCryptoPaymentInput = z.infer<typeof ConfirmCryptoPaymentSchema>;

// Confirm Card Payment Schema with enhanced validation
export const ConfirmCardPaymentSchema = z.object({
  paymentIntentId: z.string()
    .min(1, "Payment intent ID is required")
    .max(100, "Payment intent ID is too long")
    .regex(/^pi_[a-zA-Z0-9_]+$/, "Invalid payment intent ID format"),
});

export type ConfirmCardPaymentInput = z.infer<typeof ConfirmCardPaymentSchema>;

// PayPal Payment Intent Schema with enhanced validation
export const PayPalPaymentIntentSchema = z.object({
  amountDkk: z.number()
    .positive("Amount must be positive")
    .max(50000, "Amount cannot exceed 50,000 DKK")
    .refine(val => Number(val.toFixed(2)) === val, "Amount must have at most 2 decimal places"),
  bookingId: z.number().int().positive("Invalid booking ID").optional(),
});

export type PayPalPaymentIntentInput = z.infer<typeof PayPalPaymentIntentSchema>;

// Revolut Payment Intent Schema with enhanced validation
export const RevolutPaymentIntentSchema = z.object({
  amountDkk: z.number()
    .positive("Amount must be positive")
    .max(50000, "Amount cannot exceed 50,000 DKK")
    .refine(val => Number(val.toFixed(2)) === val, "Amount must have at most 2 decimal places"),
  bookingId: z.number().int().positive("Invalid booking ID").optional(),
});

export type RevolutPaymentIntentInput = z.infer<typeof RevolutPaymentIntentSchema>;

import { z } from 'zod';

// Unicode-aware regexes (all languages except Arabic)
export const nameRegex = /^[^\u0600-\u06FF\s\-'.]+$/u;
export const addressRegex = /^[^\u0600-\u06FF0-9\s,\.\-#&()\/'’]+$/u;
export const houseNumberRegex = /^[0-9^\u0600-\u06FF\s\/\-.]+$/u;

// Booking Form Schema
export const BookingFormSchema = z.object({
  riderName: z.string().min(2, "Rider name must be at least 2 characters").max(100, "Rider name is too long").optional(),
  passengers: z.number().int().min(1).max(4),
  pickupAddress: z.string().min(3, "Pickup address must be at least 3 characters").max(500, "Pickup address is too long").regex(addressRegex, "Pickup address contains invalid characters"),
  dropoffAddress: z.string().min(3, "Dropoff address must be at least 3 characters").max(500, "Dropoff address is too long").regex(addressRegex, "Dropoff address contains invalid characters"),
  tripType: z.enum(['immediate', 'scheduled']),
  pickupTime: z.string().optional().refine(val => {
    if (!val) return true; // Optional for immediate trips
    const date = new Date(val);
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setDate(now.getDate() + 90);
    return date > now && date <= maxFuture;
  }, "Pickup time must be in the future but within 90 days")
});

export type BookingFormInput = z.infer<typeof BookingFormSchema>;

// Login Schema
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof LoginSchema>;

// Profile Update Schema
export const ProfileUpdateSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(2).regex(nameRegex, 'First name contains invalid characters'),
  lastName: z.string().min(2).regex(nameRegex, 'Last name contains invalid characters'),
  phone: z.string().optional(),
  address: z.string().min(3).regex(addressRegex, 'Address contains invalid characters')
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// Forgot Password Schema
export const ForgotPasswordSchema = z.object({
  email: z.string().email()
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// Reset Password Schema
export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// Verify Email Schema
export const VerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6)
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

// Card Payment Schema
export const CardPaymentSchema = z.object({
  amountDkk: z.number().positive()
});

export type CardPaymentInput = z.infer<typeof CardPaymentSchema>;

// Card Payment Intent Schema
export const CardPaymentIntentSchema = z.object({
  amountDkk: z.number().positive(),
  bookingId: z.number().int().positive().optional()
});

export type CardPaymentIntentInput = z.infer<typeof CardPaymentIntentSchema>;

// Confirm Card Payment Schema
export const ConfirmCardPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
  bookingId: z.number().int().positive()
});

export type ConfirmCardPaymentInput = z.infer<typeof ConfirmCardPaymentSchema>;

// Crypto Payment Schema
export const CryptoPaymentSchema = z.object({
  amountDkk: z.number().positive(),
  symbol: z.enum(['btc', 'eth', 'usdt', 'usdc']),
  walletId: z.string().min(1),
  network: z.string().min(1),
  address: z.string().min(1),
  amountCoin: z.number().positive()
});

export type CryptoPaymentInput = z.infer<typeof CryptoPaymentSchema>;

// Confirm Crypto Payment Schema
export const ConfirmCryptoPaymentSchema = z.object({
  bookingId: z.number().int().positive(),
  transactionHash: z.string().min(1)
});

export type ConfirmCryptoPaymentInput = z.infer<typeof ConfirmCryptoPaymentSchema>;

// PayPal Payment Intent Schema
export const PayPalPaymentIntentSchema = z.object({
  amountDkk: z.number().positive(),
  bookingId: z.number().int().positive().optional()
});

export type PayPalPaymentIntentInput = z.infer<typeof PayPalPaymentIntentSchema>;

// Revolut Payment Intent Schema
export const RevolutPaymentIntentSchema = z.object({
  amountDkk: z.number().positive(),
  bookingId: z.number().int().positive().optional()
});

export type RevolutPaymentIntentInput = z.infer<typeof RevolutPaymentIntentSchema>;

// Optional: a ready-to-use schema (use it in your route if desired)
export const RegisterSchema = z.object({
  firstName: z.string().min(2).regex(nameRegex, 'First name contains invalid characters'),
  lastName: z.string().min(2).regex(nameRegex, 'Last name contains invalid characters'),
  address: z.string().min(3).regex(addressRegex, 'Address contains invalid characters'),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(6)
});

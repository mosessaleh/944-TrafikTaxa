import { z } from "zod";

// Booking Form Schema
export const BookingFormSchema = z.object({
  riderName: z.string().optional(),
  passengers: z.number().int().min(1).max(4),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  dropoffAddress: z.string().min(1, "Dropoff address is required"),
  tripType: z.enum(["immediate", "scheduled"]),
  pickupTime: z.string().optional(),
});

export type BookingFormInput = z.infer<typeof BookingFormSchema>;

// User Registration Schema
export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  street: z.string().min(1, "Street is required"),
  houseNumber: z.string().min(1, "House number is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  city: z.string().min(1, "City is required"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// Login Schema
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// Profile Update Schema
export const ProfileUpdateSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  street: z.string().min(1, "Street is required"),
  houseNumber: z.string().min(1, "House number is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  city: z.string().min(1, "City is required"),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// Forgot Password Schema
export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// Reset Password Schema
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// Email Verification Schema
export const VerifyEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

// Card Payment Schema
export const CardPaymentSchema = z.object({
  amountDkk: z.number().positive("Amount must be positive"),
});

export type CardPaymentInput = z.infer<typeof CardPaymentSchema>;

// Crypto Payment Schema
export const CryptoPaymentSchema = z.object({
  amountDkk: z.number().positive("Amount must be positive"),
  symbol: z.enum(["pi", "usdt", "usdc", "btc", "eth", "bnb", "xrp"]),
  walletId: z.string().min(1, "Wallet selection is required"),
  network: z.string().min(1, "Network is required"),
  address: z.string().min(10, "Address is required"),
  amountCoin: z.number().positive("Coin amount must be positive"),
});

export type CryptoPaymentInput = z.infer<typeof CryptoPaymentSchema>;

// Confirm Crypto Payment Schema (existing)
export const ConfirmCryptoPaymentSchema = z.object({
  symbol: z.enum(["pi","usdt","usdc","btc","eth","bnb","xrp"]),
  walletId: z.string().optional(),
  network: z.string().min(1),
  address: z.string().min(10),
  amountDkk: z.number().positive(),
  amountCoin: z.number().positive(),
  txRef: z.string().optional()
});

export type ConfirmCryptoPaymentInput = z.infer<typeof ConfirmCryptoPaymentSchema>;

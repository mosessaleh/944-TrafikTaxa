import { z } from "zod";

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

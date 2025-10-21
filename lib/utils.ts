export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(n);
}

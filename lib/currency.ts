const fallbackRates: Record<string, number> = {
  EUR: Number(process.env.EUR_TO_ZAR ?? 20.1),
  GBP: Number(process.env.GBP_TO_ZAR ?? 23.65),
  USD: Number(process.env.USD_TO_ZAR ?? 18.45),
  ZAR: 1
};

export function convertToZar(amount: number, currency: string) {
  const rate = fallbackRates[currency.toUpperCase()] ?? 1;
  return Number((amount * rate).toFixed(2));
}

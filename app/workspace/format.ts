import { DEFAULT_USD_TO_IQD_RATE, cashEntryCurrency, cashEntryOriginalAmount, type CashEntry, type Currency, type PosSettings } from "@/lib/pos-db";

const numberFormatter = new Intl.NumberFormat("ckb-IQ", { maximumFractionDigits: 3 });
const usdFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function money(value: number) {
  return `${numberFormatter.format(value || 0)} د.ع`;
}

export function usdMoney(value: number) {
  return `$${usdFormatter.format(value || 0)}`;
}

export function currencyMoney(value: number, currency: Currency) {
  return currency === "USD" ? usdMoney(value) : money(value);
}

export function configuredUsdRate(settings: PosSettings | null) {
  const savedRate = Number(settings?.usdToIqdRate);
  return Number.isFinite(savedRate) && savedRate > 0 ? savedRate : DEFAULT_USD_TO_IQD_RATE;
}

export function entrySettlementMoney(entry: CashEntry) {
  return currencyMoney(cashEntryOriginalAmount(entry), cashEntryCurrency(entry));
}

export function dateTime(value: string) {
  return new Date(value).toLocaleString("ckb-IQ", { dateStyle: "short", timeStyle: "short" });
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function daysUntilDate(value?: string) {
  if (!value) return null;
  const today = new Date(`${localDateKey(new Date())}T00:00:00`);
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

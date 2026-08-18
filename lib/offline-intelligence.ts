import type { DashboardData } from "./pos-db";

export type OfflineInsight = {
  id: string;
  level: "info" | "warning" | "critical" | "success";
  title: string;
  detail: string;
  metric?: string;
  actionKey?: string;
  actionLabel?: string;
};

const nf = new Intl.NumberFormat("ckb-IQ", { maximumFractionDigits: 1 });
const money = (value: number) => `${nf.format(Math.round(value || 0))} د.ع`;
const day = () => new Date().toISOString().slice(0, 10);
const month = () => day().slice(0, 7);
const sum = <T,>(rows: T[], select: (row: T) => number) => rows.reduce((total, row) => total + select(row), 0);
const daysUntil = (value?: string) => value ? Math.ceil((new Date(`${value.slice(0, 10)}T23:59:59`).getTime() - Date.now()) / 86_400_000) : null;
const startOfDayOffset = (offset: number) => {
  const value = new Date(); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() + offset); return value.getTime();
};
const inWindow = (createdAt: string, fromOffset: number, toOffset: number) => {
  const value = new Date(createdAt).getTime(); return value >= startOfDayOffset(fromOffset) && value < startOfDayOffset(toOffset);
};
const trendPercent = (current: number, previous: number) => previous > 0 ? (current - previous) / previous * 100 : current > 0 ? 100 : 0;

export function offlineHealthScore(insights: OfflineInsight[]) {
  return Math.max(0, Math.min(100, 100 - insights.reduce((penalty, row) => penalty + (row.level === "critical" ? 28 : row.level === "warning" ? 12 : 0), 0)));
}

export function buildOfflineInsights(moduleKey: string, data: DashboardData): OfflineInsight[] {
  const today = day();
  const currentMonth = month();
  const salesToday = data.sales.filter((row) => row.createdAt.slice(0, 10) === today && row.status !== "returned");
  const purchasesToday = data.purchases.filter((row) => row.createdAt.slice(0, 10) === today && row.status !== "returned");
  const lowStock = data.products.filter((row) => row.stock <= row.lowStock);
  const outOfStock = data.products.filter((row) => row.stock <= 0);
  const expiring = data.stockBatches.filter((row) => row.remainingQuantity > 0 && (daysUntil(row.expiryDate) ?? 999) <= 30 && (daysUntil(row.expiryDate) ?? -1) >= 0);
  const expired = data.stockBatches.filter((row) => row.remainingQuantity > 0 && (daysUntil(row.expiryDate) ?? 0) < 0);
  const debtors = data.customers.filter((row) => row.balanceIQD > 0);
  const overLimit = debtors.filter((row) => row.creditLimitIQD > 0 && row.balanceIQD > row.creditLimitIQD);
  const customerDebt = sum(debtors, (row) => row.balanceIQD);
  const supplierDebt = sum(data.suppliers.filter((row) => row.balanceIQD > 0), (row) => row.balanceIQD);
  const revenueToday = sum(salesToday, (row) => row.totalIQD);
  const profitToday = sum(salesToday, (row) => row.profitIQD) - sum(data.expenses.filter((row) => row.createdAt.slice(0, 10) === today), (row) => row.amountIQD);
  const openShift = data.cashShifts.find((row) => row.status === "open");
  const pinFailures = data.audit.filter((row) => row.action === "security.pin_failed" && row.createdAt.slice(0, 10) === today).length;
  const currentWeekRevenue = sum(data.sales.filter((row) => inWindow(row.createdAt, -6, 1) && row.status !== "returned"), (row) => row.totalIQD);
  const previousWeekRevenue = sum(data.sales.filter((row) => inWindow(row.createdAt, -13, -6) && row.status !== "returned"), (row) => row.totalIQD);
  const weeklyTrend = trendPercent(currentWeekRevenue, previousWeekRevenue);
  const collectedThisMonth = sum(data.cashEntries.filter((row) => row.direction === "in" && row.partyType === "customer" && row.createdAt.slice(0, 7) === currentMonth), (row) => row.amountIQD);
  const debtSalesThisMonth = sum(data.sales.filter((row) => row.createdAt.slice(0, 7) === currentMonth), (row) => row.debtIQD);
  const map: Record<string, OfflineInsight[]> = {
    cashier: [
      { id: "shift", level: openShift ? "success" : "critical", title: openShift ? "شەفتی کاشێر ئامادەیە" : "پێش فرۆشتن شەفت بکەرەوە", detail: openShift ? `شەفتی ${openShift.operatorName} لە ${new Date(openShift.openedAt).toLocaleTimeString("ckb-IQ", { hour: "2-digit", minute: "2-digit" })} ـەوە کراوەیە.` : "فرۆشتن بەبێ شەفت ڕێگەپێنەدراوە.", metric: openShift ? "کراوە" : "داخراو" },
      { id: "cashier-stock", level: outOfStock.length ? "warning" : "success", title: outOfStock.length ? "کالای نەماو هەیە" : "کۆگا بۆ فرۆشتن ئامادەیە", detail: outOfStock.length ? `${nf.format(outOfStock.length)} کالا ستۆکیان سفرە؛ لە کاشێر نافرۆشرێن.` : "هیچ کالایەکی سفر لە کۆگا نەدۆزرایەوە.", metric: nf.format(outOfStock.length), actionKey: "warehouse", actionLabel: "پشکنینی کۆگا" },
    ],
    sales: [
      { id: "sales-today", level: salesToday.length ? "success" : "info", title: "فرۆشتنی ئەمڕۆ", detail: salesToday.length ? `ناوەندی هەر پسوڵە ${money(revenueToday / salesToday.length)} ـە.` : "هێشتا هیچ فرۆشتنێک تۆمار نەکراوە.", metric: money(revenueToday) },
      { id: "sales-debt", level: customerDebt ? "warning" : "success", title: "کاریگەری فرۆشتنی قەرز", detail: `${nf.format(debtors.length)} کڕیار قەرزیان ماوە؛ پێش قەرزی نوێ سنووریان بپشکنە.`, metric: money(customerDebt) },
      { id: "sales-trend", level: weeklyTrend < -15 ? "warning" : weeklyTrend > 10 ? "success" : "info", title: "ئاڕاستەی ٧ ڕۆژ", detail: `فرۆشتنی ٧ ڕۆژی ئێستا بەراورد بە ٧ ڕۆژی پێشوو ${weeklyTrend >= 0 ? "زیاد" : "کەم"} بووە.`, metric: `${weeklyTrend >= 0 ? "+" : ""}${nf.format(weeklyTrend)}٪`, actionKey: "reports", actionLabel: "ڕاپۆرتی ورد" },
    ],
    salesReturns: [{ id: "sale-returns", level: data.saleReturns.filter((row) => row.createdAt.slice(0, 7) === currentMonth).length ? "warning" : "success", title: "گەڕاوەکانی ئەم مانگە", detail: "زۆربوونی گەڕاوە هۆکارێکە بۆ پشکنینی کوالێتی و نرخی کالا.", metric: nf.format(data.saleReturns.filter((row) => row.createdAt.slice(0, 7) === currentMonth).length) }],
    customers: [
      { id: "customer-contact", level: data.customers.some((row) => !row.phone) ? "warning" : "success", title: "تەواوی زانیاری کڕیار", detail: `${nf.format(data.customers.filter((row) => !row.phone).length)} کڕیار ژمارەی مۆبایلیان نییە؛ پەیوەندی و بیرخستنەوەی قەرز قورس دەبێت.`, metric: nf.format(data.customers.length) },
      { id: "customer-limit", level: overLimit.length ? "critical" : "success", title: "سنووری قەرز", detail: overLimit.length ? `${nf.format(overLimit.length)} کڕیار سنووری ڕێگەپێدراویان تێپەڕاندووە.` : "هیچ کڕیارێک سنووری قەرزی تێنەپەڕاندووە.", metric: nf.format(overLimit.length), actionKey: "debts", actionLabel: "بەڕێوەبردنی قەرز" },
    ],
    debts: [
      { id: "debt-total", level: customerDebt ? "warning" : "success", title: "پارەی لای کڕیارەکان", detail: debtors.length ? `ناوەندی قەرزی هەر کڕیار ${money(customerDebt / debtors.length)} ـە.` : "هیچ قەرزێکی ماوە نییە.", metric: money(customerDebt) },
      { id: "debt-risk", level: overLimit.length ? "critical" : "success", title: "قەرزی پڕمەترسی", detail: overLimit.length ? "بۆ ئەم کڕیارانە فرۆشتنی قەرز بوەستێنە تاوەکو دانەوە ئەنجام دەدەن." : "سنووری هەموو قەرزارەکان لە دۆخی ئاساییدایە.", metric: nf.format(overLimit.length), actionKey: "customers", actionLabel: "پشکنینی کڕیار" },
      { id: "debt-collection", level: debtSalesThisMonth > 0 && collectedThisMonth < debtSalesThisMonth * .5 ? "warning" : "success", title: "خێرایی کۆکردنەوەی قەرز", detail: `ئەم مانگە ${money(collectedThisMonth)} قەرز وەرگیراوە بەرامبەر ${money(debtSalesThisMonth)} فرۆشتنی قەرز.`, metric: debtSalesThisMonth ? `${nf.format(collectedThisMonth / debtSalesThisMonth * 100)}٪` : "—" },
    ],
    purchases: [
      { id: "purchase-today", level: purchasesToday.length ? "info" : "success", title: "کڕینی ئەمڕۆ", detail: `${nf.format(purchasesToday.length)} پسوڵەی کڕین تۆمار کراوە.`, metric: money(sum(purchasesToday, (row) => row.totalIQD)) },
      { id: "purchase-need", level: lowStock.length ? "warning" : "success", title: "پێویستی داواکاری", detail: lowStock.length ? `${nf.format(lowStock.length)} کالا گەیشتوونەتە سنووری کەمبوون؛ پێش داواکاری لیستەکە بپشکنە.` : "هیچ کالایەک پێویستی خێرای بە داواکاری نییە.", metric: nf.format(lowStock.length), actionKey: "warehouse", actionLabel: "لیستی کەمبوون" },
    ],
    purchaseReturns: [{ id: "purchase-returns", level: data.purchaseReturns.length ? "warning" : "success", title: "گەڕاوە بۆ دابینکەر", detail: "هۆکاری گەڕانەوەکان بەراورد بکە بۆ دیاریکردنی دابینکەری باشتر.", metric: nf.format(data.purchaseReturns.length) }],
    suppliers: [
      { id: "supplier-debt", level: supplierDebt ? "warning" : "success", title: "قەرزی دابینکەران", detail: supplierDebt ? "پێش داواکارییەکی نوێ، باڵانسی دابینکەر بپشکنە." : "هیچ قەرزێکی دابینکەر ماوە نییە.", metric: money(supplierDebt) },
      { id: "supplier-contact", level: data.suppliers.some((row) => !row.phone) ? "warning" : "success", title: "زانیاری پەیوەندی", detail: `${nf.format(data.suppliers.filter((row) => !row.phone).length)} دابینکەر ژمارەی مۆبایلیان نییە.`, metric: nf.format(data.suppliers.length) },
    ],
    products: [
      { id: "product-margin", level: data.products.some((row) => row.salePriceIQD <= row.purchasePriceIQD) ? "critical" : "success", title: "پاراستنی نرخی فرۆش", detail: `${nf.format(data.products.filter((row) => row.salePriceIQD <= row.purchasePriceIQD).length)} کالا نرخی فرۆشیان لە تێچوو زیاتر نییە.`, metric: nf.format(data.products.length) },
      { id: "product-low", level: lowStock.length ? "warning" : "success", title: "کەمبوونی ستۆک", detail: lowStock.length ? "کالا کەمەکان پێش نەمان زیاد بکەرەوە." : "ستۆکی هەموو کالا چالاکە.", metric: nf.format(lowStock.length), actionKey: "warehouse", actionLabel: "پشکنینی کۆگا" },
    ],
    warehouse: [
      { id: "warehouse-low", level: lowStock.length ? "warning" : "success", title: "کالای کەم", detail: `${nf.format(outOfStock.length)} نەماو و ${nf.format(lowStock.length - outOfStock.length)} کەم ماوە.`, metric: nf.format(lowStock.length) },
      { id: "warehouse-expiry", level: expired.length ? "critical" : expiring.length ? "warning" : "success", title: "بەسەرچوونی بەچ", detail: expired.length ? `${nf.format(expired.length)} بەچ بەسەرچووە و پێویستە لە فرۆش بوەستێندرێت.` : expiring.length ? `${nf.format(expiring.length)} بەچ لە ٣٠ ڕۆژی داهاتوودا بەسەردەچێت.` : "هیچ بەچێکی نزیک بە بەسەرچوون نییە.", metric: nf.format(expired.length + expiring.length), actionKey: expired.length ? "losses" : "warehouse", actionLabel: expired.length ? "تۆمارکردنی خەسار" : "پشکنینی بەچ" },
    ],
    labels: [{ id: "labels", level: data.products.some((row) => !row.barcode) ? "warning" : "success", title: "ئامادەیی لەیبڵ", detail: `${nf.format(data.products.filter((row) => !row.barcode).length)} کالا بارکۆدیان نییە.`, metric: nf.format(data.products.length) }],
    losses: [{ id: "loss-month", level: sum(data.losses.filter((row) => row.createdAt.slice(0, 7) === currentMonth), (row) => row.costIQD) ? "critical" : "success", title: "خەساری ئەم مانگە", detail: "خەساری بەسەرچوون، شکاوی و ونبوون بەردەوام بەراورد بکە.", metric: money(sum(data.losses.filter((row) => row.createdAt.slice(0, 7) === currentMonth), (row) => row.costIQD)) }],
    accounting: [{ id: "accounting", level: data.journalEntries.length ? "success" : "info", title: "تەواوی تۆماری دوولایەنە", detail: `${nf.format(data.journalEntries.length)} تۆماری ژمێریاری بە شێوەی نەگۆڕ تۆمار کراوە.`, metric: nf.format(data.journalEntries.length) }],
    accounts: [{ id: "accounts", level: data.accounts.length ? "success" : "warning", title: "پلانی حسابەکان", detail: data.accounts.length ? "حسابە چالاکەکان بۆ تۆماری ژمێریاری ئامادەن." : "هیچ حسابێک درووست نەکراوە.", metric: nf.format(data.accounts.length) }],
    cashIn: [{ id: "cash-in", level: "success", title: "پارەی هاتووی ئەمڕۆ", detail: "تەنها وەرگرتنی ڕاستەقینە لە ئامێرەکە هەژمار کراوە.", metric: money(sum(data.cashEntries.filter((row) => row.direction === "in" && row.createdAt.slice(0, 10) === today), (row) => row.amountIQD)) }],
    cashOut: [{ id: "cash-out", level: "info", title: "پارەی دەرچووی ئەمڕۆ", detail: "هەر دەرچوونێک دەبێت هۆکار و بەڵگەی ڕوونی هەبێت.", metric: money(sum(data.cashEntries.filter((row) => row.direction === "out" && row.createdAt.slice(0, 10) === today), (row) => row.amountIQD)) }],
    expenses: [{ id: "expense-month", level: sum(data.expenses.filter((row) => row.createdAt.slice(0, 7) === currentMonth), (row) => row.amountIQD) ? "warning" : "success", title: "خەرجی ئەم مانگە", detail: "بەراوردی خەرجی لەگەڵ قازانج یارمەتیدەدات خەرجی ناپێویست بدۆزرێتەوە.", metric: money(sum(data.expenses.filter((row) => row.createdAt.slice(0, 7) === currentMonth), (row) => row.amountIQD)) }],
    reports: [
      { id: "report-profit", level: profitToday < 0 ? "critical" : profitToday > 0 ? "success" : "info", title: "قازانجی خاوێنی ئەمڕۆ", detail: profitToday < 0 ? "خەرجی ئەمڕۆ لە قازانجی ناخاوێن زیاترە؛ وردەکاری بپشکنە." : "قازانج دوای کەمکردنەوەی خەرجی ئەمڕۆ هەژمار کراوە.", metric: money(profitToday) },
      { id: "report-revenue", level: salesToday.length ? "success" : "info", title: "جووڵەی فرۆشتن", detail: `${nf.format(salesToday.length)} مامەڵەی فرۆشتن ئەمڕۆ تەواو کراوە.`, metric: money(revenueToday) },
      { id: "report-trend", level: weeklyTrend < -15 ? "warning" : weeklyTrend > 10 ? "success" : "info", title: "بەراوردی دوو هەفتە", detail: `داهاتی ٧ ڕۆژی ئێستا ${money(currentWeekRevenue)} و هەفتەی پێشوو ${money(previousWeekRevenue)} بووە.`, metric: `${weeklyTrend >= 0 ? "+" : ""}${nf.format(weeklyTrend)}٪` },
    ],
    audit: [{ id: "audit-pin", level: pinFailures ? "critical" : "success", title: "پاراستنی ئەمڕۆ", detail: pinFailures ? `${nf.format(pinFailures)} هەوڵی PIN ـی هەڵە تۆمار کراوە؛ بەکارهێنەر و کات بپشکنە.` : "هیچ هەوڵی PIN ـی هەڵە ئەمڕۆ تۆمار نەکراوە.", metric: nf.format(pinFailures) }],
    backup: [{ id: "backup", level: data.syncMeta.lastAutoBackupDay === today ? "success" : "warning", title: "پاراستنی داتا", detail: data.syncMeta.lastAutoBackupDay === today ? "پاشەکەوتی خۆکاری ئەمڕۆ بەردەستە." : "پاشەکەوتی ئەمڕۆ هێشتا پشتڕاست نەکراوەتەوە.", metric: data.syncMeta.lastAutoBackupDay === today ? "ئامادە" : "پێویستە" }],
    settings: [{ id: "settings", level: data.settings?.marketName && data.settings.phone ? "success" : "warning", title: "تەواوی ناسنامەی مارکێت", detail: data.settings?.marketName && data.settings.phone ? "ناو و ژمارەی مارکێت بۆ پسوڵە و ڕاپۆرت ئامادەن." : "ناو یان ژمارەی پەیوەندی مارکێت تەواو نییە.", metric: data.settings?.marketName ? "ناسراو" : "ناتەواو" }],
    help: [{ id: "health", level: "success", title: "پشکنینی تەندروستی سیستەم", detail: `${nf.format(data.products.length)} کالا، ${nf.format(data.customers.length)} کڕیار و ${nf.format(data.sales.length)} فرۆشتن لە داتای ناوخۆدا بەردەستن.`, metric: "چالاک" }],
  };
  return (map[moduleKey] ?? map.help).slice(0, 3);
}

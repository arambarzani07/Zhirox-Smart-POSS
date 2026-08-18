export type ModuleKey =
  | "cashier" | "products" | "debts" | "customers" | "sales" | "warehouse"
  | "purchases" | "suppliers" | "cashIn" | "salesReturns" | "purchaseReturns"
  | "cashOut" | "expenses" | "reports" | "accounting" | "losses" | "labels"
  | "audit" | "backup" | "settings" | "help";

export type PosModule = {
  key: ModuleKey;
  title: string;
  description: string;
  icon: string;
  sections: readonly string[];
  primaryAction?: string;
};

export const modules: readonly PosModule[] = [
  { key: "cashier", title: "کاشێر", description: "فرۆشتن و پارەدان", icon: "🛒", primaryAction: "فرۆشتنی نوێ", sections: ["سکانی بارکۆد", "سەبەتە", "پارەدان", "پسولە"] },
  { key: "products", title: "کالا", description: "تۆمار و بەڕێوەبردنی کالا", icon: "📦", primaryAction: "کالای نوێ", sections: ["زانیاری کالا", "بارکۆد", "نرخ", "یەکە و کارتۆن"] },
  { key: "debts", title: "قەرز", description: "قەرزی کڕیار و دانەوە", icon: "💳", primaryAction: "قەرزی نوێ", sections: ["قەرزی چالاک", "دانەوە", "مێژوو", "کشفی حساب"] },
  { key: "customers", title: "کڕیار", description: "پرۆفایل و مێژووی کڕیار", icon: "👥", primaryAction: "کڕیاری نوێ", sections: ["پرۆفایل", "ژمارەی مۆبایل", "قەرز", "مێژووی مامەڵە"] },
  { key: "sales", title: "فرۆشراو", description: "هەموو فرۆشتنەکان", icon: "🧾", sections: ["پسولەکان", "وردەکاری", "فلتەر", "گەڕان"] },
  { key: "warehouse", title: "کۆگا", description: "کۆگا و بڕی بەردەست", icon: "🏬", sections: ["بڕی بەردەست", "کەمبوون", "بەچ", "بەسەرچوون"] },
  { key: "purchases", title: "کڕین", description: "کڕین لە دابینکەر", icon: "📥", primaryAction: "کڕینی نوێ", sections: ["فاکتۆری کڕین", "کالا", "تێچوو", "پارەدان"] },
  { key: "suppliers", title: "دابینکەر", description: "دابینکەر و حساب", icon: "🚚", primaryAction: "دابینکەری نوێ", sections: ["پرۆفایل", "قەرز", "کڕین", "پارەدان"] },
  { key: "cashIn", title: "پارەوەرگرتن", description: "پارەی هاتوو", icon: "💵", primaryAction: "تۆمارکردن", sections: ["قاسە", "بانک", "سەرچاوە", "مێژوو"] },
  { key: "salesReturns", title: "گەڕاوەی فرۆش", description: "گەڕاندنەوەی کالای فرۆشراو", icon: "↩️", primaryAction: "گەڕاندنەوە", sections: ["پسولە", "کالا", "هۆکار", "پارەگەڕاندنەوە"] },
  { key: "purchaseReturns", title: "گەڕاوەی کڕین", description: "گەڕاندنەوە بۆ دابینکەر", icon: "↪️", primaryAction: "گەڕاندنەوە", sections: ["کڕین", "کالا", "هۆکار", "حساب"] },
  { key: "cashOut", title: "پارەدەرچوون", description: "پارەی دەرچوو", icon: "💸", primaryAction: "تۆمارکردن", sections: ["قاسە", "بانک", "مەبەست", "مێژوو"] },
  { key: "expenses", title: "خەرجی", description: "خەرجییەکانی مارکێت", icon: "🧮", primaryAction: "خەرجی نوێ", sections: ["جۆری خەرجی", "بڕ", "بەڵگە", "مێژوو"] },
  { key: "reports", title: "ڕاپۆرت", description: "ڕاپۆرتی فرۆش و دارایی", icon: "📊", sections: ["ڕۆژانە", "مانگانە", "قازانج", "کۆگا"] },
  { key: "accounting", title: "ژمێریاری", description: "تۆماری دارایی", icon: "📒", sections: ["ژوورنال", "حسابەکان", "Trial Balance", "داخستنی ماوە"] },
  { key: "losses", title: "خەسار", description: "خەسار و کالای تێکچوو", icon: "⚠️", primaryAction: "خەساری نوێ", sections: ["کالا", "بڕ", "هۆکار", "بەها"] },
  { key: "labels", title: "لەیبل", description: "چاپی بارکۆد و نرخ", icon: "🏷️", sections: ["بارکۆد", "قەبارە", "نرخ", "چاپ"] },
  { key: "audit", title: "تۆماری چاودێری", description: "گۆڕانکارییە گرنگەکان", icon: "🛡️", sections: ["دەستکاری", "سڕینەوە", "ڕێگەپێدان", "کات و بەکارهێنەر"] },
  { key: "backup", title: "پاشەکەوت", description: "هەناردە و گەڕاندنەوە", icon: "💾", sections: ["پاشەکەوت", "هەناردە", "گەڕاندنەوە", "پشکنینی فایل"] },
  { key: "settings", title: "ڕێکخستن", description: "ڕێکخستنی سیستەم", icon: "⚙️", sections: ["مارکێت", "دراو", "چاپکەر", "بارکۆد"] },
  { key: "help", title: "یارمەتی", description: "ڕێنمایی بەکارهێنان", icon: "❓", sections: ["دەستپێکردن", "کاشێر", "کۆگا", "چارەسەری کێشە"] }
] as const;

export function getModule(key: string) {
  return modules.find((module) => module.key === key) ?? null;
}

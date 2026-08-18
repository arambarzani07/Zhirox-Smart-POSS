import { createId, type Product } from "@/lib/pos-db";
import { normalizeBarcodeInput } from "@/lib/pos-barcode";

export function parseCsvRows(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("فایلی CSV داخستنی نیشانەی وتەی تەواو نییە");
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export function normalizeDigits(value: string) {
  const digits = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
  return value.replace(/[٠-٩۰-۹]/g, (digit) => String(digits.indexOf(digit) % 10));
}

export function parseProductsCsv(source: string): Product[] {
  const rows = parseCsvRows(source);
  if (rows.length < 2) throw new Error("فایلەکە دەبێت سەردێڕ و لانیکەم یەک کالا هەبێت");
  if (rows.length > 50001) throw new Error("لە یەکجاردا زیاتر لە ٥٠ هەزار کالا هێنان ڕێگەپێدراو نییە");
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/[\s_-]+/g, ""));
  const column = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const barcodeColumn = column("بارکۆد", "باركۆد", "باركود", "barcode", "code");
  const nameColumn = column("ناو", "ناویكالا", "name", "productname");
  const unitColumn = column("یەكە", "یەکە", "unit");
  const purchaseColumn = column("نرخیکڕین", "نرخیكڕین", "purchaseprice", "purchasepriceiqd", "cost");
  const saleColumn = column("نرخیفرۆشتن", "saleprice", "salepriceiqd", "sellingprice", "sellingpriceiqd", "price");
  const stockColumn = column("كۆگا", "کۆگا", "stock", "quantity", "initialquantity", "openingquantity");
  const lowColumn = column("ئاگاداریکەمبوو", "ئاگاداریكەمبوو", "lowstock", "minimumstock", "lowstockalert");
  const brandColumn = column("براند", "brand", "brandname");
  const categoryColumn = column("پۆل", "جۆر", "category", "department");
  const expiryColumn = column("بەرواریبەسەرچوون", "بەسەرچوون", "expirydate", "expirationdate", "expiresat");
  const expiryAlertColumn = column("ئاگاداریبەسەرچوون", "expiryalertdays", "expirationalertdays");
  if (barcodeColumn < 0 || nameColumn < 0) throw new Error("سەردێڕی بارکۆد و ناو لە فایلەکەدا پێویستن");
  const now = new Date().toISOString();
  const seen = new Set<string>();
  return rows.slice(1).map((values, index) => {
    const barcode = normalizeBarcodeInput(values[barcodeColumn] ?? "");
    const name = (values[nameColumn] ?? "").trim();
    if (!barcode || !name) throw new Error(`لە ڕیزی ${index + 2} بارکۆد یان ناو بەتاڵە`);
    if (seen.has(barcode)) throw new Error(`بارکۆدی ${barcode} لە فایلەکەدا دووبارەیە`);
    seen.add(barcode);
    const numberAt = (position: number, fallback = 0) => {
      if (position < 0 || !values[position]?.trim()) return fallback;
      const value = Number(normalizeDigits(values[position]).replaceAll(" ", "").replaceAll(",", ""));
      if (!Number.isFinite(value) || value < 0) throw new Error(`ژمارەی ڕیزی ${index + 2} دروست نییە`);
      return value;
    };
    return {
      id: createId("product"), barcode, name,
      brand: brandColumn >= 0 ? (values[brandColumn] ?? "").trim() : "",
      category: categoryColumn >= 0 ? (values[categoryColumn] ?? "").trim() : "",
      unit: unitColumn >= 0 && values[unitColumn]?.trim() ? values[unitColumn].trim() : "دانە",
      purchasePriceIQD: numberAt(purchaseColumn), salePriceIQD: numberAt(saleColumn),
      stock: numberAt(stockColumn), lowStock: numberAt(lowColumn, 5),
      expiryDate: expiryColumn >= 0 ? (values[expiryColumn] ?? "").trim() : "",
      expiryAlertDays: numberAt(expiryAlertColumn, 30),
      createdAt: now, updatedAt: now,
    } satisfies Product;
  });
}

import * as XLSX from "xlsx";

/**
 * Extracts raw row values from the first sheet of an uploaded workbook.
 * Handles real .xls/.xlsx as well as the common "HTML saved as .xls" export
 * quirk some Indian bank portals produce (SheetJS handles this natively).
 */
export function readWorkbookRows(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
  return rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

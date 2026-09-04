import { getSheetsAccessToken } from "@/lib/sheets/auth";

/** Fetches raw row values (including the header row) from a Sheets A1 range, e.g. "Transactions!A:T". */
export async function fetchSheetValues(range: string): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set (see .env.example).");
  }

  const accessToken = await getSheetsAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new Error(`Google Sheets read failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { values?: string[][] };
  return data.values ?? [];
}

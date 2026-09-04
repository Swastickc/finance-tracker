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

/** Appends rows to a Sheets A1 range, e.g. "GmailImports!A:T". Never used against the existing SMS tab. */
export async function appendSheetValues(range: string, rows: (string | number | boolean)[][]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set (see .env.example).");
  }

  const accessToken = await getSheetsAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows }),
  });

  if (!response.ok) {
    throw new Error(`Google Sheets append failed (${response.status}): ${await response.text()}`);
  }
}

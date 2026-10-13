import { Booking, StoreBorrowingRecord } from '../types';

export const SPREADSHEET_TITLE = '2026 English Panel Lab and Store Room Records';
export const SHEET_NAME_BOOKINGS = 'Lab Bookings';
export const SHEET_NAME_STORE = 'Store Room Usage';

export interface SpreadsheetInfo {
  id: string;
  url: string;
  title: string;
  lastSyncedAt?: string;
}

const BOOKINGS_HEADERS = [
  'Booking ID',
  'Date',
  'Start Time',
  'End Time',
  'Class',
  'Title / Purpose',
  'Teacher Name',
  'Type',
  'Status',
  'Remarks / Prebooking Reason',
  'Telegram Notified',
  'Created At',
];

const STORE_HEADERS = [
  'Usage ID',
  'Date',
  'Time',
  'Teacher Name',
  'Items Used / Borrowed',
  'Classification Summary',
  'Purpose / Remarks',
  'Status',
  'Returned At',
  'Returned By',
  'Created At',
];

/**
 * Searches Google Drive for an existing spreadsheet with title SPREADSHEET_TITLE,
 * or creates a new one with two sheets ("Lab Bookings" and "Store Room Usage").
 */
export async function getOrCreateSpreadsheet(accessToken: string): Promise<SpreadsheetInfo> {
  // 1. Search existing files via Drive API
  try {
    const searchParams = new URLSearchParams({
      q: `name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
    });
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (driveRes.ok) {
      const driveData = await driveRes.json();
      if (Array.isArray(driveData.files) && driveData.files.length > 0) {
        const file = driveData.files[0];
        const info: SpreadsheetInfo = {
          id: file.id,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
          title: file.name,
        };
        // Ensure the two sheets exist
        await ensureSheetTabsExist(accessToken, file.id);
        return info;
      }
    }
  } catch (err) {
    console.warn('Error searching for existing spreadsheet via Drive API:', err);
  }

  // 2. Create new spreadsheet via Sheets API
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_TITLE,
      },
      sheets: [
        { properties: { title: SHEET_NAME_BOOKINGS } },
        { properties: { title: SHEET_NAME_STORE } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Spreadsheet: ${errText}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Write header rows with styling
  await initializeHeaders(accessToken, spreadsheetId);

  return {
    id: spreadsheetId,
    url: spreadsheetUrl,
    title: SPREADSHEET_TITLE,
  };
}

/**
 * Parses raw input (either full Google Sheet URL or just ID) to extract spreadsheet ID.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

/**
 * Links a specific singular spreadsheet provided by the user/admin.
 * Verifies access, ensures "Lab Bookings" & "Store Room Usage" tabs exist, and initializes headers.
 */
export async function linkCustomSpreadsheet(accessToken: string, rawInput: string): Promise<SpreadsheetInfo> {
  const id = extractSpreadsheetId(rawInput);
  if (!id) throw new Error('Please enter a valid Google Spreadsheet ID or URL');

  // Verify access and get sheet title
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties(title)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    throw new Error(`Could not access Google Sheet (${id}). Please ensure the sheet exists and is shared or accessible with your Google account.`);
  }

  const metaData = await metaRes.json();
  const title = metaData.properties?.title || SPREADSHEET_TITLE;

  // Ensure tabs and headers exist
  await ensureSheetTabsExist(accessToken, id);
  await initializeHeaders(accessToken, id);

  return {
    id,
    url: `https://docs.google.com/spreadsheets/d/${id}`,
    title,
  };
}

/**
 * Ensures that both "Lab Bookings" and "Store Room Usage" sheet tabs exist.
 */
async function ensureSheetTabsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return;
    const meta = await metaRes.json();
    const sheetTitles = (meta.sheets || []).map((s: any) => s.properties?.title);

    const requests: any[] = [];
    if (!sheetTitles.includes(SHEET_NAME_BOOKINGS)) {
      requests.push({ addSheet: { properties: { title: SHEET_NAME_BOOKINGS } } });
    }
    if (!sheetTitles.includes(SHEET_NAME_STORE)) {
      requests.push({ addSheet: { properties: { title: SHEET_NAME_STORE } } });
    }

    if (requests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });
      await initializeHeaders(accessToken, spreadsheetId);
    }
  } catch (e) {
    console.error('Failed to verify sheet tabs:', e);
  }
}

/**
 * Writes the header rows to both sheets.
 */
async function initializeHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  try {
    // Check if headers already exist
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_BOOKINGS}'!A1:L1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (Array.isArray(data.values) && data.values.length > 0 && data.values[0].length > 0) {
        return; // Headers already initialized
      }
    }

    // Set headers for Lab Bookings
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_BOOKINGS}'!A1:L1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [BOOKINGS_HEADERS],
        }),
      }
    );

    // Set headers for Store Room Usage
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_STORE}'!A1:K1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [STORE_HEADERS],
        }),
      }
    );
  } catch (e) {
    console.error('Failed to initialize headers:', e);
  }
}

/**
 * Converts a Booking object into a row array for Google Sheets
 */
function bookingToRow(b: Booking): (string | number)[] {
  return [
    b.id || '',
    b.date || '',
    b.startTime || '',
    b.endTime || '',
    b.className || '',
    b.title || '',
    b.teacherName || '',
    b.isPrebooking ? 'Advance Pre-Booking' : 'Standard Booking',
    b.status === 'confirmed' ? 'Confirmed' : 'Cancelled',
    b.prebookingReason || b.notes || '',
    b.telegramNotified ? 'Yes' : 'No',
    b.createdAt || new Date().toISOString(),
  ];
}

/**
 * Converts a StoreBorrowingRecord into a row array for Google Sheets
 */
function storeRecordToRow(r: StoreBorrowingRecord): (string | number)[] {
  const itemsText = Array.isArray(r.itemDetails) && r.itemDetails.length > 0
    ? r.itemDetails.map(it => `${it.itemName} (x${it.quantity || 1}${it.isConsumable ? ' Consumable' : ' Returnable'})`).join('; ')
    : (r.selectedItems || []).join(', ');

  const summary = r.usageType 
    ? (r.usageType === 'loan' ? 'Returnable Equipment (To be returned)' : r.usageType === 'consumable' ? 'Consumable Supplies' : 'Mixed')
    : (r.hasReturnableItems ? 'Returnable Equipment (To be returned)' : 'Consumable Supplies');

  return [
    r.id || '',
    r.date || '',
    r.time || '',
    r.teacherName || '',
    itemsText,
    summary,
    r.purpose || r.remarks || '',
    r.status === 'borrowed' ? 'Borrowed / In Use' : r.status === 'returned' ? 'Returned' : 'Consumed',
    r.returnedAt || '',
    r.returnedBy || '',
    r.createdAt || new Date().toISOString(),
  ];
}

/**
 * Synchronize all local bookings and store items to Google Sheet.
 * Completely updates the sheet content so the Google Sheet mirrors the database.
 */
export async function syncAllDataToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  bookings: Booking[],
  storeBorrowings: StoreBorrowingRecord[]
): Promise<void> {
  // Ensure headers exist
  await initializeHeaders(accessToken, spreadsheetId);

  // 1. Prepare Bookings Rows (Headers + Data)
  const bookingRows: (string | number)[][] = [
    BOOKINGS_HEADERS,
    ...bookings.map(bookingToRow),
  ];

  // 2. Prepare Store Rows (Headers + Data)
  const storeRows: (string | number)[][] = [
    STORE_HEADERS,
    ...storeBorrowings.map(storeRecordToRow),
  ];

  // Clear existing and write full dataset
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_BOOKINGS}'!A1:Z5000:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_BOOKINGS}'!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: bookingRows,
      }),
    }
  );

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_STORE}'!A1:Z5000:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_STORE}'!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: storeRows,
      }),
    }
  );
}

/**
 * Appends a single booking row to the Google Sheet.
 */
export async function appendBookingToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  booking: Booking
): Promise<void> {
  try {
    const row = bookingToRow(booking);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_BOOKINGS}'!A:L:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );
  } catch (err) {
    console.error('Failed to append booking to Google Sheet:', err);
  }
}

/**
 * Appends a single store borrowing record to the Google Sheet.
 */
export async function appendStoreRecordToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  record: StoreBorrowingRecord
): Promise<void> {
  try {
    const row = storeRecordToRow(record);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_STORE}'!A:K:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );
  } catch (err) {
    console.error('Failed to append store record to Google Sheet:', err);
  }
}

/**
 * Read bookings from Google Sheet
 */
export async function fetchBookingsFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<Booking[]> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME_BOOKINGS}'!A2:L5000`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.values)) return [];

    return data.values.map((row: string[], idx: number) => {
      const id = row[0] || `bkg-sheet-${idx}-${Date.now()}`;
      const date = row[1] || '';
      const startTime = row[2] || '07:30';
      const endTime = row[3] || '08:30';
      const className = row[4] || '';
      const title = row[5] || 'Lesson';
      const teacherName = row[6] || '';
      const typeStr = (row[7] || '').toLowerCase();
      const statusStr = (row[8] || '').toLowerCase();
      const remarks = row[9] || '';
      const telegramNotified = (row[10] || '').toLowerCase() === 'yes';
      const createdAt = row[11] || new Date().toISOString();

      return {
        id,
        date,
        startTime,
        endTime,
        className,
        title,
        teacherName,
        isPrebooking: typeStr.includes('pre-booking') || typeStr.includes('prebooking'),
        status: statusStr.includes('cancel') ? 'cancelled' : 'confirmed',
        prebookingReason: remarks,
        notes: remarks,
        telegramNotified,
        createdAt,
        updatedAt: createdAt,
      } as Booking;
    }).filter((b: Booking) => b.date && b.startTime);
  } catch (err) {
    console.error('Failed to fetch bookings from Google Sheet:', err);
    return [];
  }
}

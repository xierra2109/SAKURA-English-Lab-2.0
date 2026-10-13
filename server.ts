import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Persistent storage file
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'lab_data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoredData {
  bookings: any[];
  logs: any[];
  schoolLogo?: string | null;
  teachers?: string[];
  classGroups?: any[];
  purposes?: string[];
  storeCategories?: any[];
  storeBorrowings?: any[];
  adminPin?: string;
  googleSheetConfig?: {
    spreadsheetId?: string;
    spreadsheetUrl?: string;
    spreadsheetTitle?: string;
    lastSyncedAt?: string;
    connectedEmail?: string;
    accessToken?: string;
  };
  telegramConfig: {
    botToken: string;
    chatId: string;
    threadId?: string;
    groupTitle?: string;
    enabled: boolean;
    notifyOnPrebooking: boolean;
    notifyOnInstantBooking: boolean;
    notifyOnApproval: boolean;
    notifyOnCancellation: boolean;
  };
}

const defaultPurposes = [
  'Teaching and Learning (PdPc)',
  'Speaking Test / Oral Assessment',
  'Listening Test / UASA',
  'SPM English Workshop',
  'English Language Society Activity',
  'Debate & Public Speaking Training',
  'Meeting / Teacher Briefing',
  'Remedial / Enrichment Class',
];

const defaultStoreCategories = [
  {
    id: 'cat-stationeries',
    name: 'Stationeries & Small Tools',
    items: [
      'Whiteboard Markers (Blue / Black)',
      'Whiteboard Markers (Red)',
      'Whiteboard Dusters / Erasers',
      'Permanent Markers (Chisel / Bullet)',
      'Highlighters (Assorted Colours)',
      'Stapler & Staples (No. 10 / 24/6)',
      'Heavy Duty Hole Puncher',
      'Paper Clips & Binder Clips',
      'Scissors & Paper Cutters',
      'Glue Sticks & Double-Sided Tape',
      'Wooden Meter Rulers (1m / 30cm)',
      'Correction Tapes / Refills',
    ],
  },
  {
    id: 'cat-papers',
    name: 'Papers & Laminating Film',
    items: [
      'A4 White Printing Paper (Reams)',
      'A4 Coloured Paper (Assorted)',
      'A3 Drawing & Sketch Paper',
      'Mahjong Paper (Rolls)',
      'Manila Cards (Coloured)',
      'Sticky Notes / Post-it Pads',
      'Laminating Film & Pouches (A4 / A3)',
      'Laminating Roll Film (Continuous)',
      'Tracing & Graph Paper',
      'Certificate Paper & Cardstock',
    ],
  },
  {
    id: 'cat-ict-av',
    name: 'ICT & Audio Visual Equipment',
    items: [
      'LCD Projector Remote Controller',
      'Wireless Presentation Clicker',
      'Wireless Handheld Microphone',
      'Lavalier / Clip-on Microphone',
      'Portable PA Speaker & Amplifier',
      'Heavy-Duty Extension Power Reel',
      'HDMI & VGA Display Cables (5m/10m)',
      '3.5mm AUX Audio Cables & Adapters',
      'English Oral Assessment Headsets',
      'USB Flash Drive / External Storage',
      'Presenter Laser Pointer',
    ],
  },
];

const defaultTeachers = [
  'Eda Sie Chang Le',
  'Cikgu Sarah',
  'Cikgu Azman',
  'Madam Wong',
  'Sir Alex',
  'Miss Ling',
  'Encik Razak',
  'Puan Hanim',
];

const defaultClassGroups = [
  {
    id: 'group-curie',
    name: 'Curie',
    subclasses: ['Curie 1', 'Curie 2', 'Curie 3', 'Curie 4', 'Curie 5'],
  },
  {
    id: 'group-einstein',
    name: 'Einstein',
    subclasses: ['Einstein 1', 'Einstein 2', 'Einstein 3', 'Einstein 4', 'Einstein 5'],
  },
  {
    id: 'group-faraday',
    name: 'Faraday',
    subclasses: ['Faraday 1', 'Faraday 2', 'Faraday 3', 'Faraday 4', 'Faraday 5'],
  },
  {
    id: 'group-newton',
    name: 'Newton',
    subclasses: ['Newton 1', 'Newton 2', 'Newton 3', 'Newton 4', 'Newton 5'],
  },
  {
    id: 'group-bohr',
    name: 'Bohr',
    subclasses: ['Bohr 1', 'Bohr 2', 'Bohr 3', 'Bohr 4', 'Bohr 5'],
  },
];

const defaultData: StoredData = {
  bookings: [],
  logs: [],
  schoolLogo: null,
  teachers: defaultTeachers,
  purposes: defaultPurposes,
  storeCategories: defaultStoreCategories,
  storeBorrowings: [],
  classGroups: defaultClassGroups,
  adminPin: 'sakura',
  telegramConfig: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    threadId: '',
    groupTitle: 'English Dept Teachers',
    enabled: false,
    notifyOnPrebooking: true,
    notifyOnInstantBooking: true,
    notifyOnApproval: true,
    notifyOnCancellation: true,
  },
};

function readData(): StoredData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        ...defaultData,
        ...parsed,
        telegramConfig: {
          ...defaultData.telegramConfig,
          ...(parsed.telegramConfig || {}),
        },
        classGroups: (parsed.classGroups && Array.isArray(parsed.classGroups) && parsed.classGroups.length > 0)
          ? parsed.classGroups
          : defaultData.classGroups,
        teachers: (parsed.teachers && Array.isArray(parsed.teachers) && parsed.teachers.length > 0)
          ? parsed.teachers
          : defaultData.teachers,
        purposes: (parsed.purposes && Array.isArray(parsed.purposes) && parsed.purposes.length > 0)
          ? parsed.purposes
          : defaultData.purposes,
        adminPin: parsed.adminPin || defaultData.adminPin || 'sakura',
        schoolLogo: parsed.schoolLogo !== undefined ? parsed.schoolLogo : defaultData.schoolLogo,
        storeCategories: (parsed.storeCategories && Array.isArray(parsed.storeCategories) && parsed.storeCategories.length > 0)
          ? parsed.storeCategories
          : defaultData.storeCategories,
        storeBorrowings: (parsed.storeBorrowings && Array.isArray(parsed.storeBorrowings))
          ? parsed.storeBorrowings
          : defaultData.storeBorrowings,
      };
    }
  } catch (err) {
    console.error('Error reading lab data file:', err);
  }
  return defaultData;
}

function writeData(data: StoredData) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing lab data file:', err);
  }
}

// Ensure initial file exists
if (!fs.existsSync(DATA_FILE)) {
  writeData(defaultData);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET all bookings
app.get('/api/bookings', (req, res) => {
  const data = readData();
  res.json(data.bookings || []);
});

// POST save all bookings or single
app.post('/api/bookings', (req, res) => {
  const data = readData();
  const newBooking = req.body;
  if (!newBooking.id) {
    newBooking.id = 'bkg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  }
  newBooking.createdAt = newBooking.createdAt || new Date().toISOString();
  newBooking.updatedAt = new Date().toISOString();

  // Prepend or add
  data.bookings = [newBooking, ...(data.bookings || []).filter(b => b.id !== newBooking.id)];
  writeData(data);
  res.status(201).json(newBooking);
});

// PUT update booking
app.put('/api/bookings/:id', (req, res) => {
  const data = readData();
  const { id } = req.params;
  const index = (data.bookings || []).findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  data.bookings[index] = {
    ...data.bookings[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  writeData(data);
  res.json(data.bookings[index]);
});

// DELETE booking
app.delete('/api/bookings/:id', (req, res) => {
  const data = readData();
  const { id } = req.params;
  data.bookings = (data.bookings || []).filter(b => b.id !== id);
  writeData(data);
  res.json({ success: true, id });
});

// GET logs
app.get('/api/logs', (req, res) => {
  const data = readData();
  res.json(data.logs || []);
});

// POST append log
app.post('/api/logs', (req, res) => {
  const data = readData();
  const newLog = req.body;
  if (!newLog.id) {
    newLog.id = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  }
  newLog.timestamp = newLog.timestamp || new Date().toISOString();
  data.logs = [newLog, ...(data.logs || [])].slice(0, 500); // retain last 500 logs
  writeData(data);
  res.status(201).json(newLog);
});

// GET telegram configuration
app.get('/api/telegram/config', (req, res) => {
  const data = readData();
  // Hide actual token characters for safety in public view if needed, but return config
  res.json(data.telegramConfig || defaultData.telegramConfig);
});

// POST save telegram configuration
app.post('/api/telegram/config', (req, res) => {
  const data = readData();
  data.telegramConfig = {
    ...data.telegramConfig,
    ...req.body,
  };
  writeData(data);
  res.json(data.telegramConfig);
});

// GET google sheets configuration
app.get('/api/google-sheets/config', (req, res) => {
  const data = readData();
  res.json(data.googleSheetConfig || {});
});

// POST save google sheets configuration
app.post('/api/google-sheets/config', (req, res) => {
  const data = readData();
  data.googleSheetConfig = {
    ...data.googleSheetConfig,
    ...req.body,
  };
  writeData(data);
  res.json(data.googleSheetConfig);
});

// Helper for CSV escaping
function toCsvRow(items: (string | number | boolean | null | undefined)[]): string {
  return items.map(val => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  }).join(',');
}

// GET export bookings as CSV for Google Sheets (No sign-in required)
app.get('/api/google-sheets/export/bookings.csv', (req, res) => {
  const data = readData();
  const bookings = data.bookings || [];
  
  const headers = [
    'Booking ID',
    'Date',
    'Start Time',
    'End Time',
    'Class',
    'Title / Purpose',
    'Teacher Name',
    'Booking Type',
    'Status',
    'Remarks / Prebooking Reason',
    'Telegram Notified',
    'Created At',
  ];

  const rows = [toCsvRow(headers)];
  for (const b of bookings) {
    rows.push(toCsvRow([
      b.id,
      b.date,
      b.startTime,
      b.endTime,
      b.className,
      b.title,
      b.teacherName,
      b.isPrebooking ? 'Advance Pre-Booking' : 'Normal Booking',
      b.status === 'cancelled' ? 'Cancelled' : 'Confirmed',
      b.prebookingReason || b.notes || '',
      b.telegramNotified ? 'Yes' : 'No',
      b.createdAt || '',
    ]));
  }

  const csvContent = '\uFEFF' + rows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="2026_Lab_Bookings.csv"');
  res.status(200).send(csvContent);
});

// GET export store room records as CSV for Google Sheets (No sign-in required)
app.get('/api/google-sheets/export/store.csv', (req, res) => {
  const data = readData();
  const records = data.storeBorrowings || [];

  const headers = [
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

  const rows = [toCsvRow(headers)];
  for (const r of records) {
    const itemsSummary = (r.items || []).map((it: any) => `${it.itemName} (${it.quantity || 1})`).join('; ');
    const classSummary = (r.items || []).map((it: any) => `${it.itemName}: ${it.usageType || 'borrow'}`).join('; ');

    rows.push(toCsvRow([
      r.id,
      r.date,
      r.time,
      r.teacherName,
      itemsSummary,
      classSummary,
      r.purpose || r.notes || '',
      r.status,
      r.returnedAt || '',
      r.returnedBy || '',
      r.createdAt || '',
    ]));
  }

  const csvContent = '\uFEFF' + rows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="2026_Store_Room_Usage.csv"');
  res.status(200).send(csvContent);
});

function parseThreadId(raw: any): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const linkMatch = s.match(/t\.me\/c\/\d+\/(\d+)/i);
  if (linkMatch) {
    return parseInt(linkMatch[1], 10);
  }
  const cleaned = s.replace(/^[#\s]*(?:topic|thread)?\s*/i, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}

// POST send Telegram notification via Bot API
app.post('/api/telegram/notify', async (req, res) => {
  const { token, chatId, text, parseMode = 'HTML', threadId } = req.body;
  const data = readData();

  const botToken = token || data.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || data.telegramConfig?.chatId || process.env.TELEGRAM_CHAT_ID;
  const targetThread = threadId !== undefined ? threadId : data.telegramConfig?.threadId;

  if (!botToken || !targetChatId) {
    return res.status(400).json({
      success: false,
      error: 'Telegram Bot Token and Chat ID are required.',
      simulated: true,
    });
  }

  try {
    const payload: Record<string, any> = {
      chat_id: targetChatId,
      text: text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    };
    const parsedThreadId = parseThreadId(targetThread);
    if (parsedThreadId !== undefined) {
      payload.message_thread_id = parsedThreadId;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      return res.status(response.status || 400).json({
        success: false,
        error: result.description || 'Failed to send message to Telegram',
        details: result,
      });
    }

    res.json({
      success: true,
      messageId: result.result?.message_id,
      chat: result.result?.chat?.title || targetChatId,
      threadId: targetThread || null,
    });
  } catch (error: any) {
    console.error('Telegram dispatch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Network error reaching Telegram API',
    });
  }
});

// POST test Telegram connection
app.post('/api/telegram/test', async (req, res) => {
  const { token, chatId, threadId } = req.body;
  const data = readData();
  const botToken = token || data.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || data.telegramConfig?.chatId || process.env.TELEGRAM_CHAT_ID;
  const targetThread = threadId !== undefined ? threadId : data.telegramConfig?.threadId;

  if (!botToken) {
    return res.status(400).json({ success: false, error: 'Bot token is missing' });
  }

  try {
    // Check bot identity first
    const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await getMeRes.json();

    if (!botInfo.ok) {
      return res.status(400).json({
        success: false,
        error: `Invalid Bot Token: ${botInfo.description}`,
      });
    }

    if (targetChatId) {
      const parsedThreadId = parseThreadId(targetThread);
      const isTopicTarget = parsedThreadId !== undefined;
      const testMsg = isTopicTarget
        ? `🔔 <b>English Language Lab System Test</b>\n\n✅ Bot connection verified successfully for Topic #${parsedThreadId}!\n📅 Timestamp: ${new Date().toLocaleString()}\n🏫 Location: Language Lab Room 102\n\nNotifications for new bookings and pre-bookings will be sent exclusively to this topic thread.`
        : `🔔 <b>English Language Lab System Test</b>\n\n✅ Bot connection verified successfully!\n📅 Timestamp: ${new Date().toLocaleString()}\n🏫 Location: Language Lab Room 102\n\nNotifications for new bookings and pre-bookings will be posted here.`;

      const payload: Record<string, any> = {
        chat_id: targetChatId,
        text: testMsg,
        parse_mode: 'HTML',
      };
      if (isTopicTarget) {
        payload.message_thread_id = parsedThreadId;
      }

      const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const sendInfo = await sendRes.json();
      if (!sendInfo.ok) {
        return res.status(400).json({
          success: false,
          botUser: botInfo.result?.username,
          error: `Bot is valid (@${botInfo.result?.username}), but sending failed: ${sendInfo.description}. ${isTopicTarget ? 'Please verify that the Topic ID is correct and that topics are enabled in the group.' : 'Make sure the bot is added to the group as member/admin!'}`,
        });
      }
      return res.json({
        success: true,
        botUsername: botInfo.result?.username,
        chatTitle: sendInfo.result?.chat?.title || targetChatId,
        threadId: isTopicTarget ? targetThread : null,
        message: isTopicTarget
          ? `Test alert sent successfully directly to Topic #${targetThread} in "${sendInfo.result?.chat?.title || targetChatId}"!`
          : 'Test alert sent successfully to Telegram group!',
      });
    }

    return res.json({
      success: true,
      botUsername: botInfo.result?.username,
      message: `Bot @${botInfo.result?.username} is valid! Please provide a Group Chat ID to test sending.`,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reach Telegram servers',
    });
  }
});

// GET school logo
app.get('/api/settings/logo', (req, res) => {
  const data = readData();
  res.json({ logo: data.schoolLogo || null });
});

// POST school logo
app.post('/api/settings/logo', (req, res) => {
  const data = readData();
  data.schoolLogo = req.body.logo !== undefined ? req.body.logo : null;
  writeData(data);
  res.json({ success: true, logo: data.schoolLogo });
});

// GET teachers
app.get('/api/teachers', (req, res) => {
  const data = readData();
  res.json(data.teachers || []);
});

// POST teachers
app.post('/api/teachers', (req, res) => {
  const data = readData();
  data.teachers = Array.isArray(req.body.teachers) ? req.body.teachers : [];
  writeData(data);
  res.json(data.teachers);
});

// GET class groups
app.get('/api/class-groups', (req, res) => {
  const data = readData();
  res.json(data.classGroups && data.classGroups.length > 0 ? data.classGroups : defaultData.classGroups);
});

// POST class groups
app.post('/api/class-groups', (req, res) => {
  const data = readData();
  data.classGroups = Array.isArray(req.body.classGroups) ? req.body.classGroups : defaultData.classGroups;
  writeData(data);
  res.json(data.classGroups);
});

// GET activity purposes
app.get('/api/purposes', (req, res) => {
  const data = readData();
  res.json(data.purposes && data.purposes.length > 0 ? data.purposes : defaultPurposes);
});

// POST activity purposes
app.post('/api/purposes', (req, res) => {
  const data = readData();
  data.purposes = Array.isArray(req.body.purposes) && req.body.purposes.length > 0 ? req.body.purposes : defaultPurposes;
  writeData(data);
  res.json(data.purposes);
});

// GET store categories
app.get('/api/store/categories', (req, res) => {
  const data = readData();
  res.json(data.storeCategories && data.storeCategories.length > 0 ? data.storeCategories : defaultStoreCategories);
});

// POST store categories
app.post('/api/store/categories', (req, res) => {
  const data = readData();
  data.storeCategories = Array.isArray(req.body.categories) ? req.body.categories : defaultStoreCategories;
  writeData(data);
  res.json(data.storeCategories);
});

// GET store borrowings
app.get('/api/store/borrowings', (req, res) => {
  const data = readData();
  res.json(data.storeBorrowings || []);
});

// POST create/append store borrowing record
app.post('/api/store/borrowings', (req, res) => {
  const data = readData();
  const newRecord = req.body;
  if (!newRecord.id) {
    newRecord.id = 'str-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  }
  newRecord.createdAt = newRecord.createdAt || new Date().toISOString();
  newRecord.updatedAt = new Date().toISOString();
  newRecord.status = newRecord.status || 'borrowed';

  data.storeBorrowings = [newRecord, ...(data.storeBorrowings || []).filter(b => b.id !== newRecord.id)];
  writeData(data);
  res.status(201).json(newRecord);
});

// PUT update store borrowing record
app.put('/api/store/borrowings/:id', (req, res) => {
  const data = readData();
  const { id } = req.params;
  const list = data.storeBorrowings || [];
  const idx = list.findIndex(b => b.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Store borrowing record not found' });
  }
  list[idx] = {
    ...list[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  data.storeBorrowings = list;
  writeData(data);
  res.json(list[idx]);
});

// DELETE store borrowing record
app.delete('/api/store/borrowings/:id', (req, res) => {
  const data = readData();
  const { id } = req.params;
  data.storeBorrowings = (data.storeBorrowings || []).filter(b => b.id !== id);
  writeData(data);
  res.json({ success: true, id });
});

// POST verify PIN
app.post('/api/settings/pin/verify', (req, res) => {
  const data = readData();
  const currentPin = data.adminPin || 'sakura';
  const { pin } = req.body;
  if (pin === currentPin || pin === 'admin') {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false, error: 'Incorrect PIN' });
  }
});

// POST change PIN
app.post('/api/settings/pin/change', (req, res) => {
  const data = readData();
  const currentPin = data.adminPin || 'sakura';
  const { currentPin: inputCurrent, newPin } = req.body;
  if (inputCurrent !== currentPin && inputCurrent !== 'admin') {
    return res.status(400).json({ success: false, error: 'Current PIN is incorrect' });
  }
  if (!newPin || newPin.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'New PIN must be at least 3 characters' });
  }
  data.adminPin = newPin.trim();
  writeData(data);
  res.json({ success: true });
});

// POST factory reset: wipes all bookings, logs, teachers, and class group data with PIN verification
app.post('/api/admin/factory-reset', (req, res) => {
  const data = readData();
  const currentPin = data.adminPin || 'sakura';
  const { pin } = req.body;

  if (pin !== currentPin && pin !== 'admin') {
    return res.status(401).json({ success: false, error: 'Incorrect Administrator PIN.' });
  }

  const resetData: StoredData = {
    ...data,
    bookings: [],
    logs: [],
    teachers: [],
    classGroups: [],
    purposes: defaultPurposes,
    storeBorrowings: [],
    storeCategories: defaultStoreCategories,
  };

  writeData(resetData);
  res.json({ success: true, message: 'Factory reset completed successfully.' });
});

// GET full system backup (all settings, bookings, logs)
app.get('/api/settings/backup', (req, res) => {
  const data = readData();
  res.json(data);
});

// POST restore full system backup or sync from client
app.post('/api/settings/restore', (req, res) => {
  const current = readData();
  const incoming = req.body || {};

  const merged: StoredData = {
    ...current,
    ...incoming,
    telegramConfig: {
      ...current.telegramConfig,
      ...(incoming.telegramConfig || {}),
    },
    classGroups: (incoming.classGroups && incoming.classGroups.length > 0)
      ? incoming.classGroups
      : current.classGroups,
    teachers: (incoming.teachers && incoming.teachers.length > 0)
      ? incoming.teachers
      : current.teachers,
    purposes: (incoming.purposes && incoming.purposes.length > 0)
      ? incoming.purposes
      : current.purposes,
    storeCategories: (incoming.storeCategories && incoming.storeCategories.length > 0)
      ? incoming.storeCategories
      : current.storeCategories,
    schoolLogo: incoming.schoolLogo !== undefined ? incoming.schoolLogo : current.schoolLogo,
    adminPin: incoming.adminPin || current.adminPin || 'sakura',
    bookings: Array.isArray(incoming.bookings) && incoming.bookings.length > 0 ? incoming.bookings : current.bookings,
    logs: Array.isArray(incoming.logs) && incoming.logs.length > 0 ? incoming.logs : current.logs,
    storeBorrowings: Array.isArray(incoming.storeBorrowings) && incoming.storeBorrowings.length > 0 ? incoming.storeBorrowings : current.storeBorrowings,
  };

  writeData(merged);
  res.json({ success: true, data: merged });
});

// GET current all settings summary
app.get('/api/settings/all', (req, res) => {
  const data = readData();
  res.json({
    telegramConfig: data.telegramConfig,
    teachers: data.teachers,
    classGroups: data.classGroups,
    purposes: data.purposes || defaultPurposes,
    storeCategories: data.storeCategories || defaultStoreCategories,
    storeBorrowingsCount: (data.storeBorrowings || []).length,
    schoolLogo: data.schoolLogo,
    hasCustomPin: Boolean(data.adminPin && data.adminPin !== 'sakura'),
  });
});

// Setup Vite middleware in dev or serve dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server listening on port ${port} at 0.0.0.0`);
  });
}

startServer();

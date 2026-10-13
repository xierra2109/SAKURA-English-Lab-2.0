import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { FrontpageDashboard } from './components/FrontpageDashboard';
import { BookingCalendar } from './components/BookingCalendar';
import { AdminPortal } from './components/AdminPortal';
import { StoreRoomBorrowing } from './components/StoreRoomBorrowing';
import { BookingModal } from './components/BookingModal';
import { BookingDetailModal } from './components/BookingDetailModal';

import { Booking, BookingLog, TelegramConfig, ClassGroup, StoreCategory, StoreBorrowingRecord } from './types';
import { 
  fetchBookings, 
  saveBooking, 
  fetchLogs, 
  addLog, 
  fetchTelegramConfig, 
  saveTelegramConfig,
  fetchTeachers,
  saveTeachers,
  fetchClasses,
  saveClasses,
  fetchClassGroups,
  saveClassGroups,
  fetchSchoolLogo,
  saveSchoolLogo,
  fetchTeachersAsync,
  fetchClassGroupsAsync,
  fetchPurposesAsync,
  savePurposes,
  fetchStoreCategoriesAsync,
  saveStoreCategories,
  fetchStoreBorrowings,
  saveStoreBorrowing,
  updateStoreBorrowing,
  deleteStoreBorrowing,
  syncAllLocalSettingsToServer,
  fetchGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  GoogleSheetConfig
} from './services/storageService';
import { 
  formatTelegramBookingMessage, 
  sendTelegramNotification,
  DEFAULT_TELEGRAM_CONFIG
} from './services/telegramService';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  getCachedAccessToken 
} from './services/firebaseAuthService';
import { 
  getOrCreateSpreadsheet, 
  linkCustomSpreadsheet,
  extractSpreadsheetId,
  syncAllDataToGoogleSheet, 
  appendBookingToGoogleSheet, 
  appendStoreRecordToGoogleSheet, 
  SPREADSHEET_TITLE 
} from './services/googleSheetsService';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { formatTime12h, DEFAULT_PURPOSES, DEFAULT_STORE_CATEGORIES } from './data/timeSlots';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'calendar' | 'store' | 'admin'>('dashboard');

  // Google Sheets Backend State
  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>({});
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);

  // School Logo
  const [schoolLogo, setSchoolLogo] = useState<string | null>(() => {
    return localStorage.getItem('sakura_school_logo') || null;
  });

  // Admin authentication
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('sakura_admin_auth') === 'true';
  });

  // Data state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [logs, setLogs] = useState<BookingLog[]>([]);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(DEFAULT_TELEGRAM_CONFIG);
  const [teachersList, setTeachersList] = useState<string[]>([]);
  const [classesList, setClassesList] = useState<string[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [purposesList, setPurposesList] = useState<string[]>(DEFAULT_PURPOSES);
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>(DEFAULT_STORE_CATEGORIES);
  const [storeBorrowings, setStoreBorrowings] = useState<StoreBorrowingRecord[]>([]);

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingModalIsPrebooking, setBookingModalIsPrebooking] = useState(false);
  const [quickBookDate, setQuickBookDate] = useState<string | undefined>();
  const [quickBookStartTime, setQuickBookStartTime] = useState<string | undefined>();
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        // Sync any local settings to server file storage first
        await syncAllLocalSettingsToServer();

        const [loadedBookings, loadedLogs, loadedTelegram, loadedLogo, loadedTeachers, loadedGroups, loadedPurposes, loadedCategories, loadedBorrowings, loadedSheetsCfg] = await Promise.all([
          fetchBookings(),
          fetchLogs(),
          fetchTelegramConfig(),
          fetchSchoolLogo(),
          fetchTeachersAsync(),
          fetchClassGroupsAsync(),
          fetchPurposesAsync(),
          fetchStoreCategoriesAsync(),
          fetchStoreBorrowings(),
          fetchGoogleSheetsConfig(),
        ]);
        setBookings(loadedBookings);
        setLogs(loadedLogs);
        setTelegramConfig(loadedTelegram);
        if (loadedLogo !== undefined) {
          setSchoolLogo(loadedLogo);
        }
        setTeachersList(loadedTeachers);
        setClassGroups(loadedGroups);
        if (Array.isArray(loadedPurposes) && loadedPurposes.length > 0) {
          setPurposesList(loadedPurposes);
        }
        if (Array.isArray(loadedCategories) && loadedCategories.length > 0) {
          setStoreCategories(loadedCategories);
        }
        if (Array.isArray(loadedBorrowings)) {
          setStoreBorrowings(loadedBorrowings);
        }
        if (loadedSheetsCfg && loadedSheetsCfg.spreadsheetId) {
          setGoogleSheetConfig(loadedSheetsCfg);
        }
        const flatClasses = loadedGroups.flatMap(g => g.subclasses);
        setClassesList(flatClasses.length > 0 ? flatClasses : fetchClasses());
      } catch (err) {
        console.error('Failed to load lab data:', err);
      }
    }
    loadData();

    // Listen for Firebase Auth state changes
    const unsubscribeAuth = initAuth(
      (user) => {
        setCurrentUserEmail(user.email);
        setCurrentUserPhoto(user.photoURL);
      },
      () => {
        setCurrentUserEmail(null);
        setCurrentUserPhoto(null);
      }
    );

    return () => {
      if (typeof unsubscribeAuth === 'function') {
        unsubscribeAuth();
      }
    };
  }, []);

  // Multi-device synchronization: sync logo, bookings, teachers, class groups, purposes, and store
  useEffect(() => {
    const syncFromServer = async () => {
      try {
        const [syncedLogo, syncedBookings, syncedTeachers, syncedGroups, syncedTelegram, syncedPurposes, syncedCategories, syncedBorrowings] = await Promise.all([
          fetchSchoolLogo(),
          fetchBookings(),
          fetchTeachersAsync(),
          fetchClassGroupsAsync(),
          fetchTelegramConfig(),
          fetchPurposesAsync(),
          fetchStoreCategoriesAsync(),
          fetchStoreBorrowings(),
        ]);
        setSchoolLogo(prev => prev !== syncedLogo ? syncedLogo : prev);
        setBookings(prev => JSON.stringify(prev) !== JSON.stringify(syncedBookings) ? syncedBookings : prev);
        setTelegramConfig(prev => JSON.stringify(prev) !== JSON.stringify(syncedTelegram) ? syncedTelegram : prev);
        if (Array.isArray(syncedTeachers)) {
          setTeachersList(prev => JSON.stringify(prev) !== JSON.stringify(syncedTeachers) ? syncedTeachers : prev);
        }
        if (Array.isArray(syncedGroups)) {
          setClassGroups(prev => JSON.stringify(prev) !== JSON.stringify(syncedGroups) ? syncedGroups : prev);
          const flat = syncedGroups.flatMap(g => g.subclasses);
          setClassesList(prev => JSON.stringify(prev) !== JSON.stringify(flat) ? flat : prev);
        }
        if (Array.isArray(syncedPurposes) && syncedPurposes.length > 0) {
          setPurposesList(prev => JSON.stringify(prev) !== JSON.stringify(syncedPurposes) ? syncedPurposes : prev);
        }
        if (Array.isArray(syncedCategories) && syncedCategories.length > 0) {
          setStoreCategories(prev => JSON.stringify(prev) !== JSON.stringify(syncedCategories) ? syncedCategories : prev);
        }
        if (Array.isArray(syncedBorrowings)) {
          setStoreBorrowings(prev => JSON.stringify(prev) !== JSON.stringify(syncedBorrowings) ? syncedBorrowings : prev);
        }
      } catch (e) {}
    };

    // Sync whenever user switches back to this tab (e.g. on mobile after upload on Mac)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromServer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', syncFromServer);

    // Background interval sync every 10 seconds
    const intervalId = setInterval(syncFromServer, 10000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', syncFromServer);
      clearInterval(intervalId);
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled').length;
  const activeBorrowedCount = storeBorrowings.filter(b => b.status === 'borrowed').length;

  // Save Logo (Synced to backend server across all devices)
  const handleSaveSchoolLogo = async (logoDataUrl: string | null) => {
    setSchoolLogo(logoDataUrl);
    await saveSchoolLogo(logoDataUrl);
    if (logoDataUrl) {
      showToast('School logo updated across all devices!', 'success');
    } else {
      showToast('Custom logo removed. SAKURA emblem restored.', 'info');
    }
  };

  // Save Teachers
  const handleSaveTeachersList = (teachers: string[]) => {
    setTeachersList(teachers);
    saveTeachers(teachers);
    showToast('Teachers list updated!', 'success');
  };

  // Save Classes
  const handleSaveClassesList = (classes: string[]) => {
    setClassesList(classes);
    saveClasses(classes);
    showToast('Classes list updated!', 'success');
  };

  // Save Class Groups
  const handleSaveClassGroups = (groups: ClassGroup[]) => {
    setClassGroups(groups);
    saveClassGroups(groups);
    setClassesList(groups.flatMap(g => g.subclasses));
    showToast('Class groups updated successfully!', 'success');
  };

  // Save Purposes
  const handleSavePurposesList = async (purposes: string[]) => {
    setPurposesList(purposes);
    await savePurposes(purposes);
    showToast('Activity purposes updated!', 'success');
  };

  // Save Store Categories
  const handleSaveStoreCategories = async (categories: StoreCategory[]) => {
    setStoreCategories(categories);
    await saveStoreCategories(categories);
    showToast('Store room inventory categories updated!', 'success');
  };

  // Google Sheets Backend Handlers (Configured & Managed via Admin Portal)
  const handleConnectGoogleSheets = async () => {
    setIsLoggingInGoogle(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUserEmail(result.user.email);
        setCurrentUserPhoto(result.user.photoURL);
        showToast('Google Account authorized! Linking singular spreadsheet...', 'info');

        let sheetInfo;
        if (googleSheetConfig.spreadsheetId) {
          try {
            sheetInfo = await linkCustomSpreadsheet(result.accessToken, googleSheetConfig.spreadsheetId);
          } catch (e) {
            sheetInfo = await getOrCreateSpreadsheet(result.accessToken);
          }
        } else {
          sheetInfo = await getOrCreateSpreadsheet(result.accessToken);
        }

        await syncAllDataToGoogleSheet(result.accessToken, sheetInfo.id, bookings, storeBorrowings);

        const updatedCfg: GoogleSheetConfig = {
          spreadsheetId: sheetInfo.id,
          spreadsheetUrl: sheetInfo.url,
          spreadsheetTitle: sheetInfo.title || SPREADSHEET_TITLE,
          connectedEmail: result.user.email || undefined,
          lastSyncedAt: new Date().toISOString(),
          accessToken: result.accessToken,
        };
        setGoogleSheetConfig(updatedCfg);
        await saveGoogleSheetsConfig(updatedCfg);

        showToast(`✓ Singular Google Sheet "${updatedCfg.spreadsheetTitle}" connected & synced!`, 'success');
      }
    } catch (err: any) {
      console.error('Google Sheets sign-in error:', err);
      showToast(err.message || 'Failed to connect Google Sheets', 'error');
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleDisconnectGoogleSheets = async () => {
    await googleSignOut();
    setCurrentUserEmail(null);
    setCurrentUserPhoto(null);
    const clearedCfg: GoogleSheetConfig = {
      ...googleSheetConfig,
      accessToken: undefined,
      connectedEmail: undefined,
    };
    setGoogleSheetConfig(clearedCfg);
    await saveGoogleSheetsConfig(clearedCfg);
    showToast('Google Account disconnected from sync.', 'info');
  };

  const handleSaveCustomSpreadsheet = async (urlOrId: string) => {
    const id = extractSpreadsheetId(urlOrId);
    if (!id) {
      showToast('Please enter a valid Google Spreadsheet URL or ID', 'error');
      return;
    }

    const token = getCachedAccessToken() || googleSheetConfig.accessToken;
    let url = `https://docs.google.com/spreadsheets/d/${id}`;
    let title = googleSheetConfig.spreadsheetTitle || SPREADSHEET_TITLE;

    if (token) {
      try {
        setIsSyncingGoogle(true);
        const info = await linkCustomSpreadsheet(token, id);
        url = info.url;
        title = info.title;
        await syncAllDataToGoogleSheet(token, id, bookings, storeBorrowings);
        showToast(`✓ Singular Google Sheet linked: "${title}"`, 'success');
      } catch (err: any) {
        showToast(err.message || 'Could not verify sheet access. Saved ID to settings.', 'info');
      } finally {
        setIsSyncingGoogle(false);
      }
    }

    const updatedCfg: GoogleSheetConfig = {
      ...googleSheetConfig,
      spreadsheetId: id,
      spreadsheetUrl: url,
      spreadsheetTitle: title,
      lastSyncedAt: token ? new Date().toISOString() : googleSheetConfig.lastSyncedAt,
    };
    setGoogleSheetConfig(updatedCfg);
    await saveGoogleSheetsConfig(updatedCfg);

    if (!token) {
      showToast('Singular Google Sheet saved! Authorize Google Account in Admin Portal to activate live sync.', 'success');
    }
  };

  const handleSyncGoogleSheets = async () => {
    const token = getCachedAccessToken() || googleSheetConfig.accessToken;
    if (!token) {
      await handleConnectGoogleSheets();
      return;
    }

    let targetId = googleSheetConfig.spreadsheetId;
    let targetTitle = googleSheetConfig.spreadsheetTitle || SPREADSHEET_TITLE;

    if (!targetId) {
      showToast('Initializing spreadsheet in Google Drive...', 'info');
      const sheetInfo = await getOrCreateSpreadsheet(token);
      targetId = sheetInfo.id;
      googleSheetConfig.spreadsheetId = sheetInfo.id;
      googleSheetConfig.spreadsheetUrl = sheetInfo.url;
      googleSheetConfig.spreadsheetTitle = sheetInfo.title;
      targetTitle = sheetInfo.title;
    }

    setIsSyncingGoogle(true);
    try {
      await syncAllDataToGoogleSheet(token, targetId, bookings, storeBorrowings);
      const updatedCfg: GoogleSheetConfig = {
        ...googleSheetConfig,
        spreadsheetId: targetId,
        spreadsheetTitle: targetTitle,
        lastSyncedAt: new Date().toISOString(),
      };
      setGoogleSheetConfig(updatedCfg);
      await saveGoogleSheetsConfig(updatedCfg);
      showToast(`✓ Singular Google Sheet "${targetTitle}" synchronized (${bookings.length} bookings, ${storeBorrowings.length} store records)!`, 'success');
    } catch (err: any) {
      console.error('Failed to sync to Google Sheet:', err);
      showToast('Please reconnect Google account in Admin Portal to synchronize the spreadsheet.', 'error');
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // Save Borrowing Record
  const handleSaveBorrowingRecord = async (record: StoreBorrowingRecord): Promise<StoreBorrowingRecord> => {
    const saved = await saveStoreBorrowing(record);
    const updatedList = [saved, ...storeBorrowings.filter(b => b.id !== saved.id)];
    setStoreBorrowings(updatedList);

    // Mirror to Google Sheets backend
    const token = getCachedAccessToken() || googleSheetConfig.accessToken;
    if (token && googleSheetConfig.spreadsheetId) {
      appendStoreRecordToGoogleSheet(token, googleSheetConfig.spreadsheetId, saved).catch(console.error);
    }
    return saved;
  };

  // Update Borrowing Record
  const handleUpdateBorrowingRecord = async (id: string, updates: Partial<StoreBorrowingRecord>): Promise<StoreBorrowingRecord | null> => {
    const updated = await updateStoreBorrowing(id, updates);
    if (updated) {
      const updatedList = storeBorrowings.map(b => b.id === id ? updated : b);
      setStoreBorrowings(updatedList);

      // Mirror to Google Sheets backend
      const token = getCachedAccessToken() || googleSheetConfig.accessToken;
      if (token && googleSheetConfig.spreadsheetId) {
        syncAllDataToGoogleSheet(token, googleSheetConfig.spreadsheetId, bookings, updatedList).catch(console.error);
      }
    }
    return updated;
  };

  // Delete Borrowing Record
  const handleDeleteBorrowingRecord = async (id: string): Promise<boolean> => {
    const ok = await deleteStoreBorrowing(id);
    if (ok) {
      const updatedList = storeBorrowings.filter(b => b.id !== id);
      setStoreBorrowings(updatedList);

      // Mirror to Google Sheets backend
      const token = getCachedAccessToken() || googleSheetConfig.accessToken;
      if (token && googleSheetConfig.spreadsheetId) {
        syncAllDataToGoogleSheet(token, googleSheetConfig.spreadsheetId, bookings, updatedList).catch(console.error);
      }
    }
    return ok;
  };

  // Admin Auth
  const handleAdminAuthenticate = (success: boolean) => {
    setIsAdminAuthenticated(success);
    if (success) {
      sessionStorage.setItem('sakura_admin_auth', 'true');
      showToast('Admin Portal unlocked.', 'success');
    } else {
      sessionStorage.removeItem('sakura_admin_auth');
      showToast('Admin logged out.', 'info');
    }
  };

  // Open Booking Modal
  const handleOpenBookingModal = (isPrebooking = false, date?: string, startTime?: string) => {
    setBookingModalIsPrebooking(isPrebooking);
    setQuickBookDate(date);
    setQuickBookStartTime(startTime);
    setIsBookingModalOpen(true);
  };

  // Quick book from Google Calendar timetable
  const handleQuickBookSlot = (date: string, startTime: string) => {
    handleOpenBookingModal(date > todayStr, date, startTime);
  };

  const handleCloseBookingModal = () => {
    setIsBookingModalOpen(false);
    setQuickBookDate(undefined);
    setQuickBookStartTime(undefined);
    setBookingModalIsPrebooking(false);
  };

  // Create Booking (Single or Recurring Series)
  const handleCreateBooking = async (
    bookingData: Partial<Booking>,
    sendTelegram: boolean,
    recurringDates?: string[]
  ) => {
    const isPrebooking = Boolean(bookingData.isPrebooking);
    const datesToBook = recurringDates && recurringDates.length > 0 ? recurringDates : [bookingData.date || todayStr];
    const seriesId = recurringDates && recurringDates.length > 1 ? 'series-' + Date.now() : undefined;

    const createdBookings: Booking[] = [];

    for (let i = 0; i < datesToBook.length; i++) {
      const d = datesToBook[i];
      const newId = 'sakura-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substring(2, 5);

      const b: Booking = {
        id: newId,
        title: bookingData.title || 'English Lab Session',
        teacherName: bookingData.teacherName || teachersList[0] || 'Teacher',
        teacherEmail: bookingData.teacherEmail,
        date: d,
        startTime: bookingData.startTime || '07:00',
        endTime: bookingData.endTime || '08:00',
        className: bookingData.className || classesList[0] || 'Class',
        isPrebooking: isPrebooking,
        prebookingReason: bookingData.prebookingReason,
        isRecurring: Boolean(seriesId),
        recurringUntil: bookingData.recurringUntil,
        recurringSeriesId: seriesId,
        status: 'confirmed',
        notes: bookingData.notes,
        telegramNotified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBooking(b);
      createdBookings.push(b);
    }

    setBookings(prev => [...createdBookings, ...prev]);

    // Mirror to Google Sheet backend if connected
    const token = getCachedAccessToken() || googleSheetConfig.accessToken;
    if (token && googleSheetConfig.spreadsheetId) {
      const allUpdated = [...createdBookings, ...bookings];
      syncAllDataToGoogleSheet(token, googleSheetConfig.spreadsheetId, allUpdated, storeBorrowings).catch(console.error);
    }

    // Send Telegram for the booking series
    let telegramResult;
    if (sendTelegram && telegramConfig.enabled && createdBookings.length > 0) {
      const primary = createdBookings[0];
      const eventType = isPrebooking ? 'prebooking' : 'new_booking';
      const messageText = formatTelegramBookingMessage(primary, eventType);
      telegramResult = await sendTelegramNotification(telegramConfig, messageText);

      if (telegramResult.success) {
        primary.telegramNotified = true;
        primary.telegramMessageId = telegramResult.messageId;
        primary.telegramSentAt = new Date().toISOString();
        await saveBooking(primary);
      }
    }

    // Save Log
    const primary = createdBookings[0];
    const newLog: BookingLog = {
      id: 'log-' + Date.now(),
      bookingId: primary.id,
      action: isPrebooking ? 'prebooked' : 'created',
      actor: primary.teacherName,
      title: seriesId 
        ? `Recurring Weekly Pre-Booking: ${primary.title} (${createdBookings.length} sessions)`
        : isPrebooking 
        ? `Advance Pre-Booking: ${primary.title}` 
        : `Lab Booked: ${primary.title}`,
      description: seriesId
        ? `${primary.teacherName} reserved ${createdBookings.length} weekly sessions from ${formatTime12h(primary.startTime)} - ${formatTime12h(primary.endTime)} until ${bookingData.recurringUntil} for ${primary.className}.`
        : `${primary.teacherName} reserved ${formatTime12h(primary.startTime)} - ${formatTime12h(primary.endTime)} on ${primary.date} for ${primary.className}.`,
      timestamp: new Date().toISOString(),
    };
    await addLog(newLog);
    setLogs(prev => [newLog, ...prev]);

    if (seriesId) {
      showToast(
        `✓ ${createdBookings.length} weekly recurring sessions confirmed until ${bookingData.recurringUntil}!`,
        'success'
      );
    } else if (telegramResult?.success) {
      if (telegramResult.simulated) {
        showToast(
          `${isPrebooking ? 'Pre-booking' : 'Booking'} confirmed! (Telegram simulated mode)`,
          'info'
        );
      } else {
        showToast(
          `✓ ${isPrebooking ? 'Pre-booking' : 'Booking'} confirmed and alert posted to Telegram!`,
          'success'
        );
      }
    } else {
      showToast(`${isPrebooking ? 'Pre-booking' : 'Booking'} confirmed on calendar!`, 'success');
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const cancelledBooking: Booking = {
      ...booking,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };

    if (telegramConfig.enabled) {
      const msg = formatTelegramBookingMessage(cancelledBooking, 'cancellation');
      await sendTelegramNotification(telegramConfig, msg);
    }

    await saveBooking(cancelledBooking);
    const updatedBookings = bookings.map(b => b.id === bookingId ? cancelledBooking : b);
    setBookings(updatedBookings);

    // Mirror cancellation to Google Sheet backend if connected
    const token = getCachedAccessToken() || googleSheetConfig.accessToken;
    if (token && googleSheetConfig.spreadsheetId) {
      syncAllDataToGoogleSheet(token, googleSheetConfig.spreadsheetId, updatedBookings, storeBorrowings).catch(console.error);
    }

    const newLog: BookingLog = {
      id: 'log-' + Date.now(),
      bookingId: booking.id,
      action: 'cancelled',
      actor: booking.teacherName,
      title: `Booking Cancelled: ${booking.title}`,
      description: `Cancelled slot: ${booking.date} (${formatTime12h(booking.startTime)} - ${formatTime12h(booking.endTime)}).`,
      timestamp: new Date().toISOString(),
    };
    await addLog(newLog);
    setLogs(prev => [newLog, ...prev]);

    showToast('Booking cancelled and time slot freed on calendar.', 'info');
  };

  // Re-send Telegram
  const handleResendTelegram = async (booking: Booking) => {
    const eventType = booking.isPrebooking ? 'prebooking' : 'new_booking';
    const msg = formatTelegramBookingMessage(booking, eventType);
    const result = await sendTelegramNotification(telegramConfig, msg);

    if (result.success) {
      const updated = {
        ...booking,
        telegramNotified: true,
        telegramSentAt: new Date().toISOString(),
        telegramMessageId: result.messageId,
      };
      await saveBooking(updated);
      setBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
    } else {
      throw new Error(result.error || 'Failed to dispatch alert');
    }
  };

  // Save Telegram config
  const handleSaveTelegramConfig = async (cfg: TelegramConfig) => {
    setTelegramConfig(cfg);
    await saveTelegramConfig(cfg);
    showToast('Telegram settings saved!', 'success');
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col lg:flex-row font-sans">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className={`p-4 rounded-xl shadow-lg border flex items-center gap-3 text-xs font-semibold max-w-md ${
            toast.type === 'success' 
              ? 'bg-stone-900 text-white border-stone-800' 
              : toast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-900'
              : 'bg-stone-800 text-stone-200 border-stone-700'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-auto text-stone-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Left Sidebar Navigation (Collapsible on tablet & mobile) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isAdminAuthenticated={isAdminAuthenticated}
        schoolLogo={schoolLogo}
        onUploadLogoClick={() => setCurrentTab('admin')}
        onOpenBookingModal={handleOpenBookingModal}
        todayCount={todayCount}
        activeBorrowedCount={activeBorrowedCount}
        telegramConfig={telegramConfig}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-6xl w-full mx-auto overflow-y-auto min-w-0">
          {/* Tab 1: Frontpage Dashboard */}
          {currentTab === 'dashboard' && (
            <FrontpageDashboard
              bookings={bookings}
              onNavigateToCalendar={() => setCurrentTab('calendar')}
              onOpenBookingModal={handleOpenBookingModal}
              onSelectBooking={(b) => {
                setSelectedBooking(b);
                setIsDetailModalOpen(true);
              }}
            />
          )}

          {/* Tab 2: Calendar & Booking (Google Calendar Style) */}
          {currentTab === 'calendar' && (
            <BookingCalendar
              bookings={bookings}
              schoolLogo={schoolLogo}
              onSelectBooking={(b) => {
                setSelectedBooking(b);
                setIsDetailModalOpen(true);
              }}
              onQuickBookSlot={handleQuickBookSlot}
              onOpenBookingModal={handleOpenBookingModal}
            />
          )}

          {/* Tab 3: Store Room Usage */}
          {currentTab === 'store' && (
            <StoreRoomBorrowing
              teachersList={teachersList}
              storeCategories={storeCategories}
              storeBorrowings={storeBorrowings}
              onSaveBorrowing={handleSaveBorrowingRecord}
              onUpdateBorrowing={handleUpdateBorrowingRecord}
              onDeleteBorrowing={handleDeleteBorrowingRecord}
              telegramConfig={telegramConfig}
              showToast={showToast}
            />
          )}

          {/* Tab 4: Admin Portal */}
          {currentTab === 'admin' && (
            <AdminPortal
              isAuthenticated={isAdminAuthenticated}
              onAuthenticate={handleAdminAuthenticate}
              telegramConfig={telegramConfig}
              onSaveTelegramConfig={handleSaveTelegramConfig}
              schoolLogo={schoolLogo}
              onSaveSchoolLogo={handleSaveSchoolLogo}
              teachersList={teachersList}
              onSaveTeachersList={handleSaveTeachersList}
              classesList={classesList}
              onSaveClassesList={handleSaveClassesList}
              classGroups={classGroups}
              onSaveClassGroups={handleSaveClassGroups}
              purposesList={purposesList}
              onSavePurposesList={handleSavePurposesList}
              storeCategories={storeCategories}
              onSaveStoreCategories={handleSaveStoreCategories}
              storeBorrowings={storeBorrowings}
              onUpdateStoreBorrowing={handleUpdateBorrowingRecord}
              onDeleteStoreBorrowing={handleDeleteBorrowingRecord}
              bookings={bookings}
              logs={logs}
              onCancelBooking={handleCancelBooking}
              googleSheetConfig={googleSheetConfig}
              onSaveCustomSpreadsheet={handleSaveCustomSpreadsheet}
              onSyncGoogleSheets={handleSyncGoogleSheets}
              onConnectGoogleSheets={handleConnectGoogleSheets}
              onDisconnectGoogleSheets={handleDisconnectGoogleSheets}
              isSyncingGoogleSheets={isSyncingGoogle}
              currentUserEmail={currentUserEmail}
            />
          )}
        </main>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={handleCloseBookingModal}
        onSubmit={handleCreateBooking}
        existingBookings={bookings}
        teachersList={teachersList}
        classesList={classesList}
        classGroups={classGroups}
        purposesList={purposesList}
        initialDate={quickBookDate}
        initialStartTime={quickBookStartTime}
        initialIsPrebooking={bookingModalIsPrebooking}
        onModeChange={(prebooking) => setBookingModalIsPrebooking(prebooking)}
        telegramConfig={telegramConfig}
      />

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBooking(null);
        }}
        onCancelBooking={handleCancelBooking}
        onResendTelegram={handleResendTelegram}
        telegramConfig={telegramConfig}
      />
    </div>
  );
}

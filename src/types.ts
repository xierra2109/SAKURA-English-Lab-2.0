export type BookingType = 'regular' | 'prebooking';

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  title: string;
  teacherName: string;
  teacherEmail?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm e.g. "07:00"
  endTime: string;   // HH:mm e.g. "08:00"
  className: string;
  isPrebooking: boolean;
  prebookingReason?: string;
  isRecurring?: boolean;
  recurringUntil?: string;
  recurringSeriesId?: string;
  status: BookingStatus;
  notes?: string;
  telegramNotified: boolean;
  telegramMessageId?: number;
  telegramSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type LogAction =
  | 'created'
  | 'prebooked'
  | 'cancelled'
  | 'telegram_dispatched'
  | 'telegram_failed';

export interface BookingLog {
  id: string;
  bookingId: string;
  action: LogAction;
  actor: string;
  title: string;
  description: string;
  timestamp: string;
  meta?: Record<string, any>;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  threadId?: string;
  groupTitle: string;
  enabled: boolean;
}

export interface ClassGroup {
  id: string;
  name: string;
  subclasses: string[];
}

export interface StoreCategory {
  id: string;
  name: string;
  items: string[];
  itemTypes?: Record<string, boolean>;
}

export interface StoreBorrowingItem {
  categoryName: string;
  itemName: string;
  quantity?: number;
  isConsumable?: boolean;
}

export type StoreUsageType = 'loan' | 'consumable' | 'mixed';
export type StoreBorrowingStatus = 'borrowed' | 'returned' | 'consumed';

export interface StoreBorrowingRecord {
  id: string;
  teacherName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm or HH:mm:ss
  selectedItems: string[];
  itemDetails?: StoreBorrowingItem[];
  usageType?: StoreUsageType;
  hasReturnableItems?: boolean;
  purpose?: string;
  status: StoreBorrowingStatus;
  returnedAt?: string;
  returnedBy?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

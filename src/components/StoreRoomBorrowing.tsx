import React, { useState, useMemo, useEffect } from 'react';
import { 
  PackageCheck, 
  Boxes, 
  Search, 
  User, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Download, 
  FileText, 
  RefreshCw, 
  Check, 
  X, 
  Tag, 
  Layers, 
  PenTool,
  Printer,
  Tv,
  Filter,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { StoreCategory, StoreBorrowingRecord, StoreBorrowingItem, TelegramConfig, StoreBorrowingStatus, StoreUsageType } from '../types';
import { formatTime12h, isConsumableItem, isItemConsumable } from '../data/timeSlots';

interface StoreRoomBorrowingProps {
  teachersList: string[];
  storeCategories: StoreCategory[];
  storeBorrowings: StoreBorrowingRecord[];
  onSaveBorrowing: (record: StoreBorrowingRecord) => Promise<StoreBorrowingRecord>;
  onUpdateBorrowing: (id: string, updates: Partial<StoreBorrowingRecord>) => Promise<StoreBorrowingRecord | null>;
  onDeleteBorrowing: (id: string) => Promise<boolean>;
  telegramConfig?: TelegramConfig;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const StoreRoomBorrowing: React.FC<StoreRoomBorrowingProps> = ({
  teachersList,
  storeCategories,
  storeBorrowings,
  onSaveBorrowing,
  onUpdateBorrowing,
  onDeleteBorrowing,
  telegramConfig,
  showToast,
}) => {
  // Navigation between 'borrow' (usage form) and 'history' log
  const [activeView, setActiveView] = useState<'borrow' | 'history'>('borrow');

  // Teacher selection
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState<boolean>(false);

  // Item selections: Map of itemName -> { categoryName, quantity }
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, { categoryName: string; quantity: number }>>({});

  // Active Category & Search Filters
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');

  // Optional purpose / notes
  const [purposeInput, setPurposeInput] = useState<string>('');
  const [remarksInput, setRemarksInput] = useState<string>('');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccessRecord, setSubmitSuccessRecord] = useState<StoreBorrowingRecord | null>(null);

  // History filtering state
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'borrowed' | 'returned' | 'consumed'>('all');
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string>('all');
  const [historyYearFilter, setHistoryYearFilter] = useState<string>(String(new Date().getFullYear()));

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Filtered teachers list for searchable dropdown
  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachersList;
    return teachersList.filter(t => t.toLowerCase().includes(teacherSearch.toLowerCase()));
  }, [teachersList, teacherSearch]);

  // Category Icon Resolver
  const getCategoryIcon = (categoryName: string) => {
    const lower = categoryName.toLowerCase();
    if (lower.includes('stationer') || lower.includes('pen') || lower.includes('marker')) {
      return <PenTool className="w-4 h-4 text-rose-600" />;
    }
    if (lower.includes('paper') || lower.includes('card') || lower.includes('print')) {
      return <Printer className="w-4 h-4 text-indigo-600" />;
    }
    if (lower.includes('ict') || lower.includes('audio') || lower.includes('visual') || lower.includes('equip') || lower.includes('projector')) {
      return <Tv className="w-4 h-4 text-teal-600" />;
    }
    return <Boxes className="w-4 h-4 text-amber-600" />;
  };

  // Toggle item selection
  const handleToggleItem = (itemName: string, categoryName: string) => {
    setSelectedItemsMap(prev => {
      const next = { ...prev };
      if (next[itemName]) {
        delete next[itemName];
      } else {
        next[itemName] = { categoryName, quantity: 1 };
      }
      return next;
    });
  };

  // Change quantity of selected item
  const handleAdjustQuantity = (itemName: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItemsMap(prev => {
      if (!prev[itemName]) return prev;
      const currentQty = prev[itemName].quantity || 1;
      const newQty = Math.max(1, currentQty + delta);
      return {
        ...prev,
        [itemName]: {
          ...prev[itemName],
          quantity: newQty,
        },
      };
    });
  };

  // Select all items in a category
  const handleSelectAllInCategory = (category: StoreCategory) => {
    setSelectedItemsMap(prev => {
      const next = { ...prev };
      category.items.forEach(item => {
        if (!next[item]) {
          next[item] = { categoryName: category.name, quantity: 1 };
        }
      });
      return next;
    });
    showToast(`Added all items in ${category.name}`, 'info');
  };

  // Deselect all items in a category
  const handleDeselectAllInCategory = (category: StoreCategory) => {
    setSelectedItemsMap(prev => {
      const next = { ...prev };
      category.items.forEach(item => {
        delete next[item];
      });
      return next;
    });
  };

  // Clear all current selections
  const handleClearAllSelections = () => {
    setSelectedItemsMap({});
  };

  // Total selected items count & breakdown
  const selectedCount = Object.keys(selectedItemsMap).length;

  const selectionBreakdown = useMemo(() => {
    let consumableCount = 0;
    let returnableCount = 0;

    Object.keys(selectedItemsMap).forEach(itemName => {
      const catObj = storeCategories.find(c => c.name === selectedItemsMap[itemName].categoryName);
      const isCons = isItemConsumable(itemName, catObj);
      if (isCons) {
        consumableCount += 1;
      } else {
        returnableCount += 1;
      }
    });

    return {
      consumableCount,
      returnableCount,
      hasReturnable: returnableCount > 0,
      hasConsumable: consumableCount > 0,
      isPureConsumable: selectedCount > 0 && returnableCount === 0,
    };
  }, [selectedItemsMap, selectedCount, storeCategories]);

  // Submit Usage Record
  const handleSubmitUsage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeacher.trim()) {
      showToast('Please select a teacher who is taking or borrowing the items.', 'error');
      setShowTeacherDropdown(true);
      return;
    }

    if (selectedCount === 0) {
      showToast('Please select at least one item from the panels.', 'error');
      return;
    }

    setIsSubmitting(true);

    const itemsList = Object.keys(selectedItemsMap);
    const itemDetails: StoreBorrowingItem[] = itemsList.map(itemName => {
      const catObj = storeCategories.find(c => c.name === selectedItemsMap[itemName].categoryName);
      const isCons = isItemConsumable(itemName, catObj);
      return {
        categoryName: selectedItemsMap[itemName].categoryName,
        itemName,
        quantity: selectedItemsMap[itemName].quantity || 1,
        isConsumable: isCons,
      };
    });

    const hasReturnable = itemDetails.some(i => !i.isConsumable);
    const hasConsumable = itemDetails.some(i => i.isConsumable);

    const usageType: StoreUsageType = hasReturnable && hasConsumable ? 'mixed' : hasReturnable ? 'loan' : 'consumable';
    // If only consumables (papers, laminating pouches), mark as 'consumed' (no return needed!)
    // If includes returnable equipment (cables, microphones, punchers), mark as 'borrowed'
    const status: StoreBorrowingStatus = hasReturnable ? 'borrowed' : 'consumed';

    const now = new Date();
    const finalDate = now.toISOString().split('T')[0];
    const finalTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newRecord: StoreBorrowingRecord = {
      id: 'str-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      teacherName: selectedTeacher.trim(),
      date: finalDate,
      time: finalTime,
      selectedItems: itemsList,
      itemDetails,
      usageType,
      hasReturnableItems: hasReturnable,
      purpose: purposeInput.trim() || undefined,
      remarks: remarksInput.trim() || undefined,
      status,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      const saved = await onSaveBorrowing(newRecord);
      setSubmitSuccessRecord(saved);

      if (status === 'consumed') {
        showToast(`Supplies usage logged for ${saved.teacherName} (Consumable — No return required)`, 'success');
      } else {
        showToast(`Equipment loan logged for ${saved.teacherName} (Return pending)`, 'success');
      }
      
      // Reset form
      setSelectedItemsMap({});
      setPurposeInput('');
      setRemarksInput('');
      setSelectedTeacher('');
      setTeacherSearch('');
    } catch (err: any) {
      showToast('Failed to save store usage record. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark an equipment loan as returned
  const handleMarkReturned = async (record: StoreBorrowingRecord) => {
    const returnTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const returnDate = new Date().toISOString().split('T')[0];
    const updated = await onUpdateBorrowing(record.id, {
      status: 'returned',
      returnedAt: `${returnDate} ${returnTime}`,
    });
    if (updated) {
      showToast(`Marked equipment as returned for ${record.teacherName}`, 'success');
    }
  };

  // Delete a record
  const handleDeleteRecord = (record: StoreBorrowingRecord) => {
    setConfirmDialog({
      title: 'Delete Usage Record',
      message: `Are you sure you want to delete this record for ${record.teacherName} on ${record.date}?`,
      confirmText: 'Delete Record',
      onConfirm: async () => {
        const ok = await onDeleteBorrowing(record.id);
        if (ok) {
          showToast('Usage record deleted.', 'info');
        }
      },
    });
  };

  // Export Store Usage Records to CSV
  const handleExportCSV = () => {
    if (storeBorrowings.length === 0) {
      showToast('No usage records available to export.', 'error');
      return;
    }

    const headers = [
      'Record ID',
      'Date',
      'Time',
      'Teacher Name',
      'Usage Classification',
      'Total Items Count',
      'Items Taken / Borrowed (with Quantities & Types)',
      'Purpose / Activity',
      'Status',
      'Returned Date & Time',
      'Remarks',
      'Logged At'
    ];

    const rows = storeBorrowings.map(b => {
      const itemsFormatted = b.itemDetails && b.itemDetails.length > 0
        ? b.itemDetails.map(i => `${i.itemName} (x${i.quantity || 1}) [${i.isConsumable ? 'Consumable' : 'Returnable'}]`).join('; ')
        : (b.selectedItems || []).join('; ');

      const classification = b.status === 'consumed'
        ? 'Consumable Supplies (Not returned)'
        : b.hasReturnableItems
        ? 'Equipment Loan'
        : 'Store Room Usage';

      const statusLabel = b.status === 'consumed'
        ? 'Supplies Consumed / Issued'
        : b.status === 'returned'
        ? 'Returned'
        : 'Currently on Loan';

      return [
        `"${b.id}"`,
        `"${b.date}"`,
        `"${b.time}"`,
        `"${(b.teacherName || '').replace(/"/g, '""')}"`,
        `"${classification}"`,
        b.selectedItems ? b.selectedItems.length : 0,
        `"${itemsFormatted.replace(/"/g, '""')}"`,
        `"${(b.purpose || '').replace(/"/g, '""')}"`,
        `"${statusLabel}"`,
        `"${b.returnedAt || '-'}"`,
        `"${(b.remarks || '').replace(/"/g, '""')}"`,
        `"${b.createdAt}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sakura_store_room_usage_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${storeBorrowings.length} store room usage records to CSV.`, 'success');
  };

  // Filtered History list
  const filteredHistory = useMemo(() => {
    return storeBorrowings.filter(b => {
      // Search
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchesTeacher = b.teacherName.toLowerCase().includes(q);
        const matchesItems = b.selectedItems?.some(i => i.toLowerCase().includes(q));
        const matchesPurpose = b.purpose?.toLowerCase().includes(q);
        if (!matchesTeacher && !matchesItems && !matchesPurpose) return false;
      }

      // Status Filter
      if (historyStatusFilter !== 'all') {
        if (historyStatusFilter === 'borrowed' && b.status !== 'borrowed') return false;
        if (historyStatusFilter === 'returned' && b.status !== 'returned') return false;
        if (historyStatusFilter === 'consumed' && b.status !== 'consumed') return false;
      }

      // Year
      if (historyYearFilter !== 'all') {
        const bYear = new Date(b.date).getFullYear();
        if (bYear !== Number(historyYearFilter)) return false;
      }

      // Month
      if (historyMonthFilter !== 'all') {
        const bMonth = new Date(b.date).getMonth();
        if (bMonth !== Number(historyMonthFilter)) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = `${a.date} ${a.time}`;
      const dateB = `${b.date} ${b.time}`;
      return dateB.localeCompare(dateA);
    });
  }, [storeBorrowings, historySearch, historyStatusFilter, historyYearFilter, historyMonthFilter]);

  // Counts of each category
  const activeLoanCount = useMemo(() => {
    return storeBorrowings.filter(b => b.status === 'borrowed').length;
  }, [storeBorrowings]);

  const returnedLoanCount = useMemo(() => {
    return storeBorrowings.filter(b => b.status === 'returned').length;
  }, [storeBorrowings]);

  const consumableUsageCount = useMemo(() => {
    return storeBorrowings.filter(b => b.status === 'consumed').length;
  }, [storeBorrowings]);

  return (
    <div className="space-y-6 max-w-6xl font-sans relative">
      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-900">{confirmDialog.title}</h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-2xs transition-colors"
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0 shadow-2xs">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Store Room Usage
              </h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-200">
                SAKURA English Dept
              </span>
              {activeLoanCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {activeLoanCount} Equipment On Loan
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Record usage of consumable supplies (papers, laminating film) and equipment loans (projectors, microphones, cables).
            </p>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-stone-100 p-1 rounded-xl border border-stone-200">
          <button
            type="button"
            onClick={() => setActiveView('borrow')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeView === 'borrow'
                ? 'bg-white text-rose-950 font-bold shadow-2xs border border-stone-200/60'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 text-rose-600" />
            <span>Record Usage</span>
            {selectedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                {selectedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeView === 'history'
                ? 'bg-white text-teal-950 font-bold shadow-2xs border border-stone-200/60'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-teal-600" />
            <span>Usage History</span>
            <span className="text-[10px] text-stone-500 font-mono">({storeBorrowings.length})</span>
          </button>

        </div>
      </div>

      {/* Successful Submission Receipt Banner */}
      {submitSuccessRecord && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-2xs flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-300 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <span>Usage Record Successfully Logged!</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  ID: {submitSuccessRecord.id}
                </span>
                {submitSuccessRecord.status === 'consumed' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                    📦 Consumable Supplies (No return needed)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    🔄 Equipment on Loan (Return pending)
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Staff <strong>{submitSuccessRecord.teacherName}</strong> recorded on{' '}
                <strong>{submitSuccessRecord.date}</strong> at <strong>{formatTime12h(submitSuccessRecord.time)}</strong>.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {submitSuccessRecord.itemDetails && submitSuccessRecord.itemDetails.length > 0 ? (
                  submitSuccessRecord.itemDetails.map((item, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border shadow-2xs ${
                        item.isConsumable
                          ? 'bg-blue-50 text-blue-950 border-blue-200'
                          : 'bg-amber-50 text-amber-950 border-amber-200'
                      }`}
                    >
                      <span>{item.isConsumable ? '📦' : '🔄'}</span>
                      <span>{item.itemName}</span>
                      {item.quantity && item.quantity > 1 && (
                        <span className="font-mono text-[10px] opacity-75">(x{item.quantity})</span>
                      )}
                    </span>
                  ))
                ) : (
                  submitSuccessRecord.selectedItems?.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-950 shadow-2xs"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>{item}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubmitSuccessRecord(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIEW 1: RECORD USAGE FORM */}
      {activeView === 'borrow' && (
        <form onSubmit={handleSubmitUsage} className="space-y-6">
          {/* Top Panel: Teacher Selection */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-rose-600" />
                <span>Select Teacher / Staff Member <span className="text-rose-600">*</span></span>
              </label>
              {selectedTeacher && (
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Selected
                </span>
              )}
            </div>

            {/* Teacher Select Box */}
            <div className="relative">
              {teachersList.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No teachers added yet. Please add teachers in the Admin Portal.</span>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTeacherDropdown(!showTeacherDropdown)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      selectedTeacher
                        ? 'bg-rose-50/60 border-rose-300 text-rose-950 font-bold'
                        : 'bg-stone-50 border-stone-300 text-stone-500 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-6 h-6 rounded-lg bg-rose-200/80 text-rose-900 font-bold text-xs flex items-center justify-center shrink-0">
                        {selectedTeacher ? selectedTeacher.charAt(0).toUpperCase() : '?'}
                      </span>
                      <span className={`text-xs truncate ${selectedTeacher ? 'font-bold text-stone-900' : 'text-stone-400 font-medium'}`}>
                        {selectedTeacher || 'Click to select teacher from faculty list...'}
                      </span>
                    </div>
                    <span className="text-stone-400 text-xs font-mono">▼</span>
                  </button>

                  {/* Searchable Dropdown Overlay */}
                  {showTeacherDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-stone-200 p-2 z-30 animate-in fade-in zoom-in-95 duration-100 max-h-64 flex flex-col">
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type to filter teachers..."
                          value={teacherSearch}
                          onChange={e => setTeacherSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:outline-hidden focus:ring-1 focus:ring-rose-400"
                        />
                      </div>

                      <div className="overflow-y-auto space-y-1 max-h-48 pr-1">
                        {filteredTeachers.map(teacher => (
                          <button
                            key={teacher}
                            type="button"
                            onClick={() => {
                              setSelectedTeacher(teacher);
                              setShowTeacherDropdown(false);
                              setTeacherSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                              selectedTeacher === teacher
                                ? 'bg-rose-100 text-rose-950 font-bold'
                                : 'hover:bg-stone-100 text-stone-700'
                            }`}
                          >
                            <span>{teacher}</span>
                            {selectedTeacher === teacher && <Check className="w-3.5 h-3.5 text-rose-700" />}
                          </button>
                        ))}
                        {filteredTeachers.length === 0 && (
                          <div className="p-3 text-center text-xs text-stone-400 italic">
                            No teacher found matching "{teacherSearch}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-stone-500">
              Staff member responsible for taking supplies or borrowing equipment.
            </p>
          </div>

          {/* Selection Panels (In Interactive Boxes) Categorised by Categories */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-rose-600" />
                  <span>Select Items (Supplies / Equipment) <span className="text-rose-600">*</span></span>
                </label>
                <p className="text-xs text-stone-500 mt-0.5">
                  Click on any item box to select or unselect. Items are labeled as <strong>📦 Consumable</strong> (no return) or <strong>🔄 Returnable</strong> (to return).
                </p>
              </div>

              {/* Category Search Filter */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Filter supplies & equipment..."
                  value={itemSearchQuery}
                  onChange={e => setItemSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-400"
                />
                {itemSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setItemSearchQuery('')}
                    className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Category Navigation Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'all'
                    ? 'bg-rose-900 text-white font-bold shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Categories</span>
              </button>

              {storeCategories.map(cat => {
                const countSelectedInCat = cat.items.filter(item => Boolean(selectedItemsMap[item])).length;
                const isTabActive = selectedCategoryTab === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryTab(cat.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                      isTabActive
                        ? 'bg-stone-900 text-white font-bold shadow-2xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {getCategoryIcon(cat.name)}
                    <span>{cat.name}</span>
                    {countSelectedInCat > 0 && (
                      <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                        {countSelectedInCat}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selection Panels per Category */}
            <div className="space-y-6 pt-2">
              {storeCategories
                .filter(cat => selectedCategoryTab === 'all' || selectedCategoryTab === cat.id)
                .map(category => {
                  const filteredItems = category.items.filter(item => {
                    if (itemSearchQuery.trim() && !item.toLowerCase().includes(itemSearchQuery.toLowerCase())) {
                      return false;
                    }
                    return true;
                  });

                  if (filteredItems.length === 0) {
                    return null;
                  }

                  const selectedInThisCategory = category.items.filter(item => Boolean(selectedItemsMap[item])).length;

                  return (
                    <div
                      key={category.id}
                      className="p-4 sm:p-5 rounded-2xl bg-stone-50/70 border border-stone-200 space-y-3"
                    >
                      {/* Category Header with quick actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white border border-stone-200 shadow-2xs">
                            {getCategoryIcon(category.name)}
                          </div>
                          <div>
                            <h3 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
                              <span>{category.name}</span>
                              <span className="text-[10px] font-semibold text-stone-500 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                                {filteredItems.length} items
                              </span>
                            </h3>
                          </div>
                        </div>

                        {/* Category Bulk Controls */}
                        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
                          {selectedInThisCategory > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleDeselectAllInCategory(category)}
                              className="text-[11px] font-semibold text-stone-500 hover:text-stone-700 underline"
                            >
                              Deselect All in {category.name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectAllInCategory(category)}
                              className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline"
                            >
                              Select All in {category.name}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Interactive Boxes Grid (Styled like period timetable selection) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                        {filteredItems.map(itemName => {
                          const isSelected = Boolean(selectedItemsMap[itemName]);
                          const itemQty = selectedItemsMap[itemName]?.quantity || 1;
                          const isConsumable = isItemConsumable(itemName, category);

                          return (
                            <div
                              key={itemName}
                              onClick={() => handleToggleItem(itemName, category.name)}
                              className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer min-h-[92px] select-none ${
                                isSelected
                                  ? 'bg-rose-900 text-white border-rose-950 shadow-md ring-2 ring-rose-400'
                                  : 'bg-white text-stone-800 border-stone-200 hover:border-rose-400 hover:bg-rose-50/40 shadow-2xs hover:shadow-xs'
                              }`}
                            >
                              {/* Top Bar inside Box: Item Category Badge & Picked Status */}
                              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : isConsumable
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}>
                                  <span>{isConsumable ? '📦 Consumable (No return)' : '🔄 Returnable (To return)'}</span>
                                </span>

                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all ${
                                  isSelected
                                    ? 'bg-white text-rose-950 shadow-2xs font-extrabold'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}>
                                  {isSelected ? '✓ Picked' : '+ Pick'}
                                </span>
                              </div>

                              {/* Item Name */}
                              <div className={`text-xs font-bold leading-snug ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                                {itemName}
                              </div>

                              {/* Bottom Action inside Box: Unpick & Quantity Stepper */}
                              <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[11px] ${
                                isSelected ? 'border-white/20 text-rose-100' : 'border-stone-100 text-stone-400'
                              }`}>
                                <span className="font-semibold text-[10px]">
                                  {isSelected ? 'Tap to unpick' : isConsumable ? 'Not to be returned' : 'Must be returned'}
                                </span>

                                {isSelected ? (
                                  <div
                                    className="flex items-center gap-1.5 bg-white/20 rounded-lg p-0.5"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={e => handleAdjustQuantity(itemName, -1, e)}
                                      disabled={itemQty <= 1}
                                      className="w-5 h-5 rounded bg-white/20 hover:bg-white/30 text-white flex items-center justify-center disabled:opacity-40 text-xs font-bold"
                                      title="Decrease quantity"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-mono font-bold px-1 text-white">
                                      x{itemQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={e => handleAdjustQuantity(itemName, 1, e)}
                                      className="w-5 h-5 rounded bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold"
                                      title="Increase quantity"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold text-stone-400">+</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Optional Purpose / Activity & Remarks */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-amber-600" />
              <span>Purpose / Remarks (Optional)</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                  Purpose / Class Activity:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Form 4 SPM English Workshop, Oral Assessment, Speaking Test..."
                  value={purposeInput}
                  onChange={e => setPurposeInput(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                  Remarks / Location:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Used in Language Lab Room 102, Consumed during PdPc..."
                  value={remarksInput}
                  onChange={e => setRemarksInput(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>
          </div>

          {/* Step 5: Submission Bar with Selected Summary & Consumable/Returnable Status Preview */}
          <div className="sticky bottom-4 z-20 bg-stone-900 text-white p-4 sm:p-5 rounded-2xl shadow-xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 border border-rose-500/30">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-stone-400 font-medium flex items-center gap-2 flex-wrap">
                  {selectedCount === 0 ? (
                    'No items picked yet'
                  ) : (
                    <>
                      <span>
                        <strong className="text-rose-300 font-bold">{selectedCount} item{selectedCount !== 1 ? 's' : ''}</strong> selected:
                      </span>
                      {selectionBreakdown.consumableCount > 0 && (
                        <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                          📦 {selectionBreakdown.consumableCount} Consumable (No return)
                        </span>
                      )}
                      {selectionBreakdown.returnableCount > 0 && (
                        <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800">
                          🔄 {selectionBreakdown.returnableCount} Returnable Equipment
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>Staff Member:</span>
                  <span className={selectedTeacher ? 'text-rose-300' : 'text-stone-500 italic'}>
                    {selectedTeacher || 'No teacher selected'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto w-full sm:w-auto">
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSelections}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold text-stone-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting || selectedCount === 0 || !selectedTeacher}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-stone-900" />
                    <span>Logging Usage...</span>
                  </>
                ) : selectionBreakdown.isPureConsumable ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-stone-950" />
                    <span>Record Supplies Usage (No return needed)</span>
                  </>
                ) : selectionBreakdown.hasReturnable ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-stone-950" />
                    <span>Record Store Usage &amp; Equipment Loan</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-stone-950" />
                    <span>Submit Usage Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* VIEW 2: USAGE HISTORY / LOG */}
      {activeView === 'history' && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by teacher, item name, or purpose..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    historyStatusFilter === 'all'
                      ? 'bg-stone-900 text-white font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  All ({storeBorrowings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('borrowed')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${
                    historyStatusFilter === 'borrowed'
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <span>🔄 On Loan</span>
                  <span className="text-[10px]">({activeLoanCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('returned')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${
                    historyStatusFilter === 'returned'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <span>✓ Returned</span>
                  <span className="text-[10px]">({returnedLoanCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('consumed')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 ${
                    historyStatusFilter === 'consumed'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <span>📦 Consumables</span>
                  <span className="text-[10px]">({consumableUsageCount})</span>
                </button>
              </div>
            </div>

            {/* Sub Filter: Month / Year */}
            <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100 flex-wrap gap-2">
              <span className="font-semibold text-stone-700">
                Showing {filteredHistory.length} of {storeBorrowings.length} records
              </span>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-teal-700" />
                <span>Export Filtered to CSV</span>
              </button>
            </div>
          </div>

          {/* History Records List */}
          {filteredHistory.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 text-stone-400">
              <PackageCheck className="w-10 h-10 mx-auto text-stone-300 mb-2" />
              <p className="font-bold text-sm text-stone-600">No store room usage records found</p>
              <p className="text-xs text-stone-400 mt-1">Switch to the "Record Usage" tab to record a new entry.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map(record => {
                const isReturned = record.status === 'returned';
                const isConsumed = record.status === 'consumed';
                const isLoanPending = record.status === 'borrowed';

                return (
                  <div
                    key={record.id}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-2xs ${
                      isLoanPending
                        ? 'border-amber-300 bg-amber-50/20'
                        : isConsumed
                        ? 'border-blue-200 bg-blue-50/10'
                        : 'border-stone-200/80 bg-white/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isConsumed ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1">
                              <span>📦 Supplies Issued (No Return Needed)</span>
                            </span>
                          ) : isReturned ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                              <span>✓ Equipment Returned</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 animate-pulse flex items-center gap-1">
                              <span>⏳ Equipment On Loan (Return Pending)</span>
                            </span>
                          )}

                          <span className="font-bold text-sm text-stone-900">
                            {record.teacherName}
                          </span>

                          <span className="text-[11px] text-stone-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stone-400" />
                            <span>{record.date}</span>
                          </span>

                          <span className="text-[11px] text-stone-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>{formatTime12h(record.time)}</span>
                          </span>
                        </div>

                        {/* Items Borrowed / Taken List */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {record.itemDetails && record.itemDetails.length > 0 ? (
                            record.itemDetails.map((item, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                  item.isConsumable
                                    ? 'bg-blue-50/70 text-blue-900 border-blue-200'
                                    : 'bg-amber-50/70 text-amber-900 border-amber-200'
                                }`}
                              >
                                <span>{item.isConsumable ? '📦' : '🔄'}</span>
                                <span className="font-bold">{item.itemName}</span>
                                {item.quantity && item.quantity > 1 && (
                                  <span className="font-mono text-[10px] opacity-75 font-bold">
                                    (x{item.quantity})
                                  </span>
                                )}
                              </span>
                            ))
                          ) : (
                            record.selectedItems?.map((item, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-stone-100 text-stone-800 px-2 py-0.5 rounded-md border border-stone-200"
                              >
                                {item}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Purpose & Remarks */}
                        {(record.purpose || record.remarks) && (
                          <div className="text-xs text-stone-600 italic pt-0.5">
                            {record.purpose && <span>Purpose: "{record.purpose}" </span>}
                            {record.remarks && <span className="text-stone-400">({record.remarks})</span>}
                          </div>
                        )}

                        {/* Return timestamp note */}
                        {record.returnedAt && (
                          <div className="text-[11px] text-emerald-800 font-medium">
                            Returned on: {record.returnedAt}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {isLoanPending ? (
                          <button
                            type="button"
                            onClick={() => handleMarkReturned(record)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Returned</span>
                          </button>
                        ) : isConsumed ? (
                          <span className="text-xs font-semibold text-blue-700 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-200">
                            Consumables Dispatched
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                            Completed
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record)}
                          className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

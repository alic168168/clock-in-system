import { useState, useEffect } from 'react';
import { MOCK_LEAVES, MOCK_SCHEDULES, STORES } from '../data/mock';
import { api } from '../services/api';
import { format } from 'date-fns';
import { FileDown, User as UserIcon, History, Building2, Download, Trash2, Search, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface AttendanceRecord {
    id: string;
    userId: string;
    userName: string;
    storeName: string;
    storeId: string;
    checkInTime: string;
    isOvertime: boolean;
    type: string;
    note?: string;
}

export default function Records() {
    const { user, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<'history' | 'employees'>('history');
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDate, setSearchDate] = useState('');
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    // Permission Flags
    const canViewAll = hasPermission('view_all_records');
    const canEdit = hasPermission('edit_records');
    const canExport = hasPermission('export_data');
    const canViewEmployees = hasPermission('manage_users') || canViewAll; // Basic visibility for employees list?

    useEffect(() => {
        const loadRecords = async () => {
            setLoading(true);
            try {
                // Fetch records, users, and shifts
                const [recordData, userData, shiftData] = await Promise.all([
                    api.getRecords(),
                    api.getUsers(),
                    api.getShifts()
                ]);

                setHistory(recordData.reverse().map(r => {
                    // Parse Persistence Marker on load
                    const hasMarker = r.note && r.note.includes(' [OV]');
                    const persistedOvertime = hasMarker || r.isOvertime;
                    const displayNote = r.note ? r.note.replace(' [OV]', '') : '';

                    return {
                        ...r,
                        userName: r.userName || 'Unknown',
                        storeName: r.storeName || 'Unknown',
                        type: (r.type === 'check-in' || r.type === 'check-out') ? r.type : 'check-in',
                        isOvertime: !!persistedOvertime,
                        note: displayNote || ''
                    } as AttendanceRecord;
                }));
                setShifts(shiftData);

                // Fetch users for the employees tab, normalizing IDs
                if (userData.length > 0) {
                    setUsers(userData.map((u: any) => ({
                        ...u,
                        id: String(u.id),
                        storeId: String(u.storeId)
                    })));
                }
            } catch (err) {
                console.error('Failed to load data', err);
            } finally {
                setLoading(false);
            }
        };
        loadRecords();
    }, []);

    const handleDelete = async (record: AttendanceRecord) => {
        if (!canEdit) return;
        if (!confirm('確定要刪除這筆紀錄嗎？此動作無法復原。')) return;

        // Optimistic update
        const prevHistory = [...history];
        setHistory(prevHistory.filter(r => r.id !== record.id));

        const result = await api.deleteRecord(record.id);
        if (result.success) {
            localStorage.removeItem(`lastActionTime_${record.userId}`);
            localStorage.removeItem(`lastCheckIn_${record.userId}`);
        } else {
            alert('刪除失敗：' + result.message);
            setHistory(prevHistory); // Rollback
        }
    };

    // Helper to determine shift based on time
    const getShiftName = (checkInTimeStr: string, shiftList = shifts) => {
        if (!shiftList.length || !checkInTimeStr) return '';

        try {
            const checkInDate = new Date(checkInTimeStr);
            // Ensure we are working with local hours
            const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();

            let closestShift = null;
            let minDiff = Infinity;

            for (const shift of shiftList) {
                let startMinutes = -1;

                // Prioritize checking for ISO-like strings or standard Date objects
                if (shift.startTime instanceof Date) {
                    startMinutes = shift.startTime.getHours() * 60 + shift.startTime.getMinutes();
                } else if (typeof shift.startTime === 'string') {
                    // Check if it's an ISO string (contains 'T') or looks like a date
                    if (shift.startTime.includes('T') || shift.startTime.includes('-')) {
                        const d = new Date(shift.startTime);
                        if (!isNaN(d.getTime())) {
                            startMinutes = d.getHours() * 60 + d.getMinutes();
                        }
                    }
                    // Fallback to simple HH:mm check ONLY if it doesn't look like a date
                    else if (shift.startTime.includes(':')) {
                        const parts = shift.startTime.split(':');
                        if (parts.length >= 2) {
                            const hh = parseInt(parts[0], 10);
                            const mmVal = parseInt(parts[1], 10);
                            if (!isNaN(hh) && !isNaN(mmVal)) {
                                startMinutes = hh * 60 + mmVal;
                            }
                        }
                    }
                }

                if (startMinutes === -1) continue; // Skip invalid shifts

                // Calculate Diff (Shortest distance on 24h clock)
                let diff = Math.abs(checkInMinutes - startMinutes);

                // Handle wrap-around (e.g. 23:00 vs 01:00 should be 2 hours, not 22)
                if (diff > 720) {
                    diff = 1440 - diff;
                }

                // Debug Log (Development only) - Adjusted to be cleaner
                // console.log(`[ShiftCalc] Shift: ${shift.name}, Time: ${Math.floor(startMinutes / 60)}:${startMinutes % 60} (${startMinutes}), CheckIn: ${Math.floor(checkInMinutes / 60)}:${checkInMinutes % 60}, Diff: ${diff}`);

                if (diff < minDiff) {
                    minDiff = diff;
                    closestShift = shift;
                }
            }

            // Threshold: 4 hours (240 mins) to catch wider range of late/early clock-ins
            if (minDiff > 240) {
                return '';
            }

            return closestShift ? closestShift.name : '';

        } catch (e) {
            console.error('Shift Calc Error', e);
            return '';
        }
    };

    const handleToggleOvertime = async (record: AttendanceRecord) => {
        // Permission Check
        if (!canEdit) return;

        if (!confirm(`確定要更改此紀錄的加班狀態為 ${!record.isOvertime ? '是' : '否'} 嗎？`)) return;

        // Optimistic Update
        const originalHistory = [...history];
        const updatedRecord = { ...record, isOvertime: !record.isOvertime };

        setHistory(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
        setProcessingIds(prev => new Set(prev).add(record.id));

        try {
            // 1. Delete old record
            const delResult = await api.deleteRecord(record.id);
            if (!delResult.success) throw new Error(delResult.message);

            // 2. Create new record with Persistence Marker in Note
            // " [OV]" logic
            const marker = ' [OV]';
            // Safe note handling (handle possible undefined)
            const currentNote = record.note || '';
            const baseNote = currentNote.replace(marker, '');
            const newIsOvertime = !record.isOvertime;
            const newNote = newIsOvertime ? (baseNote + marker) : baseNote;

            const newRecord: any = {
                userId: record.userId,
                type: record.type,
                checkInTime: record.checkInTime,
                storeId: record.storeId,
                storeName: record.storeName,
                isOvertime: newIsOvertime,
                note: newNote
            };

            const createResult = await api.createRecord(newRecord as any);
            if (!createResult.success) throw new Error(createResult.message);

            // 3. Silent Re-fetch
            const records = await api.getRecords();
            setHistory(records.map(r => {
                // Parse Persistence Marker
                const hasMarker = r.note && r.note.includes(' [OV]');
                const persistedOvertime = hasMarker || r.isOvertime;
                const displayNote = r.note ? r.note.replace(' [OV]', '') : '';

                return {
                    ...r,
                    userName: r.userName || 'Unknown',
                    storeName: r.storeName || 'Unknown',
                    type: (r.type === 'check-in' || r.type === 'check-out') ? r.type : 'check-in',
                    isOvertime: !!persistedOvertime,
                    note: displayNote || ''
                } as AttendanceRecord;
            }).sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()));

        } catch (e: any) {
            console.error(e);
            alert('更新失敗: ' + e.message);
            setHistory(originalHistory); // Rollback
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(record.id);
                return next;
            });
        }
    };

    const exportExcel = async () => {
        if (!canExport) {
            alert('您沒有匯出權限');
            return;
        }
        try {
            if (history.length === 0) {
                alert('無資料可匯出');
                return;
            }

            // Dynamic import to avoid build issues
            const { utils, writeFile } = await import('xlsx-js-style');

            // Apply View Filter Logic to Export as well
            // Only export what user can see
            const exportableHistory = canViewAll ? history : history.filter(r => r.userId === user?.id);

            // Group history by User ID
            const recordsByUser: Record<string, AttendanceRecord[]> = {};
            exportableHistory.forEach(record => {
                if (!recordsByUser[record.userId]) {
                    recordsByUser[record.userId] = [];
                }
                recordsByUser[record.userId].push(record);
            });

            const wb = utils.book_new();
            const currentMonthStr = format(new Date(), 'yyyy-MM');

            // Initial Summary Sheet
            const summaryHeaders = [
                '員工姓名', 'ID', '本月打卡次數',
                '上班天數', '上班總時數',
                '事假(天)', '病假(天)', '喪假(天)', '公假(天)',
                '找代班(次)', '代班支援(次)'
            ];
            const summaryData = [summaryHeaders];

            // Process each user
            Object.keys(recordsByUser).forEach(userId => {
                const userRecords = recordsByUser[userId];
                const userName = userRecords[0]?.userName || userId;

                const linkedUser = users.find(u => String(u.id) === String(userId));

                // Merge records for calc
                const sortedRecords = [...userRecords].sort((a, b) =>
                    new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
                );

                let totalWorkMilliseconds = 0;
                const workDaysSet = new Set<string>();

                let tempCheckIn: AttendanceRecord | null = null;

                // Calculate Hours & Days
                sortedRecords.forEach(r => {
                    const dateStr = format(new Date(r.checkInTime), 'yyyy-MM-dd');
                    if (r.type === 'check-in') {
                        tempCheckIn = r;
                        workDaysSet.add(dateStr);
                    } else if (r.type === 'check-out' && tempCheckIn) {
                        const t1 = new Date(tempCheckIn.checkInTime);
                        const t2 = new Date(r.checkInTime);
                        t1.setSeconds(0, 0);
                        t2.setSeconds(0, 0);

                        const diff = t2.getTime() - t1.getTime();
                        totalWorkMilliseconds += diff;
                        tempCheckIn = null;
                    }
                });

                const totalHours = (totalWorkMilliseconds / (1000 * 60 * 60)).toFixed(1);
                const workDays = workDaysSet.size;

                // Leaves & Subbing
                const userLeaves = MOCK_LEAVES.filter(l =>
                    String(l.userId) === String(userId) &&
                    l.status === 'approved' &&
                    l.startDate.startsWith(currentMonthStr)
                );
                const leaveStats = { '事假': 0, '病假': 0, '喪假': 0, '公假': 0 };
                userLeaves.forEach(l => {
                    const start = new Date(l.startDate);
                    const end = new Date(l.endDate);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    if (l.type in leaveStats) leaveStats[l.type as keyof typeof leaveStats] += diffDays;
                });

                const lookingForSubCount = MOCK_SCHEDULES.filter(s =>
                    String(s.userId) === String(userId) &&
                    s.isOpenForSub &&
                    s.date.startsWith(currentMonthStr)
                ).length;

                const subbingCount = MOCK_SCHEDULES.filter(s =>
                    String((s as any).subUserId) === String(userId) &&
                    s.date.startsWith(currentMonthStr)
                ).length;

                summaryData.push([
                    linkedUser ? linkedUser.name : userName,
                    userId,
                    String(userRecords.length),
                    String(workDays),
                    totalHours,
                    String(leaveStats['事假']),
                    String(leaveStats['病假']),
                    String(leaveStats['喪假']),
                    String(leaveStats['公假']),
                    String(lookingForSubCount),
                    String(subbingCount)
                ]);

                // Individual Sheet Data
                // Format: [Date, Shift, In, Out, Hours, Store, Status, Overtime]
                const wsData = [
                    ['員工:', linkedUser ? linkedUser.name : userName, userId],
                    [],
                    ['本月統計詳情'],
                    ['事假(天)', '病假(天)', '喪假(天)', '公假(天)', '找代班(次)', '代班支援(次)', '', '上班總時數', '上班天數'],
                    [
                        String(leaveStats['事假']), String(leaveStats['病假']), String(leaveStats['喪假']), String(leaveStats['公假']),
                        String(lookingForSubCount), String(subbingCount), '', totalHours, String(workDays)
                    ],
                    [],
                    ['日期', '班別', '上班', '下班', '時數', '店舖', '狀態', '加班']
                ];

                let tableCheckIn: AttendanceRecord | null = null;
                sortedRecords.forEach(r => {
                    if (r.type === 'check-in') {
                        if (tableCheckIn) {
                            const dateStr = format(new Date(tableCheckIn.checkInTime), 'yyyy-MM-dd');
                            wsData.push([
                                dateStr,
                                getShiftName(tableCheckIn.checkInTime),
                                format(new Date(tableCheckIn.checkInTime), 'HH:mm'),
                                '漏打卡',
                                '0:00',
                                tableCheckIn.storeName,
                                '異常',
                                (tableCheckIn.isOvertime || r.isOvertime) ? '是' : ''
                            ]);
                        }
                        tableCheckIn = r;
                    } else if (r.type === 'check-out') {
                        if (tableCheckIn) {
                            const dateStr = format(new Date(tableCheckIn.checkInTime), 'yyyy-MM-dd');
                            const t1 = new Date(tableCheckIn.checkInTime);
                            const t2 = new Date(r.checkInTime);
                            t1.setSeconds(0, 0);
                            t2.setSeconds(0, 0);
                            const diffMs = t2.getTime() - t1.getTime();
                            const h = Math.floor(diffMs / (1000 * 60 * 60));
                            const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            const durationStr = `${h}:${m.toString().padStart(2, '0')}`;

                            wsData.push([
                                dateStr,
                                getShiftName(tableCheckIn.checkInTime),
                                format(new Date(tableCheckIn.checkInTime), 'HH:mm'),
                                format(new Date(r.checkInTime), 'HH:mm'),
                                durationStr,
                                tableCheckIn.storeName,
                                '正常',
                                (tableCheckIn.isOvertime || r.isOvertime) ? '是' : ''
                            ]);
                            tableCheckIn = null;
                        } else {
                            const dateStr = format(new Date(r.checkInTime), 'yyyy-MM-dd');
                            wsData.push([
                                dateStr,
                                '',
                                '漏打卡',
                                format(new Date(r.checkInTime), 'HH:mm'),
                                '0:00',
                                r.storeName,
                                '異常',
                                r.isOvertime ? '是' : ''
                            ]);
                        }
                    }
                });

                if (tableCheckIn) {
                    const cin = tableCheckIn as AttendanceRecord;
                    const dateStr = format(new Date(cin.checkInTime), 'yyyy-MM-dd');
                    wsData.push([
                        dateStr,
                        getShiftName(cin.checkInTime),
                        format(new Date(cin.checkInTime), 'HH:mm'),
                        '漏打卡',
                        '0:00',
                        cin.storeName,
                        '異常',
                        cin.isOvertime ? '是' : ''
                    ]);
                }

                const ws = utils.aoa_to_sheet(wsData);
                // Style Application for "是" (Overtime)
                const range = utils.decode_range(ws['!ref'] || 'A1:H1');
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const colIndex = 7; // Column H (Overtime)
                    const cellAddress = utils.encode_cell({ c: colIndex, r: R });
                    if (ws[cellAddress] && ws[cellAddress].v === '是') {
                        ws[cellAddress].s = {
                            fill: { fgColor: { rgb: "FFFF00" } }, // Yellow
                            font: { color: { rgb: "FF0000" }, bold: true }, // Red Text
                            alignment: { horizontal: "center" }
                        };
                    }
                }

                // Set column widths
                ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 6 }, { wch: 6 }];

                // Generate Unique Sheet Name
                // Prefer linkedUser name (latest from API) over record snapshot
                const finalSheetNameRaw = linkedUser ? linkedUser.name : userName;

                // Excel max length is 31 chars. invalid chars: : \ / ? * [ ]
                const cleanName = finalSheetNameRaw.replace(/[:\\/?*\[\]]/g, '');
                const idSuffix = `(${userId})`;
                const maxNameLen = 31 - idSuffix.length;
                const safeName = cleanName.slice(0, Math.max(1, maxNameLen));
                const sheetName = `${safeName}${idSuffix}`;

                utils.book_append_sheet(wb, ws, sheetName);
            });

            // Add Summary Sheet at the beginning
            const wsSummary = utils.aoa_to_sheet(summaryData);
            wsSummary['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
            utils.book_append_sheet(wb, wsSummary, "總結報表");

            const todayStr = format(new Date(), 'yyyyMMdd_HHmmss');
            writeFile(wb, `打卡紀錄_Export_${todayStr}.xlsx`);

        } catch (e: any) {
            console.error('Export Error', e);
            alert('匯出失敗: ' + e.message);
        }
    };

    // Filter Logic
    const fullHistory = history; // Raw history
    // Apply View Permission Filter
    const accessibleHistory = canViewAll ? fullHistory : fullHistory.filter(r => String(r.userId) === String(user?.id));

    // Apply Search/Date Filter on top
    const filteredHistory = accessibleHistory.filter(record => {
        // Name/ID Filter
        const term = searchTerm.toLowerCase();
        const linkedUser = users.find(u => String(u.id) === String(record.userId));
        const displayName = linkedUser ? linkedUser.name : record.userName;

        const matchesTerm = !term ||
            displayName.toLowerCase().includes(term) ||
            String(record.userId).includes(term) ||
            String(record.storeName).includes(term);

        // Date Filter
        const dateStr = format(new Date(record.checkInTime), 'yyyy-MM-dd');
        const matchesDate = !searchDate || dateStr === searchDate;

        return matchesTerm && matchesDate;
    });

    const filteredUsers = users.filter(user => {
        const term = searchTerm.toLowerCase();
        return !term ||
            user.name.toLowerCase().includes(term) ||
            String(user.id).includes(term) ||
            String(user.storeId).includes(term);
    });

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Tabs */}
            <div className="bg-white p-1 rounded-xl shadow-sm flex">
                <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all",
                        activeTab === 'history' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                    )}
                >
                    <History size={16} />
                    <span>打卡紀錄</span>
                </button>
                {canViewEmployees && (
                    <button
                        onClick={() => setActiveTab('employees')}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all",
                            activeTab === 'employees' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        <UserIcon size={16} />
                        <span>員工列表</span>
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 min-h-[60vh]">
                {/* Global Search and Filter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    <div className="flex space-x-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="搜尋姓名或 ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all outline-none"
                            />
                        </div>
                        {/* Dropdown for Quick User Select - Only show if has permission */}
                        {canViewAll && (
                            <select
                                className="bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all outline-none px-2 py-2 w-32 md:w-40"
                                onChange={(e) => setSearchTerm(e.target.value)}
                                value={users.some(u => u.name === searchTerm || String(u.id) === searchTerm) ? searchTerm : ''}
                            >
                                <option value="">全部員工</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.name}>
                                        {u.name} ({u.id})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {activeTab === 'history' && (
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="date"
                                value={searchDate}
                                onChange={(e) => setSearchDate(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all outline-none"
                            />
                        </div>
                    )}
                </div>

                {activeTab === 'history' ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 text-lg">近期紀錄</h3>
                            {canExport && (
                                <button
                                    onClick={exportExcel}
                                    className="flex items-center space-x-1.5 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 active:bg-green-200 transition-colors"
                                >
                                    <Download size={14} />
                                    <span>匯出 Excel</span>
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : filteredHistory.length > 0 ? (
                            <div className="space-y-3">
                                {filteredHistory.map((record) => {
                                    const dateObj = new Date(record.checkInTime);
                                    const isValidDate = !isNaN(dateObj.getTime());
                                    const showDebug = !isValidDate;

                                    const dateStr = isValidDate ? format(dateObj, 'MM/dd') : 'Invalid Date';
                                    const timeStr = isValidDate ? format(dateObj, 'HH:mm') : '--:--';

                                    // Resolve user name and store name dynamically if possible
                                    let displayName = record.userName;
                                    let storeName = record.storeName;

                                    const linkedUser = users.find(u => String(u.id) === String(record.userId));
                                    if (linkedUser) {
                                        displayName = `${linkedUser.name} (${linkedUser.id})`; // Display Name (ID)
                                    }

                                    const storeObj = STORES.find(s => s.id === record.storeId);
                                    if (storeObj) {
                                        storeName = storeObj.name;
                                    }

                                    return (
                                        <div key={record.id} className="group relative flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-100 hover:shadow-md transition-all">
                                            <div className="flex justify-between items-center w-full">
                                                <div className="flex items-center space-x-3">
                                                    {canEdit ? (
                                                        <button
                                                            onClick={() => handleToggleOvertime(record)}
                                                            disabled={processingIds.has(record.id)}
                                                            className={cn(
                                                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-transform shadow-sm",
                                                                processingIds.has(record.id) ? "bg-gray-100 cursor-wait opacity-70" : "hover:scale-105 active:scale-95",
                                                                !processingIds.has(record.id) && record.isOvertime ? "bg-amber-100 text-amber-700 ring-2 ring-amber-200" : "",
                                                                !processingIds.has(record.id) && !record.isOvertime ? (record.type === 'check-in' ? "bg-blue-100 text-blue-600 hover:ring-2 hover:ring-blue-200" : "bg-gray-100 text-gray-600") : ""
                                                            )}
                                                            title="點擊切換加班狀態 (Admin Only)"
                                                        >
                                                            {processingIds.has(record.id) ? (
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                                                            ) : (
                                                                record.isOvertime ? '加班' : (record.type === 'check-in' ? '上班' : '下班')
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs",
                                                            record.isOvertime ? "bg-amber-100 text-amber-700" :
                                                                record.type === 'check-in' ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                                                        )}>
                                                            {record.isOvertime ? '加班' : (record.type === 'check-in' ? '上班' : '下班')}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{displayName}</p>
                                                        <p className="text-xs text-gray-500 flex items-center mt-0.5">
                                                            <Building2 size={10} className="mr-1" />
                                                            {storeName}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <div className="text-right">
                                                        <p className="text-sm font-mono font-medium text-gray-800">
                                                            {dateStr}
                                                        </p>
                                                        <p className="text-xs text-gray-500 font-mono">
                                                            {timeStr}
                                                        </p>
                                                    </div>

                                                    {/* Delete Button */}
                                                    {canEdit && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(record);
                                                            }}
                                                            className="text-gray-300 hover:text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="刪除"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {showDebug && (
                                                <div className="mt-2 p-2 bg-red-50 text-red-600 text-[10px] font-mono rounded overflow-auto whitespace-pre-wrap leading-tight">
                                                    DEBUG: Invalid Data
                                                    <br />TimeRaw: {JSON.stringify(record.checkInTime)}
                                                    <br />StoreIdRaw: {JSON.stringify(record.storeId)}
                                                    <br />CurrentTimeParse: {dateObj.toString()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <FileDown size={48} className="mx-auto mb-3 opacity-20" />
                                <p>目前尚無打卡紀錄</p>
                                <p className="text-xs mt-1">請先至首頁進行打卡</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="font-bold text-gray-800 mb-4">所有員工設定</h3>
                        <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 mb-4">
                            提示：如果看不到最新資料，請嘗試重新整理網頁
                        </div>
                        <div className="space-y-3">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(u => (
                                    <div key={u.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold">
                                                {u.name[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{u.name} ({u.id})</p>
                                                <p className="text-xs text-gray-500">{u.role === 'admin' ? '店長/管理員' : '一般員工'}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-500">
                                            Store: {u.storeId}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-center">無員工資料 (符合搜尋條件)</p>
                            )}
                        </div>
                        <p className="text-xs text-center text-gray-400 mt-6 pt-4 border-t border-dashed">
                            此為來自 Google Sheets 的最新資料
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

<div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 min-h-[60vh]">
    {/* Global Search and Filter */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="flex space-x-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    placeholder="搜尋姓名或 ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all outline-none"
                />
            </div>
            {/* Dropdown for Quick User Select */}
            <select
                className="bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all outline-none px-2 py-2 w-32 md:w-40"
                onChange={(e) => setSearchTerm(e.target.value)}
                value={users.some(u => u.name === searchTerm || String(u.id) === searchTerm) ? searchTerm : ''}
            >
                <option value="">全部員工</option>
                {users.map(u => (
                    <option key={u.id} value={u.name}>
                        {u.name} ({u.id})
                    </option>
                ))}
            </select>
        </div>

        {activeTab === 'history' && (
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all outline-none"
                />
            </div>
        )}
    </div>

    {activeTab === 'history' ? (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-lg">近期紀錄</h3>
                <button
                    onClick={exportExcel}
                    className="flex items-center space-x-1.5 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 active:bg-green-200 transition-colors"
                >
                    <Download size={14} />
                    <span>匯出 Excel</span>
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredHistory.length > 0 ? (
                <div className="space-y-3">
                    {filteredHistory.map((record) => {
                        const dateObj = new Date(record.checkInTime);
                        const isValidDate = !isNaN(dateObj.getTime());
                        const showDebug = !isValidDate;

                        const dateStr = isValidDate ? format(dateObj, 'MM/dd') : 'Invalid Date';
                        const timeStr = isValidDate ? format(dateObj, 'HH:mm') : '--:--';

                        // Resolve user name and store name dynamically if possible
                        let displayName = record.userName;
                        let storeName = record.storeName;

                        const linkedUser = users.find(u => String(u.id) === String(record.userId));
                        if (linkedUser) {
                            displayName = `${linkedUser.name} (${linkedUser.id})`; // Display Name (ID)
                        }

                        const storeObj = STORES.find(s => s.id === record.storeId);
                        if (storeObj) {
                            storeName = storeObj.name;
                        }

                        return (
                            <div key={record.id} className="group relative flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-100 hover:shadow-md transition-all">
                                <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center space-x-3">
                                        {(user?.role === 'admin' || user?.id === 'admin') ? (
                                            <button
                                                onClick={() => handleToggleOvertime(record)}
                                                disabled={processingIds.has(record.id)}
                                                className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-transform shadow-sm",
                                                    processingIds.has(record.id) ? "bg-gray-100 cursor-wait opacity-70" : "hover:scale-105 active:scale-95",
                                                    !processingIds.has(record.id) && record.isOvertime ? "bg-amber-100 text-amber-700 ring-2 ring-amber-200" : "",
                                                    !processingIds.has(record.id) && !record.isOvertime ? (record.type === 'check-in' ? "bg-blue-100 text-blue-600 hover:ring-2 hover:ring-blue-200" : "bg-gray-100 text-gray-600") : ""
                                                )}
                                                title="點擊切換加班狀態 (Admin Only)"
                                            >
                                                {processingIds.has(record.id) ? (
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                                                ) : (
                                                    record.isOvertime ? '加班' : (record.type === 'check-in' ? '上班' : '下班')
                                                )}
                                            </button>
                                        ) : (
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs",
                                                record.isOvertime ? "bg-amber-100 text-amber-700" :
                                                    record.type === 'check-in' ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                                            )}>
                                                {record.isOvertime ? '加班' : (record.type === 'check-in' ? '上班' : '下班')}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{displayName}</p>
                                            <p className="text-xs text-gray-500 flex items-center mt-0.5">
                                                <Building2 size={10} className="mr-1" />
                                                {storeName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <div className="text-right">
                                            <p className="text-sm font-mono font-medium text-gray-800">
                                                {dateStr}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono">
                                                {timeStr}
                                            </p>
                                        </div>

                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(record);
                                            }}
                                            className="text-gray-300 hover:text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="刪除"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                {showDebug && (
                                    <div className="mt-2 p-2 bg-red-50 text-red-600 text-[10px] font-mono rounded overflow-auto whitespace-pre-wrap leading-tight">
                                        DEBUG: Invalid Data
                                        <br />TimeRaw: {JSON.stringify(record.checkInTime)}
                                        <br />StoreIdRaw: {JSON.stringify(record.storeId)}
                                        <br />CurrentTimeParse: {dateObj.toString()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-400">
                    <FileDown size={48} className="mx-auto mb-3 opacity-20" />
                    <p>目前尚無打卡紀錄</p>
                    <p className="text-xs mt-1">請先至首頁進行打卡</p>
                </div>
            )}
        </div>
    ) : (
        <div className="space-y-4">
            <h3 className="font-bold text-gray-800 mb-4">所有員工設定</h3>
            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 mb-4">
                提示：如果看不到最新資料，請嘗試重新整理網頁
            </div>
            <div className="space-y-3">
                {filteredUsers.length > 0 ? (
                    filteredUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold">
                                    {u.name[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{u.name} ({u.id})</p>
                                    <p className="text-xs text-gray-500">{u.role === 'admin' ? '店長/管理員' : '一般員工'}</p>
                                </div>
                            </div>
                            <div className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-500">
                                Store: {u.storeId}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-400 text-center">無員工資料 (符合搜尋條件)</p>
                )}
            </div>
            <p className="text-xs text-center text-gray-400 mt-6 pt-4 border-t border-dashed">
                此為來自 Google Sheets 的最新資料
            </p>
        </div>
    )}
</div>
        </div >
    );
}

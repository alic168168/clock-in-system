import { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MOCK_SCHEDULES, MOCK_USERS, SHIFTS } from '../data/mock';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import type { Schedule } from '../types';

export default function SchedulePage() {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedules, setSchedules] = useState<Schedule[]>(MOCK_SCHEDULES);
    const [message, setMessage] = useState<string | null>(null);

    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i));

    const getUserName = (id: string) => MOCK_USERS.find(u => u.id === id)?.name || id;
    const getShiftName = (id: string) => SHIFTS.find(s => s.id === id)?.name || id;
    const getShiftTime = (id: string) => {
        const s = SHIFTS.find(shift => shift.id === id);
        return s ? `${s.startTime}-${s.endTime}` : '';
    };

    const handleOpenForSub = (scheduleId: string) => {
        if (!confirm('確定要釋出此班別尋找代班嗎？')) return;

        setSchedules(prev => prev.map(s =>
            s.id === scheduleId ? { ...s, isOpenForSub: true } : s
        ));
        setMessage('已釋出班別，等待同事接手');
        setTimeout(() => setMessage(null), 3000);
    };

    const handleTakeSub = (scheduleId: string) => {
        if (!confirm('確定要幫忙代這個班嗎？')) return;

        setSchedules(prev => prev.map(s =>
            s.id === scheduleId ? { ...s, isOpenForSub: false, subRequesterId: s.userId, userId: user?.id || '' } : s
        ));
        setMessage('接取代班成功！已更新至您的班表');
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Week Navigation */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm">
                <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
                    &lt;
                </button>
                <div className="text-center">
                    <h2 className="font-bold text-gray-800 flex items-center justify-center gap-2">
                        <CalendarIcon size={18} />
                        {format(startOfCurrentWeek, 'MM/dd')} - {format(addDays(startOfCurrentWeek, 6), 'MM/dd')}
                    </h2>
                    <p className="text-xs text-gray-500">本週班表</p>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
                    &gt;
                </button>
            </div>

            {/* Message Toast */}
            {message && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-in slide-in-from-top">
                    <CheckCircle2 size={20} className="mr-2" />
                    {message}
                </div>
            )}

            {/* Week List */}
            <div className="space-y-4">
                {weekDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const daySchedules = schedules.filter(s => s.date === dateStr && s.storeId === user?.storeId);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div key={dateStr} className={cn("bg-white rounded-xl overflow-hidden shadow-sm border", isToday ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-100")}>
                            {/* Date Header */}
                            <div className={cn("px-4 py-2 text-sm font-medium flex justify-between items-center", isToday ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500")}>
                                <span>{format(day, 'yyyy/MM/dd (EEE)')}</span>
                                {isToday && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">Today</span>}
                            </div>

                            {/* Shifts */}
                            <div className="divide-y divide-gray-100">
                                {daySchedules.length > 0 ? (
                                    daySchedules.map(schedule => {
                                        const isMyShift = schedule.userId === user?.id;
                                        const isSubNeeded = schedule.isOpenForSub;

                                        return (
                                            <div key={schedule.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center space-x-3">
                                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                                                        schedule.shiftId === 'night' ? "bg-indigo-500" :
                                                            schedule.shiftId === 'middle' ? "bg-orange-400" : "bg-sky-400"
                                                    )}>
                                                        {getShiftName(schedule.shiftId)[0]}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900">{getShiftName(schedule.shiftId)}</span>
                                                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                                                {getShiftTime(schedule.shiftId)}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-500 flex items-center mt-0.5">
                                                            <UserIcon size={12} className="mr-1" />
                                                            {getUserName(schedule.userId)}
                                                            {schedule.subRequesterId && <span className="text-xs text-red-400 ml-1">(代 {getUserName(schedule.subRequesterId)})</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div>
                                                    {isMyShift && !isSubNeeded && (
                                                        <button
                                                            onClick={() => handleOpenForSub(schedule.id)}
                                                            className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
                                                        >
                                                            釋出
                                                        </button>
                                                    )}
                                                    {isSubNeeded && !isMyShift && (
                                                        <button
                                                            onClick={() => handleTakeSub(schedule.id)}
                                                            className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors flex items-center animate-pulse"
                                                        >
                                                            <AlertCircle size={12} className="mr-1" />
                                                            可代班
                                                        </button>
                                                    )}
                                                    {isSubNeeded && isMyShift && (
                                                        <span className="text-xs text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-200">
                                                            尋找中...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-sm text-gray-400 italic">
                                        尚無排班
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

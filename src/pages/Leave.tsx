import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MOCK_LEAVES } from '../data/mock';
import type { LeaveRequest } from '../types';
import { format } from 'date-fns';
import { ClipboardList, PlusCircle, History, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Leave() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'apply' | 'history'>('apply');
    const [leaves, setLeaves] = useState<LeaveRequest[]>(MOCK_LEAVES);
    const [formData, setFormData] = useState({
        type: '事假',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        reason: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Filter leaves for current user
    const myLeaves = leaves.filter(l => l.userId === user?.id).sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API call
        setTimeout(() => {
            const newLeave: LeaveRequest = {
                id: Math.random().toString(36).substr(2, 9),
                userId: user?.id || '',
                type: formData.type,
                startDate: formData.startDate,
                endDate: formData.endDate,
                reason: formData.reason,
                status: 'pending'
            };

            setLeaves([newLeave, ...leaves]);
            setSuccessMsg('假單送出成功，等待店長審核');
            setIsSubmitting(false);
            setFormData({ ...formData, reason: '' }); // Reset partial form

            // Auto switch to history after success
            setTimeout(() => {
                setSuccessMsg(null);
                setActiveTab('history');
            }, 1500);
        }, 1000);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Tabs */}
            <div className="bg-white p-1 rounded-xl shadow-sm flex">
                <button
                    onClick={() => setActiveTab('apply')}
                    className={cn(
                        "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all",
                        activeTab === 'apply' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                    )}
                >
                    <PlusCircle size={16} />
                    <span>申請請假</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all",
                        activeTab === 'history' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                    )}
                >
                    <History size={16} />
                    <span>申請紀錄</span>
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-sm p-6 min-h-[400px]">
                {activeTab === 'apply' ? (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">假別</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['事假', '病假', '特休', '喪假', '公假', '其他'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type })}
                                        className={cn(
                                            "py-2 text-sm rounded-lg border transition-all",
                                            formData.type === type
                                                ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">開始日期</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.startDate}
                                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">結束日期</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.endDate}
                                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">請假事由</label>
                            <textarea
                                required
                                placeholder="請輸入請假原因..."
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {successMsg && (
                            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center animate-in fade-in">
                                <CheckCircle2 size={16} className="mr-2" />
                                {successMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            {isSubmitting ? '送出中...' : '送出申請'}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-4">
                        {myLeaves.length > 0 ? (
                            myLeaves.map(leave => (
                                <div key={leave.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className={cn(
                                                "px-2 py-0.5 text-xs font-bold rounded",
                                                leave.type === '病假' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                                            )}>
                                                {leave.type}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {leave.startDate} {leave.startDate !== leave.endDate && `~ ${leave.endDate}`}
                                            </span>
                                        </div>
                                        {leave.status === 'approved' && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs flex items-center"><CheckCircle2 size={10} className="mr-1" />通過</span>}
                                        {leave.status === 'rejected' && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs flex items-center"><XCircle size={10} className="mr-1" />駁回</span>}
                                        {leave.status === 'pending' && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs flex items-center"><Clock size={10} className="mr-1" />審核中</span>}
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2">
                                        {leave.reason}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <ClipboardList size={48} className="mx-auto mb-3 opacity-20" />
                                <p>目前沒有請假紀錄</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

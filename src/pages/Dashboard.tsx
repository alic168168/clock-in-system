import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { MapPin, Clock, Camera, CheckCircle2, Briefcase, Radio } from 'lucide-react'; // Added Radio icon
import QRScanner from '../components/QRScanner';
import { useAttendance } from '../hooks/useAttendance';
import { useNFC } from '../hooks/useNFC'; // Import useNFC
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function Dashboard() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanResult, setScanResult] = useState<{ message: string, type: 'in' | 'out' } | null>(null);
    const [isOvertime, setIsOvertime] = useState(false); // 加班狀態

    const [timeOffset, setTimeOffset] = useState(0); // For testing: offset in ms

    const { user } = useAuth();
    const { checkIn, loading, error } = useAttendance();
    const { isSupported: isNFCSupported, scanNFC, isScanning: isNFCScanning, error: nfcError } = useNFC(); // NFC hook

    // ...

    useEffect(() => {
        // Update time every second, applying offset
        const timer = setInterval(() => {
            setCurrentTime(new Date(Date.now() + timeOffset));
        }, 1000);
        return () => clearInterval(timer);
    }, [timeOffset]);

    const handleCheckInAttempt = async (storeIdData: string) => {
        if (user) {
            // 傳入 overtime 狀態, 當前測試時間, 與 bypassGPS (false for real scans)
            const result = await checkIn(user.id, user.storeId, storeIdData, isOvertime, currentTime, false);
            setScanResult(result);
            setTimeout(() => setScanResult(null), 3000);
        }
    };

    const handleScan = async (data: string) => {
        if (!data || loading) return;
        setIsScannerOpen(false);
        await handleCheckInAttempt(data);
    };

    const handleNFCScan = () => {
        scanNFC((data) => {
            // NFC tag should contain the Store ID (e.g., "1")
            // Ensure we stop if we got data (though scanNFC listener stays active, logic prevents duplicate rapid calls via loading state if managed)
            if (!loading) {
                handleCheckInAttempt(data);
            }
        });
    };

    // Debug: Change time
    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = new Date(e.target.value);
        if (!isNaN(newTime.getTime())) {
            const offset = newTime.getTime() - Date.now();
            setTimeOffset(offset);
            setCurrentTime(newTime);
        }
    };

    const timeInputRef = useRef<HTMLInputElement>(null);

    const triggerTimePicker = () => {
        try {
            timeInputRef.current?.showPicker();
        } catch (e) {
            timeInputRef.current?.focus();
            timeInputRef.current?.click();
        }
    };

    return (
        <div className="space-y-6 relative">
            {/* 掃描器 Overlay */}
            {isScannerOpen && (
                <QRScanner
                    onScan={handleScan}
                    onClose={() => setIsScannerOpen(false)}
                    instruction="請掃描店鋪專屬 QR Code"
                />
            )}

            {/* 成功/失敗 提示訊息 */}
            {(scanResult || error || nfcError) && (
                <div className={cn(
                    "fixed top-4 left-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center justify-center animate-in slide-in-from-top duration-300",
                    (error || nfcError) ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-600 border border-green-200"
                )}>
                    {(error || nfcError) ? (
                        <span>❌ {error || nfcError}</span>
                    ) : (
                        <span className="flex items-center font-bold text-sm">
                            <CheckCircle2 className="mr-2" />
                            {scanResult?.message}
                        </span>
                    )}
                </div>
            )}

            {/* Time Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
                {/* Testing Label */}
                {timeOffset !== 0 && (
                    <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-bl-lg z-10">
                        測試模式: 時間已調整
                    </div>
                )}

                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-blue-100 text-sm font-medium">現在時間</p>
                            <button
                                onClick={triggerTimePicker}
                                className="bg-blue-700/50 hover:bg-blue-700 text-blue-100 text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-blue-400/30"
                            >
                                <Clock size={10} />
                                調整
                            </button>
                            <input
                                ref={timeInputRef}
                                type="datetime-local"
                                className="absolute top-0 left-0 w-full h-full opacity-0 z-0 cursor-pointer"
                                style={{ pointerEvents: 'none' }} // Actually, let's try overlaying it on the button if possible, OR just keep it hidden but accessible
                            />
                            {/* Wait, the previous approach of programmatic trigger is better if it works. 
                                Let's try to just remove pointer-events-none from the class and rely on showPicker.
                                And add the alert inside.
                            */}
                            <input
                                ref={timeInputRef}
                                type="datetime-local"
                                className="w-0 h-0 opacity-0 absolute"
                                onChange={(e) => {
                                    handleTimeChange(e);
                                    // alert('Time changed!'); // Debug removed, just logic fix first.
                                }}
                            />
                        </div>
                        <h1 className="text-4xl font-bold font-mono tracking-tight mt-1 relative pointer-events-none">
                            {format(currentTime, 'HH:mm')}
                            <span className="text-xl ml-1 text-blue-200">{format(currentTime, 'ss')}</span>
                        </h1>
                        <p className="text-blue-100 text-sm mt-1">{format(currentTime, 'yyyy/MM/dd EEEE')}</p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <Clock className="text-white" size={24} />
                    </div>
                </div>

                <div className="flex items-center space-x-2 text-sm bg-blue-600/30 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                    <MapPin size={14} />
                    <span>目前位置：{user?.storeId ? '已綁定店鋪' : '未偵測'}</span>
                </div>
            </div>

            {/* Main Action Area */}
            <div className="space-y-4">
                {/* Overtime Toggle */}
                <button
                    onClick={() => setIsOvertime(!isOvertime)}
                    className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200",
                        isOvertime
                            ? "bg-amber-50 border-amber-400 text-amber-700"
                            : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                    )}
                >
                    <div className="flex items-center">
                        <div className={cn("p-2 rounded-lg mr-3", isOvertime ? "bg-amber-200 text-amber-800" : "bg-gray-100")}>
                            <Briefcase size={20} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold">加班模式</div>
                            <div className="text-xs opacity-70">{isOvertime ? '已開啟加班紀錄' : '若為加班打卡請開啟'}</div>
                        </div>
                    </div>

                    <div className={cn(
                        "w-12 h-7 rounded-full p-1 transition-colors duration-200",
                        isOvertime ? "bg-amber-500" : "bg-gray-200"
                    )}>
                        <div className={cn(
                            "w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                            isOvertime ? "translate-x-5" : "translate-x-0"
                        )} />
                    </div>
                </button>

                {/* NFC Button (Only if Supported) */}
                {isNFCSupported && (
                    <button
                        onClick={handleNFCScan}
                        disabled={loading || isNFCScanning}
                        className={cn(
                            "w-full relative group overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-[0.98] transition-all duration-200 border-0 rounded-2xl p-6 flex flex-col items-center justify-center space-y-2 shadow-md disabled:opacity-50 text-white",
                            isNFCScanning && "animate-pulse"
                        )}
                    >
                        <div className="w-16 h-16 rounded-full bg-white/20 text-white flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <Radio size={32} />
                        </div>
                        <div className="text-center">
                            <span className="block text-lg font-bold">
                                {isNFCScanning ? '感應中...' : 'NFC 感應打卡'}
                            </span>
                            <span className="text-xs text-indigo-100 mt-1">請將手機靠近 NFC標籤</span>
                        </div>
                    </button>
                )}

                {/* Scan Button (QR + GPS Double Verification) */}
                <button
                    onClick={() => setIsScannerOpen(true)}
                    disabled={loading || isNFCScanning}
                    className="w-full relative group overflow-hidden bg-white hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 shadow-sm disabled:opacity-50"
                >
                    <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                        <Camera size={40} />
                    </div>
                    <div className="text-center">
                        <span className="block text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {loading ? '處理中...' : '掃描 QR Code 打卡'}
                        </span>
                        <span className="text-sm text-gray-500 mt-1">雙重驗證：需掃描 + GPS 定位</span>
                    </div>
                </button>

                {/* Manual Check-in Button (Debug/Test Only) */}
                <button
                    onClick={async () => {
                        if (user) {
                            setScanResult(await checkIn(user.id, user.storeId, '1', isOvertime, currentTime, true));
                            setTimeout(() => setScanResult(null), 3000);
                        }
                    }}
                    disabled={loading}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl p-3 text-sm font-medium transition-colors border border-dashed border-gray-300"
                >
                    🛠️ 手動打卡 (測試用: 略過 GPS - 台北信義店)
                </button>
            </div>
        </div>
    );
}

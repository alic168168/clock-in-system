import { useState, useRef } from 'react';
import { api } from '../services/api';
import type { Attendance } from '../types';

export function useAttendance() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use a ref for synchronous locking to prevent race conditions that state cannot handle
    const processingRef = useRef(false);

    // 模擬打卡 API 請求
    const checkIn = async (userId: string, expectedStoreId: string, actualStoreIdFromQR: string, isOvertime: boolean = false, customTime?: Date, bypassGPS: boolean = false): Promise<{ success: boolean; message: string; type: 'in' | 'out' }> => {
        // 1. Synchronous Lock Check
        if (loading || processingRef.current) {
            console.warn('Check-in blocked: Already processing');
            return { success: false, message: '系統處理中，請勿重複點擊', type: 'in' };
        }

        // 2. Set Lock & State
        processingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            // 0. 防範重複打卡 (Cooldown: 60 minutes)
            const lastActionTime = localStorage.getItem(`lastActionTime_${userId}`);
            const now = customTime || new Date();

            if (lastActionTime) {
                const diff = now.getTime() - new Date(lastActionTime).getTime();
                // 設為 60 分鐘冷靜期，避免誤觸導致上班變成下班
                // 注意：這意味著上班後 1 小時內無法打卡下班
                if (diff < 1000 * 60 * 60) {
                    const minutesLeft = Math.ceil((1000 * 60 * 60 - diff) / (1000 * 60));
                    const msg = `打卡間隔過短，請於 ${minutesLeft} 分鐘後再試`;
                    setError(msg);
                    return { success: false, message: msg, type: 'in' };
                }
            }

            // 1. 驗證地點
            // Dynamic import or move logic to ensure freshness
            const { getStores } = await import('../utils/storeManager');
            const stores = getStores();

            // Clean the input
            const cleanContent = actualStoreIdFromQR.trim();

            const actualStore = stores.find(s =>
                String(s.id) === cleanContent ||
                (s.qrContent && String(s.qrContent).trim() === cleanContent)
            );

            if (!actualStore) {
                const msg = `無效的 QR Code：無法識別店鋪 (掃描內容: "${cleanContent}")`;
                setError(msg);
                return { success: false, message: msg, type: 'in' };
            }

            // 1.5 GPS 位置驗證
            try {
                // 如果是手動輸入測試模式 (沒有 actualStoreIdFromQR 但有 storeId) 則跳過
                // 但這裡是 QR Code 掃描，所以必須檢查
                if (!bypassGPS && actualStore.lat && actualStore.lng) {
                    if (!navigator.geolocation) throw new Error('瀏覽器不支援地理位置');

                    const position = await new Promise<GeolocationPosition>((res, rej) => {
                        navigator.geolocation.getCurrentPosition(res, rej, {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0
                        });
                    });

                    const { latitude, longitude, accuracy } = position.coords;
                    // Dynamic import to avoid circular dependency if utils uses mock (it doesn't, but safe practice)
                    const { calculateDistance } = await import('../lib/utils');

                    const distance = calculateDistance(latitude, longitude, actualStore.lat, actualStore.lng);
                    const allowedRadius = actualStore.radius || 30; // default 30m

                    console.log(`GPS Check: Dist=${Math.round(distance)}m, Limit=${allowedRadius}m, Acc=${Math.round(accuracy)}m`);

                    if (distance > allowedRadius) {
                        const msg = `位置過遠 (距 ${Math.round(distance)}m, 誤差 ±${Math.round(accuracy)}m)\n\n店鋪設定: ${actualStore.lat?.toFixed(5)}, ${actualStore.lng?.toFixed(5)}\n您的位置: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n\n💡 建議：請至「設定 > 店鋪位置」點擊「使用目前位置」以更新店鋪座標。`;
                        setError(msg);
                        return { success: false, message: msg, type: 'in' };
                    }
                }
            } catch (geoErr) {
                console.warn('GPS Validation Failed:', geoErr);
                // Optional: Decide whether to block or warn if GPS fails (e.g. permission denied)
                // For strict anti-cheat, we should block.
                const msg = '無法獲取位置，請開啟 GPS 權限後再試';
                setError(msg);
                return { success: false, message: msg, type: 'in' };
            }

            // 2. 判斷最後狀態 (優先使用 LocalStorage 以優化速度)
            // 之前的 api.getRecords() 會導致每次打卡都要下載所有資料，嚴重影響速度
            const localLastCheckIn = localStorage.getItem(`lastCheckIn_${userId}`);

            // Determine next state based on Local Storage presence
            // If we have a local check-in record, we assume we are IN, so next is OUT.
            // If not, we are OUT, so next is IN.
            const isCheckOut = !!localLastCheckIn;

            // Optional: double check time since last action to prevent duplicate clicks handled by UI
            // but api.ts doesn't support fetching Just-One-User record efficiently yet.
            // We rely on the optimistic state for speed.

            const recordPartial: Partial<Attendance> = {
                id: crypto.randomUUID(),
                userId,
                storeId: actualStore.id,
                checkInTime: now.toISOString(),
                type: isCheckOut ? 'check-out' : 'check-in',
                actualStoreId: actualStore.id,
                isOvertime,
                storeName: actualStore.name
            };

            const result = await api.createRecord(recordPartial);

            if (result.success) {
                localStorage.setItem(`lastActionTime_${userId}`, now.toISOString());
                if (isCheckOut) {
                    localStorage.removeItem(`lastCheckIn_${userId}`); // Clear purely for legacy/local tracking
                    return { success: true, message: `下班打卡成功！`, type: 'out' };
                } else {
                    localStorage.setItem(`lastCheckIn_${userId}`, now.toISOString());
                    const locationMsg = actualStore.id !== expectedStoreId ? ` (支援: ${actualStore.name})` : '';
                    const overtimeMsg = isOvertime ? ' [加班]' : '';
                    return { success: true, message: `上班打卡成功！${locationMsg}${overtimeMsg}`, type: 'in' };
                }
            } else {
                throw new Error(result.message || '無法寫入雲端資料庫');
            }
        } catch (err) {
            console.error('Check-in Logic Error:', err);
            const msg = err instanceof Error ? err.message : '網絡或伺服器錯誤';
            setError(`打卡失敗：${msg}`);
            return { success: false, message: msg, type: 'in' };
        } finally {
            setLoading(false);
            processingRef.current = false;
        }
    };

    // Helper: Find closest store within range
    const findClosestStore = async (lat: number, lng: number, maxRangeMeters: number = 30): Promise<string | null> => {
        const { calculateDistance } = await import('../lib/utils');
        // Dynamic import to avoid circular dependency issues if any, though storeManager is safe
        const { getStores } = await import('../utils/storeManager');
        const stores = getStores();

        let closestStoreId: string | null = null;
        let minDist = Infinity;

        for (const store of stores) {
            if (store.lat && store.lng) {
                const dist = calculateDistance(lat, lng, store.lat, store.lng);
                // Priority to stores within range
                if (dist <= (store.radius || maxRangeMeters)) {
                    // If multiple match, pick closest
                    if (dist < minDist) {
                        minDist = dist;
                        closestStoreId = store.id;
                    }
                }
            }
        }
        return closestStoreId;
    }

    return { checkIn, loading, error, findClosestStore };
}

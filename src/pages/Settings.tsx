import { useState, useEffect } from 'react';
import { MOCK_USERS, SHIFTS } from '../data/mock';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { User, Shift, Store, Role, Permission } from '../types';
import { Save, UserCog, Clock, MapPin, Trash2, Shield, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { getStores, saveStores } from '../utils/storeManager';

// Default Default Matrix
const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
    employee: [],
    supervisor: ['view_all_records'],
    attendance_manager: ['view_all_records', 'edit_records', 'manage_shifts', 'export_data'],
    admin: ['view_all_records', 'edit_records', 'manage_users', 'manage_shifts', 'manage_stores', 'manage_permissions', 'export_data']
};

const PERMISSION_LABELS: Record<Permission, string> = {
    view_all_records: '查看所有考勤',
    edit_records: '修改打卡紀錄',
    manage_users: '管理員工資料',
    manage_shifts: '管理班別設定',
    manage_stores: '管理店鋪位置',
    manage_permissions: '管理權限設定',
    export_data: '匯出報表'
};

const ROLE_LABELS: Record<Role, string> = {
    employee: '一般員工',
    supervisor: '部門主管',
    attendance_manager: '考勤管理員',
    admin: '系統管理員'
};

export default function Settings() {
    const { user, hasPermission, refreshPermissions } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'shifts' | 'stores' | 'permissions'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [permissions, setPermissions] = useState<Record<Role, Permission[]>>(DEFAULT_PERMISSIONS);

    useEffect(() => {
        // Enforce tab access
        if (activeTab === 'users' && !hasPermission('manage_users')) setActiveTab('shifts');
        if (activeTab === 'shifts' && !hasPermission('manage_shifts')) setActiveTab('stores');
        if (activeTab === 'stores' && !hasPermission('manage_stores')) setActiveTab('permissions');
        if (activeTab === 'permissions' && !hasPermission('manage_permissions')) setActiveTab('' as any); // Fallback
    }, [activeTab, hasPermission]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Load Stores (Local fallback first)
            const localStores = getStores();
            if (localStores.length > 0) setStores(localStores);

            // Fetch from API (Users, Shifts, Stores, Permissions)
            const [apiUsers, apiShifts, apiStores, apiPermissions] = await Promise.all([
                api.getUsers(),
                api.getShifts(),
                api.getStores(),
                api.getPermissions()
            ]);

            // Handle Stores (Sync API to Local)
            if (apiStores && apiStores.length > 0) {
                setStores(apiStores);
                saveStores(apiStores);
            }

            // Handle Permissions (Cloud > Local > Default)
            if (apiPermissions && Object.keys(apiPermissions).length > 0) {
                setPermissions(apiPermissions as Record<Role, Permission[]>);
                localStorage.setItem('settings_permissions', JSON.stringify(apiPermissions));
            } else {
                // Fallback to local if cloud empty
                const savedPermissions = localStorage.getItem('settings_permissions');
                if (savedPermissions) {
                    setPermissions(JSON.parse(savedPermissions));
                }
            }

            // Handle Users
            if (apiUsers.length > 0) {
                setUsers(apiUsers.map((u: any) => ({
                    ...u,
                    id: String(u.id),
                    storeId: String(u.storeId)
                })));
            } else {
                setUsers(MOCK_USERS);
            }

            // Handle Shifts
            if (apiShifts.length > 0) {
                const normalizeTime = (val: string) => {
                    if (!val) return '';
                    if (/^\d{2}:\d{2}$/.test(val)) return val;
                    try {
                        const date = new Date(val);
                        if (isNaN(date.getTime())) {
                            const match = val.match(/(\d{2}):(\d{2})/);
                            return match ? `${match[1]}:${match[2]}` : '';
                        }
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        return `${hours}:${minutes}`;
                    } catch (e) { return ''; }
                };

                setShifts(apiShifts.map((s: any) => ({
                    ...s,
                    startTime: normalizeTime(s.startTime),
                    endTime: normalizeTime(s.endTime)
                })));
            } else {
                setShifts(SHIFTS);
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
    };

    const handleSaveUsers = async () => {
        const result = await api.updateUsers(users);
        if (result.success) {
            alert('員工設定已更新至 Google Sheets！');
        } else {
            // Could fail if API not set up or CORS. 
            // In demo mode we might fallback to local
            localStorage.setItem('settings_users', JSON.stringify(users));
            const errorMsg = result.message || '未知錯誤';
            alert(`雲端更新失敗：${errorMsg}\n已暫存至本機。`);
        }
    };

    const handleSaveShifts = () => {
        // API for shifts not implemented in this demo script yet, fallback to local
        localStorage.setItem('settings_shifts', JSON.stringify(shifts));
        alert('班別設定已儲存！(目前僅支援本機暫存，需更新 GAS 支援寫入班別)');
    };

    const handleSaveStores = async () => {
        saveStores(stores); // Save local first
        const result = await api.updateStores(stores); // Then sync to cloud

        if (result.success) {
            alert('店鋪位置已更新！(已同步至 Google Sheets)');
        } else {
            alert('已更新本機設定 (測試用)，但雲端同步失敗：\n' + (result.message || 'API 未設定或網路錯誤'));
        }
    };

    const handleSavePermissions = async () => {
        // Save to local first for immediate feedback
        localStorage.setItem('settings_permissions', JSON.stringify(permissions));

        // Sync to Cloud
        const result = await api.updatePermissions(permissions);

        if (result.success) {
            await refreshPermissions(); // 🔹 Update global context
            alert('權限設定已同步至雲端並生效！');
        } else {
            alert('權限已儲存於本機，但雲端同步失敗：\n' + (result.message || '未知錯誤'));
        }
    };

    const handleUserChange = (id: string, field: keyof User, value: string) => {
        setUsers(users.map(u => u.id === id ? { ...u, [field]: value } : u));
    };

    const handleShiftChange = (id: string, field: keyof Shift, value: string) => {
        setShifts(shifts.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleStoreChange = (id: string, field: keyof Store, value: string | number) => {
        setStores(prevStores => prevStores.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const togglePermission = (role: Role, perm: Permission) => {
        setPermissions(prev => {
            const rolePerms = prev[role] || [];
            if (rolePerms.includes(perm)) {
                return { ...prev, [role]: rolePerms.filter(p => p !== perm) };
            } else {
                return { ...prev, [role]: [...rolePerms, perm] };
            }
        });
    };

    return (
        <div className="space-y-6 pb-20">
            {/* DEBUG INFO - REMOVE BEFORE PRODUCTION */}
            <div className="bg-red-100 p-2 text-xs text-red-800 rounded font-mono break-all border border-red-200">
                <strong>DEBUG MODE:</strong><br />
                User: {user?.name} (ID: {user?.id})<br />
                Role Raw: [{user?.role}] <br />
                Has 'manage_users': {String(hasPermission('manage_users'))}<br />
                Loaded Permissions: {JSON.stringify(permissions[user?.role as Role] || 'None')}
            </div>

            {/* Header / Tabs */}
            <div className="bg-white p-1 rounded-xl shadow-sm flex overflow-x-auto">
                {hasPermission('manage_users') && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all min-w-[100px]",
                            activeTab === 'users' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        <UserCog size={16} />
                        <span>員工</span>
                    </button>
                )}

                {hasPermission('manage_shifts') && (
                    <button
                        onClick={() => setActiveTab('shifts')}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all min-w-[100px]",
                            activeTab === 'shifts' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        <Clock size={16} />
                        <span>班別</span>
                    </button>
                )}

                {hasPermission('manage_stores') && (
                    <button
                        onClick={() => setActiveTab('stores')}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all min-w-[100px]",
                            activeTab === 'stores' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        <MapPin size={16} />
                        <span>店鋪</span>
                    </button>
                )}

                {hasPermission('manage_permissions') && (
                    <button
                        onClick={() => setActiveTab('permissions')}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all min-w-[100px]",
                            activeTab === 'permissions' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
                        )}
                    >
                        <Shield size={16} />
                        <span>權限</span>
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-sm p-6 min-h-[400px]">
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">員工名單設定</h3>
                            <button
                                onClick={handleSaveUsers}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <Save size={12} className="mr-1" />
                                儲存設定
                            </button>
                        </div>
                        <div className="space-y-3">
                            {users.map(u => (
                                <div key={u.id} className="p-3 border border-gray-100 rounded-xl space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs">
                                            {u.id}
                                        </div>
                                        <input
                                            type="text"
                                            value={u.name}
                                            onChange={(e) => handleUserChange(u.id, 'name', e.target.value)}
                                            className="flex-1 text-sm font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none px-1 py-0.5"
                                        />
                                    </div>
                                    <div className="flex space-x-2">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleUserChange(u.id, 'role', e.target.value as Role)}
                                            className="text-xs bg-gray-50 border-none rounded px-2 py-1 text-gray-600"
                                        >
                                            <option value="employee">一般員工</option>
                                            <option value="supervisor">主管</option>
                                            <option value="attendance_manager">考勤管理</option>
                                            <option value="admin">系統管理員</option>
                                        </select>
                                        <select
                                            value={u.storeId}
                                            onChange={(e) => handleUserChange(u.id, 'storeId', e.target.value)}
                                            className="text-xs bg-gray-50 border-none rounded px-2 py-1 text-gray-600"
                                        >
                                            {stores.map(store => (
                                                <option key={store.id} value={store.id}>
                                                    {store.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-4 text-center">
                            * ID 目前無法修改，僅能修改姓名與權限
                        </p>

                        {/* Troubleshooting Section */}
                        <div className="mt-8 pt-6 border-t border-dashed border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">疑難排解</h4>
                            <button
                                onClick={() => {
                                    if (confirm('確定要清除所有快取與冷靜期嗎？\n這將會強制登出並重置打卡間隔限制。')) {
                                        localStorage.clear();
                                        window.location.reload();
                                    }
                                }}
                                className="w-full py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center space-x-1"
                            >
                                <Trash2 size={12} />
                                <span>清除快取與重置狀態 (Fix Stuck Issues)</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'shifts' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">班別時間設定</h3>
                            <button
                                onClick={handleSaveShifts}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <Save size={12} className="mr-1" />
                                儲存設定
                            </button>
                        </div>
                        <div className="space-y-3">
                            {shifts.map(s => (
                                <div key={s.id} className="p-3 border border-gray-100 rounded-xl flex flex-col space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-700 text-sm">{s.name}</span>
                                        <span className="text-xs text-gray-400 font-mono">{s.id}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-gray-400 block mb-0.5">開始時間</label>
                                            <input
                                                type="time"
                                                value={s.startTime}
                                                onChange={(e) => handleShiftChange(s.id, 'startTime', e.target.value)}
                                                className="w-full text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1"
                                            />
                                        </div>
                                        <div className="text-gray-300 pt-3">→</div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-gray-400 block mb-0.5">結束時間</label>
                                            <input
                                                type="time"
                                                value={s.endTime}
                                                onChange={(e) => handleShiftChange(s.id, 'endTime', e.target.value)}
                                                className="w-full text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'stores' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">店鋪位置設定 (Address Mode)</h3>
                            <button
                                onClick={handleSaveStores}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <Save size={12} className="mr-1" />
                                儲存與同步
                            </button>
                        </div>
                        <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-4">
                            💡 <b>新功能</b>：輸入地址後，點擊「📍」按鈕即可自動搜尋座標！(也可從 Google Sheets 同步)
                        </div>

                        <div className="space-y-4">
                            {stores.map(store => (
                                <div key={store.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 relative">
                                    <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                value={store.name}
                                                onChange={(e) => handleStoreChange(store.id, 'name', e.target.value)}
                                                className="font-bold text-gray-700 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 outline-none w-32"
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded border">ID: {store.id}</span>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Address Search Section */}
                                        <div className="relative">
                                            <label className="text-[10px] text-gray-500 block mb-1">店鋪地址 (優先使用)</label>
                                            <div className="flex space-x-2">
                                                <input
                                                    type="text"
                                                    value={store.address || ''}
                                                    placeholder="例如：台北市信義區信義路五段7號"
                                                    onChange={(e) => handleStoreChange(store.id, 'address', e.target.value)}
                                                    className="flex-1 text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                                                />
                                                <button
                                                    onClick={async () => {
                                                        if (!store.address) return alert('請先輸入地址');
                                                        const { geocodeAddress } = await import('../utils/storeManager');
                                                        // Show loading state implicitly by logic or UI? Simplified for now.
                                                        const coords = await geocodeAddress(store.address);
                                                        if (coords) {
                                                            handleStoreChange(store.id, 'lat', coords.lat);
                                                            handleStoreChange(store.id, 'lng', coords.lng);
                                                            alert(`✅ 成功定位：${coords.lat}, ${coords.lng}`);
                                                        } else {
                                                            alert('❌ 找不到此地址，請嘗試更詳細的地址或手動輸入座標。');
                                                        }
                                                    }}
                                                    className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                                >
                                                    📍 定位
                                                </button>
                                            </div>
                                        </div>

                                        {/* Lat/Lng Manual Override */}
                                        <div className="bg-white p-3 rounded-lg border border-gray-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[10px] text-gray-400">GPS 座標 (由地址自動產生)</label>
                                                <button
                                                    onClick={() => {
                                                        if (navigator.geolocation) {
                                                            navigator.geolocation.getCurrentPosition(pos => {
                                                                const { latitude, longitude, accuracy } = pos.coords;

                                                                // Single atomic update
                                                                setStores(prevStores => prevStores.map(s =>
                                                                    s.id === store.id ? { ...s, lat: latitude, lng: longitude } : s
                                                                ));

                                                                let msg = `已擷取座標！\n緯度: ${latitude.toFixed(5)}\n經度: ${longitude.toFixed(5)}\n精確度: ±${Math.round(accuracy)}公尺`;
                                                                if (accuracy > 50) {
                                                                    msg += `\n\n⚠️ 注意：GPS 訊號微弱 (誤差 > 50m)，建議移動到戶外或窗邊再試。`;
                                                                }
                                                                msg += `\n\n確認無誤後，請務必點擊右上角「儲存與同步」！`;

                                                                alert(msg);
                                                            }, (err) => {
                                                                alert(`無法獲取位置：${err.message}`);
                                                            }, {
                                                                enableHighAccuracy: true,
                                                                timeout: 10000,
                                                                maximumAge: 0
                                                            });
                                                        } else {
                                                            alert('您的瀏覽器不支援地理位置功能');
                                                        }
                                                    }}
                                                    className="text-[10px] text-blue-600 underline"
                                                >
                                                    使用目前位置
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-2">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-gray-400 text-xs">Lat</span>
                                                    <input
                                                        type="number"
                                                        step="0.000001"
                                                        value={store.lat || 0}
                                                        onChange={(e) => handleStoreChange(store.id, 'lat', parseFloat(e.target.value))}
                                                        className="w-full text-xs pl-8 p-1.5 border rounded bg-gray-50"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-gray-400 text-xs">Lng</span>
                                                    <input
                                                        type="number"
                                                        step="0.000001"
                                                        value={store.lng || 0}
                                                        onChange={(e) => handleStoreChange(store.id, 'lng', parseFloat(e.target.value))}
                                                        className="w-full text-xs pl-8 p-1.5 border rounded bg-gray-50"
                                                    />
                                                </div>
                                            </div>

                                            {/* Google Maps Verification Link */}
                                            {(store.lat && store.lng) && (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <MapPin size={10} />
                                                    在 Google 地圖上檢查位置
                                                </a>
                                            )}
                                        </div>

                                        {/* Settings Grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-100 p-2 rounded-lg">
                                                <label className="text-xs text-gray-600 block mb-1">有效半徑 (公尺)</label>
                                                <input
                                                    type="number"
                                                    value={store.radius || 30}
                                                    onChange={(e) => handleStoreChange(store.id, 'radius', parseInt(e.target.value))}
                                                    className="w-full text-center text-sm p-1 border rounded"
                                                />
                                            </div>
                                            <div className="bg-gray-100 p-2 rounded-lg">
                                                <label className="text-xs text-gray-600 block mb-1">QR Code 內容</label>
                                                <input
                                                    type="text"
                                                    value={store.qrContent || store.id}
                                                    onChange={(e) => handleStoreChange(store.id, 'qrContent', e.target.value)}
                                                    className="w-full text-center text-sm p-1 border rounded"
                                                    placeholder={store.id}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'permissions' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">權限管理矩陣</h3>
                            <button
                                onClick={handleSavePermissions}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <Save size={12} className="mr-1" />
                                儲存設定
                            </button>
                        </div>

                        <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-4">
                            💡 設定不同角色可存取的雲端後台與 APP 功能。
                        </div>

                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 border-b">角色 \ 功能</th>
                                        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                                            <th key={key} className="px-4 py-3 border-b text-center min-w-[80px]">
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                                        <tr key={role} className="bg-white border-b hover:bg-gray-50">
                                            <th className="px-4 py-3 font-medium text-gray-900 border-r bg-gray-50">
                                                {ROLE_LABELS[role]}
                                            </th>
                                            {(Object.keys(PERMISSION_LABELS) as Permission[]).map((perm) => (
                                                <td key={perm} className="px-4 py-3 text-center border-l border-gray-100">
                                                    <button
                                                        onClick={() => togglePermission(role, perm)}
                                                        className={cn(
                                                            "w-6 h-6 rounded flex items-center justify-center transition-colors mx-auto",
                                                            permissions[role]?.includes(perm) ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                                                        )}
                                                    >
                                                        {permissions[role]?.includes(perm) ? <Check size={14} strokeWidth={3} /> : <X size={14} />}
                                                    </button>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

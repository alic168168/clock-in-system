export type Role = 'employee' | 'supervisor' | 'attendance_manager' | 'admin';

export type Permission =
    | 'view_all_records'
    | 'edit_records'
    | 'manage_users'
    | 'manage_shifts'
    | 'manage_stores'
    | 'manage_permissions'
    | 'export_data';


export type ShiftType = 'morning' | 'middle' | 'night';

export interface Store {
    id: string;
    name: string;
    address?: string; // New: Store address
    qrContent?: string; // New: Custom QR code content (defaults to ID if empty)
    lat?: number;
    lng?: number;
    radius?: number; // meters
}

export interface User {
    id: string;
    name: string;
    role: Role;
    storeId: string;
    avatar?: string;
}

export interface Shift {
    id: string;
    name: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    type: ShiftType;
}

export interface Schedule {
    id: string;
    date: string; // YYYY-MM-DD
    userId: string;
    shiftId: string;
    storeId: string;
    isOpenForSub: boolean; // 是否開放代班
    subRequesterId?: string; // 請求代班的人
    subUserId?: string; // 實際代班的人
}

export interface Attendance {
    id: string;
    userId: string;
    storeId: string;
    checkInTime: string; // ISO String
    checkOutTime?: string; // ISO String
    date: string; // 歸屬日期 (用於跨日班別判定)
    shiftId: string;
    actualStoreId?: string; // 實際掃描到的店鋪 ID
    isOvertime?: boolean;   // 是否為加班
    note?: string;          // 備註 (例如加班原因)
    type?: 'check-in' | 'check-out';
    storeName?: string;
    userName?: string;
}

export interface LeaveRequest {
    id: string;
    userId: string;
    type: string; // 事假, 病假...
    startDate: string;
    endDate: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
}

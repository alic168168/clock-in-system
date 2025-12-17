import type { Attendance, User, Shift, Store } from '../types';

const API_URL = 'https://script.google.com/macros/s/AKfycbxXTboogy1W6uvLZGHpdCMEgp5xXqJmfG9NA_MyUYZ1F8w7q_kcY7uqmP8RbPSAqrasog/exec';

const fetchAPI = async (action: string, data: any) => {
    try {
        const res = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            body: JSON.stringify(action === 'updateStores' || action === 'updateUsers' ? { data } : data)
        });
        const result = await res.json();
        if (result.error) {
            console.error('API Error:', result.error);
            return { success: false, message: result.error };
        }
        return result;
    } catch (error) {
        console.error(`Failed to ${action}:`, error);
        return { success: false, message: String(error) };
    }
};

export const api = {
    // Users
    getUsers: async (): Promise<User[]> => {
        try {
            const res = await fetch(`${API_URL}?action=getUsers&_t=${new Date().getTime()}`);
            const data = await res.json();

            // Normalize Roles (Chinese -> English) to ensure RBAC works
            return Array.isArray(data) ? data.map((u: any) => {
                let role = u.role;
                if (role === '員工' || role === '一般員工') role = 'employee';
                else if (role === '店長' || role === '系統管理員') role = 'admin';
                else if (role === '部門主管' || role === '主管') role = 'supervisor';
                else if (role === '考勤管理員' || role === '考勤管理') role = 'attendance_manager';

                return { ...u, role };
            }) : [];
        } catch (error) {
            console.error('Failed to fetch users:', error);
            return [];
        }
    },

    updateUsers: async (users: User[]): Promise<{ success: boolean; message?: string }> => {
        return fetchAPI('updateUsers', users);
    },

    // Shifts
    getShifts: async (): Promise<Shift[]> => {
        try {
            const response = await fetch(`${API_URL}?action=getShifts&_t=${new Date().getTime()}`);
            const data = await response.json();
            // Check if data is array directly or inside data property (consistency check)
            // Existing code assumed array, but new GAS might wrap it. 
            // My GAS update used jsonResponse({success:true, data}) for stores, but maybe existing shifts returns raw array?
            // The existing code for getUsers returns data directly. 
            // Let's assume existing endpoints return raw array, new ones return wrapped.
            // Actually, let's play safe.
            return Array.isArray(data) ? data : (data.success && Array.isArray(data.data) ? data.data : []);
        } catch (error) {
            console.error('API Error:', error);
            return [];
        }
    },

    // Stores (New)
    getStores: async (): Promise<Store[]> => {
        try {
            const response = await fetch(`${API_URL}?action=getStores&_t=${new Date().getTime()}`);
            const data = await response.json();
            // New GAS I wrote returns { success: true, data: [...] }
            return data.success ? data.data : (Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('API Error:', error);
            return [];
        }
    },

    updateStores: async (stores: Store[]) => {
        return fetchAPI('updateStores', stores);
    },

    // Records
    getRecords: async (): Promise<Attendance[]> => {
        try {
            const res = await fetch(`${API_URL}?action=getRecords&_t=${new Date().getTime()}`);
            const data = await res.json();
            return Array.isArray(data) ? data : (data.data || []);
        } catch (error) {
            console.error('Failed to fetch records:', error);
            return [];
        }
    },

    createRecord: async (record: Partial<Attendance>): Promise<{ success: boolean; message?: string }> => {
        return fetchAPI('createRecord', record);
    },

    deleteRecord: async (id: string): Promise<{ success: boolean; message?: string }> => {
        return fetchAPI('deleteRecord', { id });
    },

    // Permissions (New)
    getPermissions: async (): Promise<Record<string, any>> => {
        try {
            const res = await fetch(`${API_URL}?action=getPermissions&_t=${new Date().getTime()}`);
            const data = await res.json();
            // Expecting { success: true, data: { employee: [...], ... } }
            return data.success ? data.data : {};
        } catch (error) {
            console.error('Failed to fetch permissions:', error);
            // Return empty object implies falling back to default/local in consumer
            return {};
        }
    },

    updatePermissions: async (permissions: Record<string, any>): Promise<{ success: boolean; message?: string }> => {
        return fetchAPI('updatePermissions', permissions);
    }
};

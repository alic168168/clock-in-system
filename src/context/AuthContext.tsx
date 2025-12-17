import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Role, Permission } from '../types';
import { MOCK_USERS } from '../data/mock';
import { liffService } from '../utils/liff';
import { api } from '../services/api';

interface AuthContextType {
    user: User | null;
    login: (userInfo: User | string) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isLiffInitialized: boolean;
    hasPermission: (permission: Permission) => boolean;
    refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default permissions fallback
const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
    employee: [],
    supervisor: ['view_all_records'],
    attendance_manager: ['view_all_records', 'edit_records', 'manage_shifts', 'export_data'],
    admin: ['view_all_records', 'edit_records', 'manage_users', 'manage_shifts', 'manage_stores', 'manage_permissions', 'export_data']
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLiffInitialized, setIsLiffInitialized] = useState(false);
    const [permissionsMap, setPermissionsMap] = useState<Record<string, Permission[]>>(DEFAULT_PERMISSIONS);

    // Initial load of permissions
    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        // 1. Try Local Storage
        const saved = localStorage.getItem('settings_permissions');
        if (saved) {
            try {
                setPermissionsMap(JSON.parse(saved));
            } catch (e) { console.error("Parse perm error", e); }
        }

        // 2. Try Cloud (Background update)
        try {
            const cloudPerms = await api.getPermissions();
            if (cloudPerms && Object.keys(cloudPerms).length > 0) {
                setPermissionsMap(cloudPerms);
                localStorage.setItem('settings_permissions', JSON.stringify(cloudPerms));
            }
        } catch (e) {
            console.error("Failed to sync permissions", e);
        }
    };

    useEffect(() => {
        const initLiff = async () => {
            await liffService.init();
            setIsLiffInitialized(true);

            // Try Auto Login
            if (liffService.isLoggedIn()) {
                console.log('LIFF Auto Login');
                // In a real app, verify token with backend. Here we mock user 1.
                setUser(MOCK_USERS[1]);
            } else if (liffService.shouldAutoLogin()) {
                liffService.login();
            }
        };

        initLiff();
    }, []);

    const login = async (userData: User | string) => {
        // Refresh permissions from cloud when logging in to ensure latest access rights
        loadPermissions();

        if (typeof userData === 'string') {
            const foundUser = MOCK_USERS.find(u => u.id === userData);
            if (foundUser) {
                setUser(foundUser);
            } else {
                console.warn("Login by ID failed. User not in Mock.");
            }
        } else {
            setUser(userData);
        }
    };

    const logout = () => {
        setUser(null);
        if (liffService.isLoggedIn()) {
            liffService.logout();
        }
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;
        const role = user.role as Role;
        const userPerms = permissionsMap[role] || [];
        return userPerms.includes(permission);
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            isAuthenticated: !!user,
            isLiffInitialized,
            hasPermission,
            refreshPermissions: loadPermissions
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

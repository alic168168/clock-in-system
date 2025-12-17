
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ClipboardList, LogOut, FileDown, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function Layout() {
    const { logout, user, hasPermission } = useAuth();
    // const location = useLocation();

    const canAccessSettings =
        hasPermission('manage_users') ||
        hasPermission('manage_shifts') ||
        hasPermission('manage_stores') ||
        hasPermission('manage_permissions');

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: '打卡' },
        { to: '/schedule', icon: CalendarDays, label: '班表' },
        { to: '/leave', icon: ClipboardList, label: '請假' },
        { to: '/records', icon: FileDown, label: '紀錄' },
        ...(canAccessSettings ? [{ to: '/settings', icon: UserCog, label: '設定' }] : []),
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-gray-200">
            {/* Header */}
            <header className="bg-white px-4 py-3 shadow-sm flex items-center justify-between z-10 sticky top-0">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        {user?.name?.[0]}
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-800">{user?.name}</h2>
                        <p className="text-xs text-gray-500">
                            {user?.role === 'admin' ? '店長' : '員工'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <LogOut size={20} />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-20 p-4 scrollbar-hide">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="bg-white border-t px-6 py-2 pb-safe fixed bottom-0 w-full max-w-md mx-auto z-10 flex justify-between items-center text-xs font-medium text-gray-500">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            cn(
                                "flex flex-col items-center justify-center space-y-1 min-w-[3.5rem] h-14 rounded-xl transition-all duration-200", // min-w added for stability
                                isActive
                                    ? "text-blue-600 bg-blue-50"
                                    : "hover:text-gray-900 hover:bg-gray-50"
                            )
                        }
                    >
                        <Icon size={24} strokeWidth={2} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}

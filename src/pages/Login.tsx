
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MOCK_USERS } from '../data/mock';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUsers = async () => {
            const cached = localStorage.getItem('cachedUsers');
            if (cached) {
                setUsers(JSON.parse(cached));
                setLoading(false);
            }

            // FORCE CLEAR CACHE for debugging/fixing role issues
            // localStorage.removeItem('cachedUsers'); // Commented out to use cache if available first, then update

            try {
                // 2. Fetch fresh data
                const apiUsers = await api.getUsers();
                if (apiUsers && apiUsers.length > 0) {
                    setUsers(apiUsers);
                    // 3. Update Cache
                    localStorage.setItem('cachedUsers', JSON.stringify(apiUsers));
                } else if (!cached) {
                    // Only fallback to mock if no cache and api failed/empty
                    setUsers(MOCK_USERS);
                }
            } catch (err) {
                console.error("Failed to fetch users", err);
                if (!cached) setUsers(MOCK_USERS);
            } finally {
                setLoading(false);
            }
        };
        loadUsers();
    }, []);

    const handleLogin = (user: any) => {
        login(user);
        navigate('/');
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
                    打卡系統登入
                </h1>
                <p className="text-center text-gray-500 mb-8">
                    請選擇您的身分進行登入
                </p>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {users.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => handleLogin(user)}
                                className="w-full flex items-center p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-4 group-hover:bg-blue-100">
                                    {user.role === 'admin' ? '👑' : '👤'}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-medium text-gray-900">{user.name}</div>
                                    <div className="text-sm text-gray-500">
                                        {user.role === 'admin' ? '店長' : '員工'} - {user.id}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

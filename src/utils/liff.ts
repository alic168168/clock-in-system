import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID || '2008691308-U5WoxGBB';

export interface LiffProfile {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
}

class LiffService {
    private isInitialized = false;
    private mockMode = false;

    async init() {
        if (this.isInitialized) return;

        try {
            if (!LIFF_ID) {
                console.warn('LIFF_ID not found in .env, falling back to mock mode.');
                this.mockMode = true;
                this.isInitialized = true;
                return;
            }

            await liff.init({ liffId: LIFF_ID });
            this.isInitialized = true;
            console.log('LIFF initialized');
        } catch (error) {
            console.error('LIFF initialization failed:', error);
            // Fallback to mock if init fails (e.g. invalid ID or running locally without valid setup)
            this.mockMode = true;
            this.isInitialized = true;
        }
    }

    isLoggedIn(): boolean {
        if (!this.isInitialized) return false;
        if (this.mockMode) {
            return !!localStorage.getItem('mock_liff_login');
        }
        return liff.isLoggedIn();
    }

    async getProfile(): Promise<LiffProfile | null> {
        if (!this.isLoggedIn()) return null;

        if (this.mockMode) {
            // Return a mock profile that maps to 'emp1' (王小明) for demo purposes
            return {
                userId: 'mock_line_user_001',
                displayName: '王小明 (LINE)',
                pictureUrl: 'https://ui-avatars.com/api/?name=王小明&background=0D8ABC&color=fff',
            };
        }

        try {
            const profile = await liff.getProfile();
            return profile;
        } catch (error) {
            console.error('Failed to get profile:', error);
            return null;
        }
    }

    login() {
        if (this.mockMode) {
            localStorage.setItem('mock_liff_login', 'true');
            window.location.reload(); // Simulate redirect back
            return;
        }
        if (!this.isLoggedIn()) {
            liff.login();
        }
    }

    logout() {
        if (this.mockMode) {
            localStorage.removeItem('mock_liff_login');
            window.location.reload();
            return;
        }
        if (this.isLoggedIn()) {
            liff.logout();
            window.location.reload();
        }
    }

    isInClient(): boolean {
        if (this.mockMode) return false; // Mock mode assumes web browser
        return liff.isInClient();
    }

    // Helper to check if we should try auto-login (e.g. if opened in LINE)
    shouldAutoLogin(): boolean {
        // In real scenario: return this.isInClient() && !this.isLoggedIn();
        // For demo with mock: return true if configured
        return false;
    }
}

export const liffService = new LiffService();

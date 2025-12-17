import { STORES as MOCK_STORES } from '../data/mock';
import type { Store } from '../types';

const STORAGE_KEY = 'attendance_system_stores';

export const getStores = (): Store[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse stored stores', e);
        }
    }
    return MOCK_STORES;
};

export const saveStores = (stores: Store[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
};

export const resetStores = () => {
    localStorage.removeItem(STORAGE_KEY);
};

export const getStoreById = (id: string): Store | undefined => {
    return getStores().find(s => s.id === id);
};

// Client-side simple geocoding for testing (OpenStreetMap)
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    const search = async (query: string) => {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }
        } catch (e) {
            console.error("Geocoding failed", e);
        }
        return null;
    };

    // 1. Try Exact Match
    let result = await search(address);
    if (result) return result;

    // 2. Fallback: Try removing specific house number (X號) for fuzzy road match
    // Usage: "桃園市中壢區新中北路204號" -> "桃園市中壢區新中北路"
    const fuzzyAddress = address.replace(/\d+號.*/, '');
    if (fuzzyAddress !== address) {
        console.log(`Retrying with fuzzy address: ${fuzzyAddress}`);
        result = await search(fuzzyAddress);
        if (result) return result;
    }

    return null;
};

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const AUTH_CHANGE_EVENT = "truekicks:auth-change";

// Create axios instance with default config
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // IMPORTANT: Allows sending and receiving HttpOnly cookies
    headers: {
        'Content-Type': 'application/json',
    },
});

const notifyAuthChange = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    window.dispatchEvent(new Event("storage"));
};

export const purgeLegacyApiCache = () => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    window.caches.delete("api-cache").catch(() => {});
};

// User-scoped profile image helpers (prevents avatar bleed between accounts)
export const getProfileImageKey = (user) =>
    user?.id ? `profileImage_${user.id}` : null;

export const readProfileImage = (user) => {
    if (typeof window === "undefined" || !user?.id) return null;
    try {
        return localStorage.getItem(`profileImage_${user.id}`) || null;
    } catch {
        return null;
    }
};

export const saveProfileImage = (user, dataUrl) => {
    if (typeof window === "undefined" || !user?.id) return;
    try {
        localStorage.setItem(`profileImage_${user.id}`, dataUrl);
        localStorage.removeItem("profileImage");
        notifyAuthChange();
    } catch {
        // Ignore storage quota errors
    }
};

export const clearProfileImage = (user) => {
    if (typeof window === "undefined") return;
    try {
        if (user?.id) {
            localStorage.removeItem(`profileImage_${user.id}`);
        }
        localStorage.removeItem("profileImage");
        notifyAuthChange();
    } catch {
        // Ignore storage errors
    }
};

export const clearSessionClientState = () => {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("profileImage");
        sessionStorage.removeItem("backup_user");
    } catch {
        // Ignore storage errors
    }
    purgeLegacyApiCache();
    notifyAuthChange();
};

export const setSessionUser = (userData) => {
    if (typeof window === "undefined") return null;
    if (!userData || !userData.id) {
        clearSessionClientState();
        return null;
    }

    const sanitized = {
        id: userData.id,
        full_name: userData.full_name || "",
        email: userData.email || "",
        role: userData.role || "customer",
        ...(userData.created_at ? { created_at: userData.created_at } : {}),
    };

    try {
        localStorage.removeItem("token");
        localStorage.removeItem("profileImage");
        sessionStorage.removeItem("backup_user");
        localStorage.setItem("user", JSON.stringify(sanitized));
    } catch {
        // Ignore storage errors
    }
    purgeLegacyApiCache();
    notifyAuthChange();
    return sanitized;
};

// Response interceptor - Handle token expiry
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
            clearSessionClientState();

            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Auth helpers
export const getToken = () => null; // Tokens are now inaccessible to JS (HttpOnly)
export const getUser = () => {
    try {
        const user = localStorage.getItem('user');
        if (!user) return null;
        const parsed = JSON.parse(user);
        if (!parsed?.id || parsed?.email?.includes('guest')) return null;
        return parsed;
    } catch {
        return null;
    }
};
export const isAuthenticated = () => !!getUser();
export const logout = async () => {
    try {
        await api.post("/api/logout", {}, { skipAuthRedirect: true });
    } catch (e) {
        console.error("Logout error", e);
    }
    clearSessionClientState();
};

export default api;

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Create axios instance with default config
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // IMPORTANT: Allows sending and receiving HttpOnly cookies
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor disabled since we use HttpOnly cookies mapping automatically

// Response interceptor - Handle token expiry
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Only redirect if not already on login page
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
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};
export const isAuthenticated = () => !!getUser();
export const logout = async () => {
    try {
        await api.post("/api/logout");
    } catch (e) {
        console.error("Logout error", e);
    }
    localStorage.removeItem('token'); // Just in case legacy artifact exists
    localStorage.removeItem('user');
};

export default api;

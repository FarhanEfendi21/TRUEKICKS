import 'dotenv/config';
import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

const INSECURE_PLACEHOLDER_SECRET = 'truekicks-secret-key-change-in-production';

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret || secret === INSECURE_PLACEHOLDER_SECRET) {
        throw new Error(
            'FATAL: JWT_SECRET environment variable must be set to a strong, non-default value.'
        );
    }
    if (secret.length < 32) {
        console.warn(
            'WARNING: JWT_SECRET is shorter than 32 characters. Rotate to a stronger secret (>= 32 chars).'
        );
    }
    return secret;
};

// Fail fast on startup if JWT_SECRET is missing or insecure
const JWT_SECRET = getJwtSecret();

const getBootstrapAdminEmails = () =>
    (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

const isMissingRoleColumnError = (error) => {
    if (!error) return false;
    const code = String(error.code || '');
    const msg = String(error.message || '').toLowerCase();
    return code === '42703' || code === 'PGRST204' || msg.includes('role');
};

/**
 * Resolves effective RBAC role ('admin' | 'customer') from DB column or ADMIN_EMAILS env list.
 */
export const resolveUserRole = (user) => {
    if (!user) return 'customer';
    if (String(user.role || '').trim().toLowerCase() === 'admin') {
        return 'admin';
    }
    const email = String(user.email || '').trim().toLowerCase();
    if (email && getBootstrapAdminEmails().includes(email)) {
        return 'admin';
    }
    return 'customer';
};

// Generate JWT Token
export const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: resolveUserRole(user),
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Verify JWT Token
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
};

export const setNoStoreAuthHeaders = (res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
        Expires: '0',
        Vary: 'Cookie, Authorization, Origin',
    });
};

// Auth Middleware - Protects routes that require login
export const authMiddleware = (req, res, next) => {
    setNoStoreAuthHeaders(res);
    try {
        let token = req.cookies?.token;

        // Fallback ke header konvensional Bearer token
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }

        // Attach user info to request
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userRole = decoded.role || 'customer';
        next();
    } catch {
        res.status(401).json({ message: 'Authentication failed.' });
    }
};

/**
 * Admin RBAC Middleware - Always verifies live user role against DB (plus ADMIN_EMAILS fallback)
 * so role revocations take effect immediately without waiting for JWT expiry.
 */
export const adminMiddleware = async (req, res, next) => {
    try {
        const userId = Number(req.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({ message: 'Access denied. Authentication required.' });
        }

        let userRecord = null;
        const primaryRes = await supabase
            .from('users')
            .select('id, email, full_name, role')
            .eq('id', userId)
            .maybeSingle();

        if (primaryRes.error) {
            if (isMissingRoleColumnError(primaryRes.error)) {
                const fallbackRes = await supabase
                    .from('users')
                    .select('id, email, full_name')
                    .eq('id', userId)
                    .maybeSingle();
                if (fallbackRes.error) throw fallbackRes.error;
                userRecord = fallbackRes.data;
            } else {
                throw primaryRes.error;
            }
        } else {
            userRecord = primaryRes.data;
        }

        if (!userRecord) {
            return res.status(401).json({ message: 'Authenticated user no longer exists.' });
        }

        const effectiveRole = resolveUserRole(userRecord);
        req.userRole = effectiveRole;
        req.userEmail = userRecord.email;

        if (effectiveRole !== 'admin') {
            return res.status(403).json({
                message: 'Forbidden. Admin privileges are required to access this resource.',
                code: 'ADMIN_REQUIRED',
            });
        }

        return next();
    } catch (error) {
        console.error('Admin RBAC verification error:', error.message);
        return res.status(500).json({ message: 'Failed to verify admin permissions.' });
    }
};

// Optional Auth Middleware - Doesn't block if no token
export const optionalAuth = (req, res, next) => {
    try {
        let token = req.cookies?.token;

        // Fallback untuk antisipasi request tanpa credentials
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            const decoded = verifyToken(token);

            if (decoded) {
                req.userId = decoded.userId;
                req.userEmail = decoded.email;
                req.userRole = decoded.role || 'customer';
            }
        }
        next();
    } catch {
        next();
    }
};

export default {
    generateToken,
    verifyToken,
    resolveUserRole,
    setNoStoreAuthHeaders,
    authMiddleware,
    adminMiddleware,
    optionalAuth,
};

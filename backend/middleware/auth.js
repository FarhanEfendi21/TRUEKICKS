import 'dotenv/config';
import jwt from 'jsonwebtoken';

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

// Generate JWT Token
export const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Verify JWT Token
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Auth Middleware - Protects routes that require login
export const authMiddleware = (req, res, next) => {
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
        next();
    } catch (error) {
        res.status(401).json({ message: 'Authentication failed.' });
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
            }
        }
        next();
    } catch (error) {
        next();
    }
};

export default { generateToken, verifyToken, authMiddleware, optionalAuth };

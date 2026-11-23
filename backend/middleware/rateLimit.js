import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per windowMs
    message: {
        message: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter limiter for auth routes (login/register)
export const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute (shorter for better UX)
    max: 10, // Max 10 attempts per minute
    message: {
        message: 'Too many attempts. Please try again in 1 minute.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful logins
});

// Password reset limiter
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Max 3 password reset requests per hour
    message: {
        message: 'Too many password reset requests. Please try again in an hour.'
    }
});

// AI Sneaker Concierge limiter (protects LLM quota & prevents abuse)
export const conciergeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15, // Max 15 chat turns per minute per IP
    message: {
        message: 'Terlalu banyak permintaan ke Kixo. Tunggu sebentar lalu coba lagi.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export default { apiLimiter, authLimiter, passwordResetLimiter, conciergeLimiter };

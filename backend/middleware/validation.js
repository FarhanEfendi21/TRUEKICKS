import { body, validationResult } from 'express-validator';

// Validation rules for registration
export const registerValidation = [
    body('full_name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please enter a valid email')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/\d/).withMessage('Password must contain at least one number')
];

// Validation rules for login
export const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please enter a valid email')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
];

// Validation rules for orders
export const orderValidation = [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('postal_code').trim().notEmpty().withMessage('Postal code is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('total_price').isNumeric().withMessage('Total price must be a number'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required')
];

// Middleware to check validation results
export const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return res.status(400).json({
            message: 'Validation failed',
            errors: errorMessages
        });
    }

    next();
};

export default { registerValidation, loginValidation, orderValidation, validate };

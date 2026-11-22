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

const ALLOWED_PRODUCT_TYPES = ['products', 'sneakers', 'apparel', 'sale_products'];

// Validation rules for orders (user_id derived from JWT, total_price calculated server-side)
export const orderValidation = [
    body('full_name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 120 }).withMessage('Full name must be between 2-120 characters'),
    body('address')
        .trim()
        .notEmpty().withMessage('Address is required')
        .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5-500 characters'),
    body('city')
        .trim()
        .notEmpty().withMessage('City is required')
        .isLength({ max: 100 }).withMessage('City is too long'),
    body('postal_code')
        .trim()
        .notEmpty().withMessage('Postal code is required')
        .isLength({ max: 20 }).withMessage('Postal code is too long'),
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .isLength({ min: 6, max: 25 }).withMessage('Phone number must be between 6-25 characters'),
    body('items')
        .isArray({ min: 1, max: 50 }).withMessage('At least one item is required'),
    body('items.*.id')
        .notEmpty().withMessage('Each item must have a valid product ID'),
    body('items.*.quantity')
        .isInt({ min: 1, max: 100 }).withMessage('Each item quantity must be an integer between 1 and 100'),
    body('items.*.size')
        .notEmpty().withMessage('Each item must include a size'),
    body('items.*.productType')
        .optional()
        .isIn(ALLOWED_PRODUCT_TYPES).withMessage('Invalid product type'),
    body('coupon_code')
        .optional({ values: 'falsy' })
        .isString().withMessage('Coupon code must be a string')
        .trim()
        .isLength({ max: 50 }).withMessage('Coupon code is too long')
];

// Validation rules for profile update
export const updateProfileValidation = [
    body('full_name')
        .trim()
        .notEmpty().withMessage('Name is required.')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters')
];

// Validation rules for product reviews
export const reviewValidation = [
    body('product_id')
        .notEmpty().withMessage('Product ID is required')
        .isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
    body('product_type')
        .trim()
        .notEmpty().withMessage('Product type is required')
        .isIn(ALLOWED_PRODUCT_TYPES).withMessage('Invalid product type'),
    body('rating')
        .isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
    body('comment')
        .trim()
        .notEmpty().withMessage('Comment is required')
        .isLength({ min: 1, max: 1000 }).withMessage('Comment must be between 1-1000 characters')
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

export default {
    registerValidation,
    loginValidation,
    orderValidation,
    updateProfileValidation,
    reviewValidation,
    validate
};

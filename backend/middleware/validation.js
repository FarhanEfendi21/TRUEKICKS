import { body, validationResult } from 'express-validator';

const EMAIL_NORMALIZE_OPTS = {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false,
};

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
        .normalizeEmail(EMAIL_NORMALIZE_OPTS),

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
        .normalizeEmail(EMAIL_NORMALIZE_OPTS),

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

// Validation rules for cloud cart sync
export const cartSyncValidation = [
    body('items')
        .isArray({ max: 100 }).withMessage('Cart items must be an array (max 100 items)'),
    body('items.*.id')
        .notEmpty().withMessage('Each cart item must have a product ID'),
    body('items.*.name')
        .trim()
        .notEmpty().withMessage('Each cart item must have a name')
        .isLength({ max: 250 }).withMessage('Product name is too long'),
    body('items.*.size')
        .trim()
        .notEmpty().withMessage('Each cart item must have a size')
        .isLength({ max: 30 }).withMessage('Size value is too long'),
    body('items.*.quantity')
        .isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100'),
    body('items.*.productType')
        .optional()
        .isIn(ALLOWED_PRODUCT_TYPES).withMessage('Invalid product type')
];

// Validation rules for cloud wishlist sync
export const wishlistSyncValidation = [
    body('items')
        .isArray({ max: 200 }).withMessage('Wishlist items must be an array (max 200 items)'),
    body('items.*.id')
        .notEmpty().withMessage('Each wishlist item must have a product ID'),
    body('items.*.name')
        .trim()
        .notEmpty().withMessage('Each wishlist item must have a name')
        .isLength({ max: 250 }).withMessage('Product name is too long'),
    body('items.*.productType')
        .optional()
        .isIn(ALLOWED_PRODUCT_TYPES).withMessage('Invalid product type')
];

// Validation rules for saved shipping addresses
export const addressValidation = [
    body('label')
        .optional()
        .trim()
        .isLength({ min: 1, max: 40 }).withMessage('Label must be 1-40 characters'),
    body('full_name')
        .trim()
        .notEmpty().withMessage('Recipient name is required')
        .isLength({ min: 2, max: 120 }).withMessage('Recipient name must be 2-120 characters'),
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .isLength({ min: 6, max: 25 }).withMessage('Phone number must be 6-25 characters'),
    body('address')
        .trim()
        .notEmpty().withMessage('Address is required')
        .isLength({ min: 5, max: 500 }).withMessage('Address must be 5-500 characters'),
    body('city')
        .trim()
        .notEmpty().withMessage('City is required')
        .isLength({ min: 2, max: 100 }).withMessage('City must be 2-100 characters'),
    body('postal_code')
        .trim()
        .notEmpty().withMessage('Postal code is required')
        .isLength({ min: 3, max: 20 }).withMessage('Postal code must be 3-20 characters'),
    body('is_default')
        .optional()
        .isBoolean().withMessage('is_default must be a boolean')
];

// Validation rules for AI Sneaker Concierge chat
export const conciergeValidation = [
    body('message')
        .trim()
        .notEmpty().withMessage('Message is required')
        .isLength({ min: 1, max: 500 }).withMessage('Message must be between 1-500 characters'),
    body('history')
        .optional()
        .isArray({ max: 8 }).withMessage('History must be an array with at most 8 messages'),
    body('history.*.role')
        .optional()
        .isIn(['user', 'assistant']).withMessage('History role must be user or assistant'),
    body('history.*.content')
        .optional()
        .isString().withMessage('History content must be a string')
        .isLength({ max: 600 }).withMessage('History content is too long'),
    body('context.currentPath')
        .optional()
        .isString().withMessage('currentPath must be a string')
        .isLength({ max: 120 }).withMessage('currentPath is too long'),
    body('context.language')
        .optional()
        .isIn(['id', 'en']).withMessage('language must be id or en')
];

// Validation rules for Drop Calendar Notify Me reminder
export const dropNotifyValidation = [
    body('email')
        .optional({ values: 'falsy' })
        .trim()
        .isEmail().withMessage('Please enter a valid email address')
        .normalizeEmail()
];

const isValidDetailImageUrl = (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 1200) return false;
    // Allow legacy local static asset paths (e.g. /images/530/...) with optional framing hash
    if (/^\/images\/(?!.*\.\.)[A-Za-z0-9/_.%-]+(?:#[A-Za-z0-9=&._%-]+)?$/.test(trimmed)) {
        return true;
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

// Validation rules for Admin Product Create
export const adminProductCreateValidation = [
    body('product_type')
        .trim()
        .isIn(['sneakers', 'apparel']).withMessage('product_type must be sneakers or apparel'),
    body('name')
        .trim()
        .notEmpty().withMessage('Product name is required')
        .isLength({ min: 2, max: 180 }).withMessage('Product name must be 2-180 characters'),
    body('category')
        .trim()
        .notEmpty().withMessage('Category / brand is required')
        .isLength({ min: 1, max: 80 }).withMessage('Category must be 1-80 characters'),
    body('price')
        .isFloat({ min: 1000, max: 500000000 }).withMessage('Price must be a valid amount >= Rp 1.000'),
    body('image_url')
        .trim()
        .notEmpty().withMessage('Image URL is required')
        .isLength({ max: 1000 }).withMessage('Image URL is too long'),
    body('description')
        .optional()
        .isString().withMessage('Description must be text')
        .isLength({ max: 2000 }).withMessage('Description is too long'),
    body('categories')
        .optional({ values: 'falsy' })
        .isString().withMessage('Sub-category must be text')
        .isLength({ max: 80 }).withMessage('Sub-category is too long'),
    body('initial_stock')
        .optional()
        .isInt({ min: 0, max: 9999 }).withMessage('initial_stock must be between 0 and 9999'),
    body('detail_images')
        .optional()
        .isArray({ max: 6 }).withMessage('detail_images may contain at most 6 URLs'),
    body('detail_images.*')
        .optional()
        .custom(isValidDetailImageUrl).withMessage('Each detail image must be a valid http(s) URL or /images/ path')
];

// Validation rules for Admin Product Update
export const adminProductUpdateValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 180 }).withMessage('Product name must be 2-180 characters'),
    body('category')
        .optional()
        .trim()
        .isLength({ min: 1, max: 80 }).withMessage('Category must be 1-80 characters'),
    body('price')
        .optional()
        .isFloat({ min: 1000, max: 500000000 }).withMessage('Price must be >= Rp 1.000'),
    body('image_url')
        .optional()
        .trim()
        .notEmpty().withMessage('Image URL cannot be empty')
        .isLength({ max: 1000 }).withMessage('Image URL is too long'),
    body('description')
        .optional()
        .isString().withMessage('Description must be text')
        .isLength({ max: 2000 }).withMessage('Description is too long'),
    body('categories')
        .optional({ values: 'falsy' })
        .isString().withMessage('Sub-category must be text')
        .isLength({ max: 80 }).withMessage('Sub-category is too long'),
    body('detail_images')
        .optional()
        .isArray({ max: 6 }).withMessage('detail_images may contain at most 6 URLs'),
    body('detail_images.*')
        .optional()
        .custom(isValidDetailImageUrl).withMessage('Each detail image must be a valid http(s) URL or /images/ path')
];

// Validation rules for Admin Signed Storage Upload
export const adminSignedUploadValidation = [
    body('product_type')
        .optional()
        .trim()
        .isIn(['sneakers', 'apparel']).withMessage('product_type must be sneakers or apparel'),
    body('product_id')
        .optional({ values: 'null' })
        .isInt({ min: 1 }).withMessage('product_id must be a positive integer'),
    body('content_type')
        .trim()
        .isIn(['image/webp', 'image/png', 'image/jpeg', 'image/jpg']).withMessage('content_type must be image/webp, image/png, or image/jpeg'),
    body('filename')
        .optional()
        .isString().withMessage('filename must be text')
        .isLength({ max: 160 }).withMessage('filename is too long')
];

// Validation rules for Admin Detail Image Gallery Update
export const adminDetailImagesValidation = [
    body('detail_images')
        .isArray({ max: 6 }).withMessage('detail_images must be an array with at most 6 URLs'),
    body('detail_images.*')
        .custom(isValidDetailImageUrl).withMessage('Each detail image must be a valid http(s) URL or /images/ path')
];

// Validation rules for Admin Storage Object Deletion
export const adminDeleteUploadValidation = [
    body('public_url')
        .optional({ values: 'falsy' })
        .isString().withMessage('public_url must be a string')
        .isLength({ max: 1200 }).withMessage('public_url is too long'),
    body('path')
        .optional({ values: 'falsy' })
        .isString().withMessage('path must be a string')
        .isLength({ max: 300 }).withMessage('path is too long')
];

// Validation rules for Admin Bulk Variant Stock Upsert
export const adminVariantsUpsertValidation = [
    body('variants')
        .isArray({ min: 1, max: 40 }).withMessage('variants must be a non-empty array'),
    body('variants.*.size')
        .trim()
        .notEmpty().withMessage('Each variant must have a size')
        .isLength({ max: 20 }).withMessage('Variant size is too long'),
    body('variants.*.stock')
        .isInt({ min: 0, max: 9999 }).withMessage('Variant stock must be an integer between 0 and 9999'),
    body('variants.*.low_stock_threshold')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('low_stock_threshold must be between 1 and 100')
];

// Validation rules for Admin Sale Listing
export const adminSaleValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Product name is required')
        .isLength({ min: 2, max: 180 }).withMessage('Name must be 2-180 characters'),
    body('brand')
        .optional()
        .trim()
        .isLength({ max: 80 }).withMessage('Brand is too long'),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 80 }).withMessage('Category is too long'),
    body('image_url')
        .trim()
        .notEmpty().withMessage('Image URL is required')
        .isLength({ max: 1000 }).withMessage('Image URL is too long'),
    body('price')
        .isFloat({ min: 1000, max: 500000000 }).withMessage('Original price must be >= Rp 1.000'),
    body('discount_price')
        .isFloat({ min: 1, max: 500000000 }).withMessage('Discount price must be > 0'),
    body('description')
        .optional()
        .isString().withMessage('Description must be text')
        .isLength({ max: 2000 }).withMessage('Description is too long')
];

// Validation rules for Admin Coupon CRUD
export const adminCouponValidation = [
    body('code')
        .trim()
        .notEmpty().withMessage('Coupon code is required')
        .isLength({ min: 2, max: 40 }).withMessage('Coupon code must be 2-40 characters')
        .matches(/^[A-Za-z0-9_-]+$/).withMessage('Coupon code may only contain letters, numbers, - and _'),
    body('discount_type')
        .trim()
        .isIn(['percent', 'fixed']).withMessage('discount_type must be percent or fixed'),
    body('discount_value')
        .isInt({ min: 1, max: 500000000 }).withMessage('discount_value must be a positive integer'),
    body('min_purchase')
        .optional()
        .isInt({ min: 0, max: 500000000 }).withMessage('min_purchase must be >= 0'),
    body('expiry_date')
        .optional({ values: 'falsy' })
        .isISO8601().withMessage('expiry_date must be a valid ISO date')
];

// Validation rules for Admin Order Fulfillment Update
export const adminOrderUpdateValidation = [
    body('status')
        .optional()
        .trim()
        .isIn([
            'Pending Payment',
            'Paid',
            'Processing',
            'Packed',
            'Shipped',
            'Delivered',
            'Completed',
            'Cancelled',
            'Expired'
        ]).withMessage('Invalid order status'),
    body('courier')
        .optional()
        .trim()
        .isLength({ min: 2, max: 80 }).withMessage('Courier name must be 2-80 characters'),
    body('tracking_number')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 80 }).withMessage('Tracking number must be <= 80 characters')
];

// Validation rules for Admin User Role Update
export const adminUserRoleValidation = [
    body('role')
        .trim()
        .isIn(['customer', 'admin']).withMessage('Role must be customer or admin')
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
    cartSyncValidation,
    wishlistSyncValidation,
    addressValidation,
    conciergeValidation,
    dropNotifyValidation,
    adminProductCreateValidation,
    adminProductUpdateValidation,
    adminSignedUploadValidation,
    adminDetailImagesValidation,
    adminDeleteUploadValidation,
    adminVariantsUpsertValidation,
    adminSaleValidation,
    adminCouponValidation,
    adminOrderUpdateValidation,
    adminUserRoleValidation,
    validate
};

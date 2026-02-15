/**
 * Input Validation Utilities
 * Centralized validation rules for all forms
 */

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Common validation rules
export const validators = {
  required: (value: any, fieldName: string): string | null => {
    if (value === undefined || value === null || value === '' || 
        (Array.isArray(value) && value.length === 0)) {
      return `${fieldName} is required`;
    }
    return null;
  },

  email: (value: string): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Invalid email format';
    }
    return null;
  },

  minLength: (value: string, min: number, fieldName: string): string | null => {
    if (!value) return null;
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (value: string, max: number, fieldName: string): string | null => {
    if (!value) return null;
    if (value.length > max) {
      return `${fieldName} must not exceed ${max} characters`;
    }
    return null;
  },

  numeric: (value: any, fieldName: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    if (isNaN(Number(value))) {
      return `${fieldName} must be a number`;
    }
    return null;
  },

  positiveNumber: (value: any, fieldName: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) {
      return `${fieldName} must be a number`;
    }
    if (num <= 0) {
      return `${fieldName} must be greater than 0`;
    }
    return null;
  },

  nonNegativeNumber: (value: any, fieldName: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) {
      return `${fieldName} must be a number`;
    }
    if (num < 0) {
      return `${fieldName} must be 0 or greater`;
    }
    return null;
  },

  integer: (value: any, fieldName: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (isNaN(num) || !Number.isInteger(num)) {
      return `${fieldName} must be a whole number`;
    }
    return null;
  },

  date: (value: any, fieldName: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return `${fieldName} must be a valid date`;
    }
    return null;
  },

  dateNotInFuture: (value: any, fieldName: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    const now = new Date();
    if (date > now) {
      return `${fieldName} cannot be in the future`;
    }
    return null;
  },

  dateNotInPast: (value: any, fieldName: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return `${fieldName} cannot be in the past`;
    }
    return null;
  },

  dateRange: (startDate: any, endDate: any): string | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return 'Start date must be before end date';
    }
    return null;
  },

  phone: (value: string): string | null => {
    if (!value) return null;
    const phoneRegex = /^[+]?[\d\s-()]{8,}$/;
    if (!phoneRegex.test(value)) {
      return 'Invalid phone number format';
    }
    return null;
  },

  url: (value: string): string | null => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'Invalid URL format';
    }
  },

  pin: (value: string): string | null => {
    if (!value) return null;
    if (!/^\d{4,6}$/.test(value)) {
      return 'PIN must be 4-6 digits';
    }
    return null;
  },

  password: (value: string): string | null => {
    if (!value) return null;
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/\d/.test(value)) {
      return 'Password must contain at least one number';
    }
    return null;
  },

  quantity: (value: any, max?: number): string | null => {
    if (value === undefined || value === null || value === '') {
      return 'Quantity is required';
    }
    const num = Number(value);
    if (isNaN(num)) {
      return 'Quantity must be a number';
    }
    if (num <= 0) {
      return 'Quantity must be greater than 0';
    }
    if (max !== undefined && num > max) {
      return `Quantity cannot exceed ${max}`;
    }
    return null;
  },

  meterReading: (value: any, previousReading?: number): string | null => {
    if (value === undefined || value === null || value === '') {
      return 'Meter reading is required';
    }
    const num = Number(value);
    if (isNaN(num)) {
      return 'Meter reading must be a number';
    }
    if (num < 0) {
      return 'Meter reading cannot be negative';
    }
    if (previousReading !== undefined && num < previousReading) {
      return `Meter reading (${num}) is less than previous reading (${previousReading}). Please confirm or enter supervisor PIN.`;
    }
    return null;
  },

  assetCode: (value: string): string | null => {
    if (!value) return 'Asset code is required';
    if (!/^[A-Z0-9-]{3,20}$/i.test(value)) {
      return 'Asset code must be 3-20 characters (letters, numbers, hyphens)';
    }
    return null;
  },

  itemCode: (value: string): string | null => {
    if (!value) return 'Item code is required';
    if (!/^[A-Z0-9-]{3,30}$/i.test(value)) {
      return 'Item code must be 3-30 characters (letters, numbers, hyphens)';
    }
    return null;
  },

  inList: (value: any, list: any[], fieldName: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    if (!list.includes(value)) {
      return `Invalid ${fieldName} value`;
    }
    return null;
  },
};

// Validation schema builder
export class ValidationSchema {
  private rules: Array<{
    field: string;
    validator: (value: any, data: any) => string | null;
  }> = [];

  field(fieldName: string) {
    return {
      required: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.required(value, fieldName),
        });
        return this.field(fieldName);
      },
      email: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.email(value),
        });
        return this.field(fieldName);
      },
      minLength: (min: number) => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.minLength(value, min, fieldName),
        });
        return this.field(fieldName);
      },
      maxLength: (max: number) => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.maxLength(value, max, fieldName),
        });
        return this.field(fieldName);
      },
      numeric: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.numeric(value, fieldName),
        });
        return this.field(fieldName);
      },
      positiveNumber: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.positiveNumber(value, fieldName),
        });
        return this.field(fieldName);
      },
      nonNegativeNumber: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.nonNegativeNumber(value, fieldName),
        });
        return this.field(fieldName);
      },
      date: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.date(value, fieldName),
        });
        return this.field(fieldName);
      },
      dateNotInFuture: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.dateNotInFuture(value, fieldName),
        });
        return this.field(fieldName);
      },
      dateNotInPast: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.dateNotInPast(value, fieldName),
        });
        return this.field(fieldName);
      },
      phone: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.phone(value),
        });
        return this.field(fieldName);
      },
      password: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.password(value),
        });
        return this.field(fieldName);
      },
      pin: () => {
        this.rules.push({
          field: fieldName,
          validator: (value) => validators.pin(value),
        });
        return this.field(fieldName);
      },
      custom: (validator: (value: any, data: any) => string | null) => {
        this.rules.push({ field: fieldName, validator });
        return this.field(fieldName);
      },
      end: () => this,
    };
  }

  validate(data: Record<string, any>): ValidationResult {
    const errors: Record<string, string> = {};

    for (const rule of this.rules) {
      const value = data[rule.field];
      const error = rule.validator(value, data);
      if (error && !errors[rule.field]) {
        errors[rule.field] = error;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

// Sanitization utilities
export const sanitizers = {
  trim: (value: string): string => value?.trim() || '',

  toLowerCase: (value: string): string => value?.toLowerCase() || '',

  toUpperCase: (value: string): string => value?.toUpperCase() || '',

  removeSpecialChars: (value: string): string => value?.replace(/[^a-zA-Z0-9\s]/g, '') || '',

  toNumber: (value: any): number | null => {
    const num = Number(value);
    return isNaN(num) ? null : num;
  },

  toInteger: (value: any): number | null => {
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  },

  toBoolean: (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  },

  sanitizeHtml: (value: string): string => {
    return value
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  sanitizeForSql: (value: string): string => {
    // Basic sanitization - Prisma handles parameterized queries
    return value.replace(/'/g, "''");
  },
};

// Form data cleaner
export function cleanFormData<T extends Record<string, any>>(data: T): T {
  const cleaned: any = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      cleaned[key] = value.trim();
    } else if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// API Error class
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly traceId?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, any>) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, details?: Record<string, any>) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static validationError(errors: Record<string, string>) {
    return new AppError('Validation failed', 422, 'VALIDATION_ERROR', { errors });
  }

  static internal(message: string = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable') {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

// Express-like error handler wrapper
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      // Convert unknown errors to AppError
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      throw AppError.internal(message);
    }
  }) as T;
}

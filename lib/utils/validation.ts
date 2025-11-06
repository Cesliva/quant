/**
 * Form Validation Utilities
 * Provides validation functions and error message formatting
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (US format)
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\(\)]+$/;
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 11;
}

/**
 * Validate required field
 */
export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !isNaN(value);
  return true;
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  min?: number,
  max?: number
): boolean {
  if (isNaN(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Validate ZIP code (US format)
 */
export function validateZipCode(zip: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

/**
 * Validate state code (2 letters)
 */
export function validateStateCode(state: string): boolean {
  return /^[A-Z]{2}$/i.test(state);
}

/**
 * Validate company settings
 */
export function validateCompanySettings(data: {
  companyName?: string;
  email?: string;
  phone?: string;
  zip?: string;
  state?: string;
  laborRates?: Array<{ trade: string; rate: number }>;
  materialGrades?: Array<{ grade: string; costPerPound: number }>;
  coatingTypes?: Array<{ type: string; costPerSF: number }>;
  markupSettings?: {
    overheadPercentage?: number;
    profitPercentage?: number;
    materialWasteFactor?: number;
    laborWasteFactor?: number;
  };
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Company name is required
  if (data.companyName !== undefined && !validateRequired(data.companyName)) {
    errors.push({ field: "companyName", message: "Company name is required" });
  }

  // Email validation
  if (data.email && !validateEmail(data.email)) {
    errors.push({ field: "email", message: "Please enter a valid email address" });
  }

  // Phone validation
  if (data.phone && !validatePhone(data.phone)) {
    errors.push({
      field: "phone",
      message: "Please enter a valid phone number",
    });
  }

  // ZIP code validation
  if (data.zip && !validateZipCode(data.zip)) {
    errors.push({
      field: "zip",
      message: "Please enter a valid ZIP code (e.g., 12345 or 12345-6789)",
    });
  }

  // State validation
  if (data.state && !validateStateCode(data.state)) {
    errors.push({
      field: "state",
      message: "Please enter a valid 2-letter state code",
    });
  }

  // Labor rates validation
  if (data.laborRates) {
    data.laborRates.forEach((rate, index) => {
      if (!validateRequired(rate.trade)) {
        errors.push({
          field: `laborRates[${index}].trade`,
          message: "Trade name is required",
        });
      }
      if (!validateNumberRange(rate.rate, 0, 1000)) {
        errors.push({
          field: `laborRates[${index}].rate`,
          message: "Labor rate must be between $0 and $1,000 per hour",
        });
      }
    });
  }

  // Material grades validation
  if (data.materialGrades) {
    data.materialGrades.forEach((grade, index) => {
      if (!validateRequired(grade.grade)) {
        errors.push({
          field: `materialGrades[${index}].grade`,
          message: "Grade is required",
        });
      }
      if (!validateNumberRange(grade.costPerPound, 0, 100)) {
        errors.push({
          field: `materialGrades[${index}].costPerPound`,
          message: "Cost per pound must be between $0 and $100",
        });
      }
    });
  }

  // Coating types validation
  if (data.coatingTypes) {
    data.coatingTypes.forEach((coating, index) => {
      if (!validateRequired(coating.type)) {
        errors.push({
          field: `coatingTypes[${index}].type`,
          message: "Coating type is required",
        });
      }
      if (!validateNumberRange(coating.costPerSF, 0, 1000)) {
        errors.push({
          field: `coatingTypes[${index}].costPerSF`,
          message: "Cost per square foot must be between $0 and $1,000",
        });
      }
    });
  }

  // Markup settings validation
  if (data.markupSettings) {
    const { overheadPercentage, profitPercentage, materialWasteFactor, laborWasteFactor } =
      data.markupSettings;

    if (
      overheadPercentage !== undefined &&
      !validateNumberRange(overheadPercentage, 0, 100)
    ) {
      errors.push({
        field: "overheadPercentage",
        message: "Overhead percentage must be between 0% and 100%",
      });
    }

    if (
      profitPercentage !== undefined &&
      !validateNumberRange(profitPercentage, 0, 100)
    ) {
      errors.push({
        field: "profitPercentage",
        message: "Profit percentage must be between 0% and 100%",
      });
    }

    if (
      materialWasteFactor !== undefined &&
      !validateNumberRange(materialWasteFactor, 0, 50)
    ) {
      errors.push({
        field: "materialWasteFactor",
        message: "Material waste factor must be between 0% and 50%",
      });
    }

    if (
      laborWasteFactor !== undefined &&
      !validateNumberRange(laborWasteFactor, 0, 50)
    ) {
      errors.push({
        field: "laborWasteFactor",
        message: "Labor waste factor must be between 0% and 50%",
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get error message for a specific field
 */
export function getFieldError(
  field: string,
  errors: ValidationError[]
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}


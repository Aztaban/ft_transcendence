export const DISPLAY_NAME_MAX_LENGTH = 64;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC_ONLY_PATTERN = /^\d+$/;

export interface RegistrationValues {
  display_name: string;
  email: string;
  password: string;
}

export type RegistrationFieldErrors = Partial<Record<keyof RegistrationValues, string>>;

export function validateRegistration(values: RegistrationValues): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};

  if (!values.display_name) {
    errors.display_name = "Display name is required.";
  } else if (values.display_name.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.display_name = `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!values.email) {
    errors.email = "Email is required.";
  } else if (values.email.length > EMAIL_MAX_LENGTH) {
    errors.email = `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (NUMERIC_ONLY_PATTERN.test(values.password)) {
    errors.password = "Password cannot contain only numbers.";
  }

  return errors;
}

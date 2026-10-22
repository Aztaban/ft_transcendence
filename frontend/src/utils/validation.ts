import i18n from "../i18n";

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
    errors.display_name = i18n.t("validation.displayNameRequired");
  } else if (values.display_name.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.display_name = i18n.t("validation.displayNameTooLong", { max: DISPLAY_NAME_MAX_LENGTH });
  }

  if (!values.email) {
    errors.email = i18n.t("validation.emailRequired");
  } else if (values.email.length > EMAIL_MAX_LENGTH) {
    errors.email = i18n.t("validation.emailTooLong", { max: EMAIL_MAX_LENGTH });
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = i18n.t("validation.emailInvalid");
  }

  if (!values.password) {
    errors.password = i18n.t("validation.passwordRequired");
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = i18n.t("validation.passwordTooShort", { min: PASSWORD_MIN_LENGTH });
  } else if (NUMERIC_ONLY_PATTERN.test(values.password)) {
    errors.password = i18n.t("validation.passwordNumeric");
  }

  return errors;
}

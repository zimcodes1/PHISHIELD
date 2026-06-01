export type PasswordRule = {
  label: string;
  met: boolean;
};

export function getPasswordRules(password: string, confirm: string): PasswordRule[] {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains a letter", met: /[A-Za-z]/.test(password) },
    { label: "Passwords match", met: password.length > 0 && password === confirm },
  ];
}

export function validatePasswordRules(password: string, confirm: string): string | null {
  if (password.length < 8)
    return "Password must be at least 8 characters.";
  if (!/\d/.test(password))
    return "Password must contain at least one number.";
  if (!/[A-Za-z]/.test(password))
    return "Password must contain at least one letter.";
  if (password !== confirm)
    return "Passwords do not match.";
  return null;
}

export const MIN_PASSWORD_LENGTH = 6;

export function normalizeProfileName(value: unknown) {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return typeof body.name === "string" ? body.name.trim() : "";
}

export function validateProfileName(name: string) {
  if (name.length < 2) return "O nome precisa ter pelo menos 2 caracteres.";
  if (name.length > 80) return "O nome pode ter no máximo 80 caracteres.";
  return null;
}

export type PasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function normalizePasswordInput(value: unknown): PasswordInput {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
    newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
    confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
  };
}

export function validatePasswordInput(input: PasswordInput, hasPassword: boolean) {
  if (hasPassword && !input.currentPassword) return "Informe a senha atual.";
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (input.newPassword !== input.confirmPassword) return "As novas senhas não coincidem.";
  return null;
}

export type RegistrationInput = {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
};

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeRegistrationInput(value: unknown): RegistrationInput {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    email: normalizeEmail(body.email),
    name: typeof body.name === "string" ? body.name.trim() : "",
    password: typeof body.password === "string" ? body.password : "",
    confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
  };
}

export function validateRegistrationInput(input: RegistrationInput) {
  if (!input.email || !input.password || !input.name) {
    return { error: "Email, nome e senha são obrigatórios", status: 400 };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.email)) {
    return { error: "Informe um email válido", status: 400 };
  }
  if (input.password !== input.confirmPassword) {
    return { error: "As senhas não correspondem", status: 400 };
  }
  if (input.password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres", status: 400 };
  }
  return null;
}

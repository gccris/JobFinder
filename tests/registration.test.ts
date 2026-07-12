import { describe, expect, it } from "vitest";

import { normalizeEmail, normalizeRegistrationInput, validateRegistrationInput } from "../lib/registration";

describe("registration", () => {
  it("normalizes email and display name without changing passwords", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(normalizeRegistrationInput({
      email: "  User@Example.COM ",
      name: "  Maria Silva  ",
      password: " secret ",
      confirmPassword: " secret ",
    })).toEqual({
      email: "user@example.com",
      name: "Maria Silva",
      password: " secret ",
      confirmPassword: " secret ",
    });
  });

  it("rejects invalid, mismatched and short credentials", () => {
    expect(validateRegistrationInput(normalizeRegistrationInput({}))).toMatchObject({ status: 400 });
    expect(validateRegistrationInput(normalizeRegistrationInput({ name: "Ana", email: "invalid", password: "123456", confirmPassword: "123456" }))).toMatchObject({ error: "Informe um email válido" });
    expect(validateRegistrationInput(normalizeRegistrationInput({ name: "Ana", email: "ana@example.com", password: "123456", confirmPassword: "654321" }))).toMatchObject({ error: "As senhas não correspondem" });
    expect(validateRegistrationInput(normalizeRegistrationInput({ name: "Ana", email: "ana@example.com", password: "123", confirmPassword: "123" }))).toMatchObject({ error: "A senha deve ter pelo menos 6 caracteres" });
  });

  it("accepts a valid normalized registration", () => {
    const input = normalizeRegistrationInput({ name: "Ana", email: "ANA@EXAMPLE.COM", password: "123456", confirmPassword: "123456" });
    expect(validateRegistrationInput(input)).toBeNull();
    expect(input.email).toBe("ana@example.com");
  });
});

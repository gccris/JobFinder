import { describe, expect, it } from "vitest";

import { normalizePasswordInput, normalizeProfileName, validatePasswordInput, validateProfileName } from "../lib/profile";

describe("profile validation", () => {
  it("normalizes and validates names", () => {
    expect(normalizeProfileName({ name: "  Ana Silva  " })).toBe("Ana Silva");
    expect(validateProfileName("A")).toBeTruthy();
    expect(validateProfileName("Ana Silva")).toBeNull();
  });

  it("requires the current password only when one already exists", () => {
    const input = normalizePasswordInput({ newPassword: "123456", confirmPassword: "123456" });
    expect(validatePasswordInput(input, true)).toBe("Informe a senha atual.");
    expect(validatePasswordInput(input, false)).toBeNull();
  });

  it("rejects short or mismatched new passwords", () => {
    expect(validatePasswordInput({ currentPassword: "old", newPassword: "123", confirmPassword: "123" }, true)).toContain("6 caracteres");
    expect(validatePasswordInput({ currentPassword: "old", newPassword: "123456", confirmPassword: "654321" }, true)).toContain("não coincidem");
  });
});

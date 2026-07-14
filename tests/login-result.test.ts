import { describe, expect, it } from "vitest";

import { getCredentialSignInError, getOAuthSignInError } from "../lib/login-result";

describe("credential sign-in result", () => {
  it("treats Auth.js HTTP 200 credential errors as failures", () => {
    expect(getCredentialSignInError({ ok: true, error: "CredentialsSignin", code: "access_pending" }))
      .toBe("Seu acesso ainda não foi liberado pelo administrador.");
  });

  it("keeps other credential failures generic", () => {
    expect(getCredentialSignInError({ ok: true, error: "CredentialsSignin", code: "credentials" }))
      .toBe("Email ou senha incorretos. Verifique os dados e tente novamente.");
  });

  it("returns no error for a successful sign-in", () => {
    expect(getCredentialSignInError({ ok: true })).toBeNull();
  });
});

describe("OAuth sign-in result", () => {
  it("explains when an email is already linked to another sign-in method", () => {
    expect(getOAuthSignInError("OAuthAccountNotLinked")).toContain("outra forma de acesso");
  });

  it("returns no error when OAuth did not fail", () => {
    expect(getOAuthSignInError(null)).toBeNull();
  });
});

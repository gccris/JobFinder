export interface CredentialSignInResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export function getCredentialSignInError(result: CredentialSignInResult | undefined) {
  if (!result || (!result.error && result.ok)) return null;
  if (result.code === "access_pending") {
    return "Seu acesso ainda não foi liberado pelo administrador.";
  }
  return "Email ou senha incorretos. Verifique os dados e tente novamente.";
}

export function getOAuthSignInError(error: string | null) {
  if (!error) return null;
  if (error === "OAuthAccountNotLinked") {
    return "Este email já usa outra forma de acesso. Entre com email e senha.";
  }
  if (error === "AccessDenied") {
    return "O acesso pelo Google foi cancelado ou recusado.";
  }
  if (error === "Configuration") {
    return "O login pelo Google ainda não está configurado neste ambiente.";
  }
  return "Não foi possível entrar com o Google. Tente novamente.";
}

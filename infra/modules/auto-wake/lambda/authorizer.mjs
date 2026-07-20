import { getAccessSecret } from "./secret.mjs";
import { parseCookies, verifySession } from "./controller.mjs";

const secretArn = process.env.ACCESS_SECRET_ARN;
const cookieName = process.env.SESSION_COOKIE_NAME || "jobhub_lab";

export async function handler(event) {
  try {
    const secret = await getAccessSecret(secretArn);
    const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || "");
    return {
      isAuthorized: verifySession(cookies[cookieName], secret.signingKey),
      context: { environment: process.env.ENVIRONMENT || "production" },
    };
  } catch (error) {
    console.error("Falha no authorizer do auto-wake", error);
    return { isAuthorized: false };
  }
}

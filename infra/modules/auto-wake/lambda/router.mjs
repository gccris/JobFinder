import { randomUUID } from "node:crypto";
import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import {
  ENVIRONMENT_STATES,
  accessPage,
  createSession,
  originalRequestUri,
  secretsMatch,
  wakingResponse,
} from "./controller.mjs";
import { getAccessSecret } from "./secret.mjs";

const dynamodb = new DynamoDBClient({});
const codebuild = new CodeBuildClient({});
const tableName = process.env.STATE_TABLE_NAME;
const environment = process.env.ENVIRONMENT || "production";
const projectName = process.env.CODEBUILD_PROJECT_NAME;
const accessSecretArn = process.env.ACCESS_SECRET_ARN;
const cookieName = process.env.SESSION_COOKIE_NAME || "jobhub_lab";
const sessionTtl = Number(process.env.SESSION_TTL_SECONDS || 2_592_000);

export async function handler(event) {
  const routeKey = event.routeKey || "$default";
  const method = event.requestContext?.http?.method || "GET";

  if (routeKey === "GET /access") return accessPage();
  if (routeKey === "POST /session") return createBrowserSession(event);
  if (routeKey === "POST /session/logout") return clearBrowserSession();
  if (routeKey === "GET /_infra/status") return statusResponse();

  const originalUri = originalRequestUri(event);
  let state = await readState();

  if ([ENVIRONMENT_STATES.SLEEPING, ENVIRONMENT_STATES.FAILED].includes(state.value)) {
    const requestId = randomUUID();
    const acquired = await acquireWakeLock(requestId);
    if (acquired) {
      try {
        const build = await codebuild.send(
          new StartBuildCommand({
            projectName,
            environmentVariablesOverride: [
              { name: "ACTION", value: "WAKE", type: "PLAINTEXT" },
              { name: "WAKE_REQUEST_ID", value: requestId, type: "PLAINTEXT" },
              { name: "ORIGINAL_URI", value: originalUri, type: "PLAINTEXT" },
            ],
          })
        );
        await recordBuild(requestId, build.build?.id || "unknown");
      } catch (error) {
        await markFailed(requestId);
        throw error;
      }
    }
    state = { value: ENVIRONMENT_STATES.WAKING, method };
  } else if (state.value === ENVIRONMENT_STATES.SLEEPING_DOWN) {
    await requestWakeAfterSleep();
    state = { value: ENVIRONMENT_STATES.WAKING, method };
  } else {
    state = { ...state, method };
  }

  return wakingResponse(state, originalUri);
}

async function createBrowserSession(event) {
  const secret = await getAccessSecret(accessSecretArn);
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  let token = "";
  if (contentType.includes("application/json")) {
    try {
      token = JSON.parse(body).token || "";
    } catch {
      token = "";
    }
  } else {
    token = new URLSearchParams(body).get("token") || "";
  }

  if (!secretsMatch(token, secret.accessToken)) {
    return { ...accessPage("Segredo inválido."), statusCode: 401 };
  }

  const session = createSession(secret.signingKey, sessionTtl);
  return {
    statusCode: 303,
    headers: { location: "/", "cache-control": "no-store" },
    cookies: [`${cookieName}=${session}; Max-Age=${sessionTtl}; Path=/; Secure; HttpOnly; SameSite=Lax`],
    body: "",
  };
}

function clearBrowserSession() {
  return {
    statusCode: 303,
    headers: { location: "/access", "cache-control": "no-store" },
    cookies: [`${cookieName}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`],
    body: "",
  };
}

async function statusResponse() {
  const state = await readState();
  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify({ state: state.value, updatedAt: state.updatedAt || null }),
  };
}

async function readState() {
  const result = await dynamodb.send(
    new GetItemCommand({ TableName: tableName, Key: { environment: { S: environment } }, ConsistentRead: true })
  );
  return {
    value: result.Item?.state?.S || ENVIRONMENT_STATES.SLEEPING,
    updatedAt: result.Item?.updatedAt?.S,
  };
}

async function acquireWakeLock(requestId) {
  try {
    await dynamodb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: { environment: { S: environment } },
        UpdateExpression: "SET #state = :waking, requestId = :requestId, updatedAt = :updatedAt REMOVE wakeRequested",
        ConditionExpression: "attribute_not_exists(#state) OR #state IN (:sleeping, :failed)",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":waking": { S: ENVIRONMENT_STATES.WAKING },
          ":sleeping": { S: ENVIRONMENT_STATES.SLEEPING },
          ":failed": { S: ENVIRONMENT_STATES.FAILED },
          ":requestId": { S: requestId },
          ":updatedAt": { S: new Date().toISOString() },
        },
      })
    );
    return true;
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") return false;
    throw error;
  }
}

async function recordBuild(requestId, buildId) {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: { environment: { S: environment } },
      UpdateExpression: "SET buildId = :buildId, updatedAt = :updatedAt",
      ConditionExpression: "requestId = :requestId",
      ExpressionAttributeValues: {
        ":buildId": { S: buildId },
        ":updatedAt": { S: new Date().toISOString() },
        ":requestId": { S: requestId },
      },
    })
  );
}

async function markFailed(requestId) {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: { environment: { S: environment } },
      UpdateExpression: "SET #state = :failed, updatedAt = :updatedAt",
      ConditionExpression: "requestId = :requestId",
      ExpressionAttributeNames: { "#state": "state" },
      ExpressionAttributeValues: {
        ":failed": { S: ENVIRONMENT_STATES.FAILED },
        ":updatedAt": { S: new Date().toISOString() },
        ":requestId": { S: requestId },
      },
    })
  );
}

async function requestWakeAfterSleep() {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: { environment: { S: environment } },
      UpdateExpression: "SET wakeRequested = :requested, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":requested": { BOOL: true },
        ":updatedAt": { S: new Date().toISOString() },
      },
    })
  );
}

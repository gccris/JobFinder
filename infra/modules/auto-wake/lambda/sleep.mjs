import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ENVIRONMENT_STATES } from "./controller.mjs";

const codebuild = new CodeBuildClient({});
const cloudwatch = new CloudWatchClient({});
const dynamodb = new DynamoDBClient({});
const tableName = process.env.STATE_TABLE_NAME;
const environment = process.env.ENVIRONMENT || "production";
const projectName = process.env.CODEBUILD_PROJECT_NAME;
const idleMinutes = Number(process.env.IDLE_MINUTES || 60);

export async function handler() {
  const state = await readState();
  if (state.value !== ENVIRONMENT_STATES.READY || !state.loadBalancerDimension) {
    return { checked: false, state: state.value };
  }

  const requests = await requestCount(state.loadBalancerDimension);
  if (requests > 0) return { checked: true, sleeping: false, requests };

  const acquired = await acquireSleepLock();
  if (!acquired) return { checked: true, sleeping: false, reason: "state-changed" };

  try {
    const build = await codebuild.send(
      new StartBuildCommand({
        projectName,
        environmentVariablesOverride: [{ name: "ACTION", value: "SLEEP", type: "PLAINTEXT" }],
      })
    );
    await recordBuild(build.build?.id || "unknown");
    return { checked: true, sleeping: true, requests: 0 };
  } catch (error) {
    await restoreReadyState();
    throw error;
  }
}

async function readState() {
  const result = await dynamodb.send(
    new GetItemCommand({ TableName: tableName, Key: { environment: { S: environment } }, ConsistentRead: true })
  );
  return {
    value: result.Item?.state?.S || ENVIRONMENT_STATES.SLEEPING,
    loadBalancerDimension: result.Item?.loadBalancerDimension?.S,
  };
}

async function requestCount(loadBalancerDimension) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - idleMinutes * 60_000);
  const result = await cloudwatch.send(
    new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: endTime,
      MetricDataQueries: [
        {
          Id: "requests",
          ReturnData: true,
          MetricStat: {
            Period: Math.max(60, idleMinutes * 60),
            Stat: "Sum",
            Metric: {
              Namespace: "AWS/ApplicationELB",
              MetricName: "RequestCount",
              Dimensions: [{ Name: "LoadBalancer", Value: loadBalancerDimension }],
            },
          },
        },
      ],
    })
  );
  return (result.MetricDataResults?.[0]?.Values || []).reduce((sum, value) => sum + value, 0);
}

async function acquireSleepLock() {
  try {
    await dynamodb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: { environment: { S: environment } },
        UpdateExpression: "SET #state = :sleepingDown, updatedAt = :updatedAt REMOVE wakeRequested",
        ConditionExpression: "#state = :ready",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":sleepingDown": { S: ENVIRONMENT_STATES.SLEEPING_DOWN },
          ":ready": { S: ENVIRONMENT_STATES.READY },
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

async function recordBuild(buildId) {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: { environment: { S: environment } },
      UpdateExpression: "SET buildId = :buildId, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":buildId": { S: buildId },
        ":updatedAt": { S: new Date().toISOString() },
      },
    })
  );
}

async function restoreReadyState() {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: { environment: { S: environment } },
      UpdateExpression: "SET #state = :ready, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#state": "state" },
      ExpressionAttributeValues: {
        ":ready": { S: ENVIRONMENT_STATES.READY },
        ":updatedAt": { S: new Date().toISOString() },
      },
    })
  );
}

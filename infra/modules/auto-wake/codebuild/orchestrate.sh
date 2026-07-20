#!/usr/bin/env bash
set -Eeuo pipefail

WORK_DIR="/tmp/jobhub-auto-wake"
RELEASE_DIR="$WORK_DIR/release"
TF_DIR="$RELEASE_DIR/$TF_ROOT"

release_deploy_role() {
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
}

mark_failed() {
  local exit_code=$?
  release_deploy_role
  aws apigatewayv2 update-route \
    --api-id "$API_ID" \
    --route-id "$DEFAULT_ROUTE_ID" \
    --target "integrations/$WAKE_INTEGRATION_ID" >/dev/null 2>&1 || true
  aws dynamodb update-item \
    --table-name "$STATE_TABLE_NAME" \
    --key "{\"environment\":{\"S\":\"$ENVIRONMENT\"}}" \
    --update-expression "SET #state = :state, updatedAt = :updatedAt" \
    --expression-attribute-names '{"#state":"state"}' \
    --expression-attribute-values "{\":state\":{\"S\":\"FAILED\"},\":updatedAt\":{\"S\":\"$(date -u +%FT%TZ)\"}}" >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap mark_failed ERR

assume_deploy_role() {
  local credentials
  credentials=$(aws sts assume-role \
    --role-arn "$TF_DEPLOY_ROLE_ARN" \
    --role-session-name "auto-wake-${ENVIRONMENT}" \
    --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
    --output text)
  read -r AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN <<<"$credentials"
  export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
}

terraform_init() {
  terraform init -input=false \
    -backend-config="bucket=$TF_STATE_BUCKET" \
    -backend-config="key=$TF_STATE_KEY" \
    -backend-config="region=$AWS_DEFAULT_REGION" \
    -backend-config="use_lockfile=true"
}

tf_output() {
  terraform output -raw "$1"
}

tf_output_json() {
  terraform output -json "$1"
}

set_ready() {
  local integration_id=$1
  local load_balancer_dimension=$2
  release_deploy_role
  aws apigatewayv2 update-route \
    --api-id "$API_ID" \
    --route-id "$DEFAULT_ROUTE_ID" \
    --target "integrations/$integration_id" >/dev/null
  aws dynamodb update-item \
    --table-name "$STATE_TABLE_NAME" \
    --key "{\"environment\":{\"S\":\"$ENVIRONMENT\"}}" \
    --update-expression "SET #state = :state, appIntegrationId = :integration, loadBalancerDimension = :loadBalancer, updatedAt = :updatedAt REMOVE wakeRequested" \
    --expression-attribute-names '{"#state":"state"}' \
    --expression-attribute-values "{\":state\":{\"S\":\"READY\"},\":integration\":{\"S\":\"$integration_id\"},\":loadBalancer\":{\"S\":\"$load_balancer_dimension\"},\":updatedAt\":{\"S\":\"$(date -u +%FT%TZ)\"}}" >/dev/null
}

restore_ready_after_blocked_sleep() {
  local integration_id=$1
  release_deploy_role
  aws apigatewayv2 update-route \
    --api-id "$API_ID" \
    --route-id "$DEFAULT_ROUTE_ID" \
    --target "integrations/$integration_id" >/dev/null
  aws dynamodb update-item \
    --table-name "$STATE_TABLE_NAME" \
    --key "{\"environment\":{\"S\":\"$ENVIRONMENT\"}}" \
    --update-expression "SET #state = :state, updatedAt = :updatedAt" \
    --expression-attribute-names '{"#state":"state"}' \
    --expression-attribute-values "{\":state\":{\"S\":\"READY\"},\":updatedAt\":{\"S\":\"$(date -u +%FT%TZ)\"}}" >/dev/null
}

wait_for_services() {
  local cluster=$1
  while IFS= read -r service; do
    [ -z "$service" ] && continue
    aws ecs wait services-stable --cluster "$cluster" --services "$service"
  done < <(tf_output_json ecs_service_names | jq -r '.[]')
}

wait_for_targets() {
  local target_group=$1
  for _ in $(seq 1 40); do
    local health
    health=$(aws elbv2 describe-target-health \
      --target-group-arn "$target_group" \
      --query 'TargetHealthDescriptions[].TargetHealth.State' \
      --output text)
    if [ -n "$health" ] && ! grep -Eq 'initial|unhealthy|draining|unused|unavailable' <<<"$health"; then
      return 0
    fi
    sleep 15
  done
  echo "Os targets não ficaram saudáveis dentro do prazo." >&2
  return 1
}

run_sleep_safety_check() {
  local cluster task_definition container_name task_arn exit_code
  cluster=$(tf_output ecs_cluster_name)
  task_definition=$(tf_output sleep_check_task_definition_arn)
  container_name=$(tf_output sleep_check_container_name)
  local network_configuration
  network_configuration=$(jq -cn \
    --argjson subnets "$(tf_output_json sleep_check_subnet_ids)" \
    --argjson securityGroups "$(tf_output_json sleep_check_security_group_ids)" \
    '{awsvpcConfiguration:{subnets:$subnets,securityGroups:$securityGroups,assignPublicIp:"ENABLED"}}')
  local overrides
  overrides=$(jq -cn --arg name "$container_name" '{containerOverrides:[{name:$name,command:["npm","run","ops:can-sleep"]}]}')

  task_arn=$(aws ecs run-task \
    --cluster "$cluster" \
    --task-definition "$task_definition" \
    --launch-type FARGATE \
    --network-configuration "$network_configuration" \
    --overrides "$overrides" \
    --query 'tasks[0].taskArn' \
    --output text)
  aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task_arn"
  exit_code=$(aws ecs describe-tasks \
    --cluster "$cluster" \
    --tasks "$task_arn" \
    --query 'tasks[0].containers[0].exitCode' \
    --output text)
  return "$exit_code"
}

run_migrations() {
  local cluster task_definition container_name task_arn exit_code
  cluster=$(tf_output ecs_cluster_name)
  task_definition=$(tf_output migration_task_definition_arn)
  container_name=$(tf_output migration_container_name)
  local network_configuration
  network_configuration=$(jq -cn \
    --argjson subnets "$(tf_output_json sleep_check_subnet_ids)" \
    --argjson securityGroups "$(tf_output_json sleep_check_security_group_ids)" \
    '{awsvpcConfiguration:{subnets:$subnets,securityGroups:$securityGroups,assignPublicIp:"ENABLED"}}')

  task_arn=$(aws ecs run-task \
    --cluster "$cluster" \
    --task-definition "$task_definition" \
    --launch-type FARGATE \
    --network-configuration "$network_configuration" \
    --query 'tasks[0].taskArn' \
    --output text)
  aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task_arn"
  exit_code=$(aws ecs describe-tasks \
    --cluster "$cluster" \
    --tasks "$task_arn" \
    --query "tasks[0].containers[?name=='$container_name'].exitCode | [0]" \
    --output text)
  if [ "$exit_code" != "0" ]; then
    echo "Migration falhou com codigo $exit_code." >&2
    return 1
  fi
}

finish_sleep() {
  release_deploy_role
  local wake_requested
  wake_requested=$(aws dynamodb get-item \
    --table-name "$STATE_TABLE_NAME" \
    --key "{\"environment\":{\"S\":\"$ENVIRONMENT\"}}" \
    --query 'Item.wakeRequested.BOOL' \
    --output text)

  if [ "$wake_requested" = "True" ]; then
    aws dynamodb update-item \
      --table-name "$STATE_TABLE_NAME" \
      --key "{\"environment\":{\"S\":\"$ENVIRONMENT\"}}" \
      --update-expression "SET #state = :state, updatedAt = :updatedAt REMOVE wakeRequested" \
      --expression-attribute-names '{"#state":"state"}' \
      --expression-attribute-values "{\":state\":{\"S\":\"WAKING\"},\":updatedAt\":{\"S\":\"$(date -u +%FT%TZ)\"}}" >/dev/null
    aws codebuild start-build \
      --project-name "$CODEBUILD_PROJECT_NAME" \
      --environment-variables-override name=ACTION,value=WAKE,type=PLAINTEXT >/dev/null
  else
    aws dynamodb update-item \
      --table-name "$STATE_TABLE_NAME" \
      --key "{\"environment\":{\"S\":\"$ENVIRONMENT\"}}" \
      --update-expression "SET #state = :state, updatedAt = :updatedAt REMOVE appIntegrationId, loadBalancerDimension, wakeRequested" \
      --expression-attribute-names '{"#state":"state"}' \
      --expression-attribute-values "{\":state\":{\"S\":\"SLEEPING\"},\":updatedAt\":{\"S\":\"$(date -u +%FT%TZ)\"}}" >/dev/null
  fi
}

rm -rf "$WORK_DIR"
mkdir -p "$RELEASE_DIR"
aws s3 cp "s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY" "$WORK_DIR/release.zip"
unzip -q "$WORK_DIR/release.zip" -d "$RELEASE_DIR"
cd "$TF_DIR"

assume_deploy_role
terraform_init

case "$ACTION" in
  WAKE)
    terraform apply -input=false -auto-approve \
      -var="environment=$ENVIRONMENT" \
      -var="desired_count_app=0" \
      -var="desired_count_worker=0"
    run_migrations
    terraform apply -input=false -auto-approve -var="environment=$ENVIRONMENT"
    cluster=$(tf_output ecs_cluster_name)
    wait_for_services "$cluster"
    wait_for_targets "$(tf_output target_group_arn)"
    integration_id=$(tf_output api_gateway_integration_id)
    load_balancer_dimension=$(tf_output load_balancer_dimension)
    set_ready "$integration_id" "$load_balancer_dimension"
    ;;
  SLEEP)
    integration_id=$(tf_output api_gateway_integration_id)
    release_deploy_role
    aws apigatewayv2 update-route \
      --api-id "$API_ID" \
      --route-id "$DEFAULT_ROUTE_ID" \
      --target "integrations/$WAKE_INTEGRATION_ID" >/dev/null
    assume_deploy_role
    set +e
    run_sleep_safety_check
    safety_exit=$?
    set -e
    if [ "$safety_exit" -eq 2 ]; then
      restore_ready_after_blocked_sleep "$integration_id"
      exit 0
    fi
    if [ "$safety_exit" -ne 0 ]; then
      echo "A verificação de desligamento falhou com código $safety_exit." >&2
      exit "$safety_exit"
    fi
    terraform destroy -input=false -auto-approve -var="environment=$ENVIRONMENT"
    finish_sleep
    ;;
  *)
    echo "ACTION precisa ser WAKE ou SLEEP." >&2
    exit 1
    ;;
esac

trap - ERR

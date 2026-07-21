data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  resource_name          = "${var.name_prefix}-${var.environment}"
  codebuild_project_name = "${local.resource_name}-auto-wake"
  session_cookie_name    = "${replace(local.resource_name, "-", "_")}_lab"
  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "auto-wake"
  })
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/auto-wake-lambda.zip"
}

data "archive_file" "orchestrator" {
  type        = "zip"
  source_dir  = "${path.module}/codebuild"
  output_path = "${path.module}/auto-wake-orchestrator.zip"
}

resource "aws_s3_object" "orchestrator" {
  bucket = var.artifact_bucket_name
  key    = "auto-wake/${local.resource_name}/orchestrator-${data.archive_file.orchestrator.output_sha256}.zip"
  source = data.archive_file.orchestrator.output_path
  etag   = filemd5(data.archive_file.orchestrator.output_path)

  tags = local.common_tags
}

resource "aws_dynamodb_table" "state" {
  name         = "${local.resource_name}-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "environment"

  attribute {
    name = "environment"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "access" {
  name                    = "${local.resource_name}/auto-wake-access"
  recovery_window_in_days = 0
  description             = "JSON com accessToken e signingKey; o valor não é gerenciado pelo Terraform."

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "router" {
  name              = "/aws/lambda/${local.resource_name}-router"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/${local.resource_name}-authorizer"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "sleep" {
  name              = "/aws/lambda/${local.resource_name}-sleep"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.resource_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/aws/codebuild/${local.codebuild_project_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.resource_name}-auto-wake-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "lambda" {
  statement {
    sid     = "WriteLogs"
    actions = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [
      "${aws_cloudwatch_log_group.router.arn}:*",
      "${aws_cloudwatch_log_group.authorizer.arn}:*",
      "${aws_cloudwatch_log_group.sleep.arn}:*",
    ]
  }

  statement {
    sid       = "ReadAndUpdateState"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.state.arn]
  }

  statement {
    sid       = "ReadAccessSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.access.arn]
  }

  statement {
    sid       = "StartOrchestrator"
    actions   = ["codebuild:StartBuild"]
    resources = ["arn:aws:codebuild:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:project/${local.codebuild_project_name}"]
  }

  statement {
    sid       = "ReadLoadBalancerMetrics"
    actions   = ["cloudwatch:GetMetricData"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "auto-wake"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_lambda_function" "router" {
  function_name    = "${local.resource_name}-router"
  role             = aws_iam_role.lambda.arn
  handler          = "router.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      ACCESS_SECRET_ARN      = aws_secretsmanager_secret.access.arn
      CODEBUILD_PROJECT_NAME = local.codebuild_project_name
      ENVIRONMENT            = var.environment
      SESSION_COOKIE_NAME    = local.session_cookie_name
      SESSION_TTL_SECONDS    = tostring(var.session_ttl_seconds)
      STATE_TABLE_NAME       = aws_dynamodb_table.state.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.router, aws_iam_role_policy.lambda]
  tags       = local.common_tags
}

resource "aws_lambda_function" "authorizer" {
  function_name    = "${local.resource_name}-authorizer"
  role             = aws_iam_role.lambda.arn
  handler          = "authorizer.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 5
  memory_size      = 128

  environment {
    variables = {
      ACCESS_SECRET_ARN   = aws_secretsmanager_secret.access.arn
      ENVIRONMENT         = var.environment
      SESSION_COOKIE_NAME = local.session_cookie_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.authorizer, aws_iam_role_policy.lambda]
  tags       = local.common_tags
}

resource "aws_lambda_function" "sleep" {
  function_name    = "${local.resource_name}-sleep"
  role             = aws_iam_role.lambda.arn
  handler          = "sleep.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      CODEBUILD_PROJECT_NAME = local.codebuild_project_name
      ENVIRONMENT            = var.environment
      IDLE_MINUTES           = tostring(var.idle_minutes)
      STATE_TABLE_NAME       = aws_dynamodb_table.state.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.sleep, aws_iam_role_policy.lambda]
  tags       = local.common_tags
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${local.resource_name}-front-door"
  protocol_type = "HTTP"
  tags          = local.common_tags
}

resource "aws_apigatewayv2_vpc_link" "this" {
  name               = "${local.resource_name}-vpc-link"
  subnet_ids         = var.vpc_link_subnet_ids
  security_group_ids = var.vpc_link_security_group_ids
  tags               = local.common_tags
}

resource "aws_apigatewayv2_integration" "router" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.router.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 15000
}

resource "aws_apigatewayv2_authorizer" "cookie" {
  api_id                            = aws_apigatewayv2_api.this.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.authorizer.invoke_arn
  identity_sources                  = ["$request.header.Cookie"]
  name                              = "signed-cookie"
  authorizer_payload_format_version = "2.0"
  authorizer_result_ttl_in_seconds  = 300
  enable_simple_responses           = true
}

resource "aws_apigatewayv2_route" "access" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "GET /access"
  target    = "integrations/${aws_apigatewayv2_integration.router.id}"
}

resource "aws_apigatewayv2_route" "session" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "POST /session"
  target    = "integrations/${aws_apigatewayv2_integration.router.id}"
}

resource "aws_apigatewayv2_route" "logout" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "POST /session/logout"
  target             = "integrations/${aws_apigatewayv2_integration.router.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.cookie.id
}

resource "aws_apigatewayv2_route" "status" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /_infra/status"
  target             = "integrations/${aws_apigatewayv2_integration.router.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.cookie.id
}

resource "aws_apigatewayv2_route" "default" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "$default"
  target             = "integrations/${aws_apigatewayv2_integration.router.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.cookie.id

  lifecycle {
    ignore_changes = [target]
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "api_router" {
  statement_id  = "AllowApiGatewayRouter"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.router.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_authorizer" {
  statement_id  = "AllowApiGatewayAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.cookie.id}"
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name               = "${local.resource_name}-auto-wake-codebuild"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "codebuild" {
  statement {
    sid       = "WriteLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.codebuild.arn}:*"]
  }

  statement {
    sid     = "ReadArtifacts"
    actions = ["s3:GetObject"]
    resources = [
      "${var.artifact_bucket_arn}/*",
      "${var.terraform_state_bucket_arn}/*",
    ]
  }

  statement {
    sid       = "DecryptS3Objects"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["s3.${data.aws_region.current.region}.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "kms:CallerAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  statement {
    sid       = "ListBuckets"
    actions   = ["s3:ListBucket"]
    resources = [var.artifact_bucket_arn, var.terraform_state_bucket_arn]
  }

  statement {
    sid       = "AssumeTerraformDeployRole"
    actions   = ["sts:AssumeRole"]
    resources = [var.terraform_deploy_role_arn]
  }

  statement {
    sid       = "OperateFrontDoor"
    actions   = ["apigateway:GET", "apigateway:PATCH"]
    resources = ["arn:aws:apigateway:${data.aws_region.current.region}::/apis/${aws_apigatewayv2_api.this.id}/routes/*"]
  }

  statement {
    sid       = "UpdateRuntimeState"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.state.arn]
  }

  statement {
    sid       = "RestartAfterSleep"
    actions   = ["codebuild:StartBuild"]
    resources = ["arn:aws:codebuild:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:project/${local.codebuild_project_name}"]
  }
}

resource "aws_iam_role_policy" "codebuild" {
  name   = "auto-wake-control"
  role   = aws_iam_role.codebuild.id
  policy = data.aws_iam_policy_document.codebuild.json
}

resource "aws_codebuild_project" "orchestrator" {
  name          = local.codebuild_project_name
  description   = "Cria e destrói o data plane do ${var.environment}."
  service_role  = aws_iam_role.codebuild.arn
  build_timeout = 60

  source {
    type      = "NO_SOURCE"
    buildspec = file("${path.module}/codebuild/buildspec.yml")
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "ACTION"
      value = "WAKE"
    }
    environment_variable {
      name  = "API_ID"
      value = aws_apigatewayv2_api.this.id
    }
    environment_variable {
      name  = "ARTIFACT_BUCKET"
      value = var.artifact_bucket_name
    }
    environment_variable {
      name  = "ARTIFACT_KEY"
      value = var.artifact_key
    }
    environment_variable {
      name  = "AUTO_WAKE_CODEBUILD_PROJECT_NAME"
      value = local.codebuild_project_name
    }
    environment_variable {
      name  = "DEFAULT_ROUTE_ID"
      value = aws_apigatewayv2_route.default.id
    }
    environment_variable {
      name  = "ENVIRONMENT"
      value = var.environment
    }
    environment_variable {
      name  = "ORCHESTRATOR_OBJECT_KEY"
      value = aws_s3_object.orchestrator.key
    }
    environment_variable {
      name  = "STATE_TABLE_NAME"
      value = aws_dynamodb_table.state.name
    }
    environment_variable {
      name  = "TF_DEPLOY_ROLE_ARN"
      value = var.terraform_deploy_role_arn
    }
    environment_variable {
      name  = "TF_ROOT"
      value = var.terraform_root
    }
    environment_variable {
      name  = "TF_STATE_BUCKET"
      value = var.terraform_state_bucket_name
    }
    environment_variable {
      name  = "TF_STATE_KEY"
      value = var.terraform_state_key
    }
    environment_variable {
      name  = "TF_VERSION"
      value = var.terraform_version
    }
    environment_variable {
      name  = "WAKE_INTEGRATION_ID"
      value = aws_apigatewayv2_integration.router.id
    }
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.codebuild.name
      stream_name = "orchestrator"
    }
  }

  depends_on = [aws_iam_role_policy.codebuild]
  tags       = local.common_tags
}

resource "aws_cloudwatch_event_rule" "sleep_check" {
  name                = "${local.resource_name}-sleep-check"
  schedule_expression = var.check_schedule_expression
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "sleep_check" {
  rule = aws_cloudwatch_event_rule.sleep_check.name
  arn  = aws_lambda_function.sleep.arn
}

resource "aws_lambda_permission" "eventbridge_sleep" {
  statement_id  = "AllowEventBridgeSleepCheck"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sleep.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.sleep_check.arn
}

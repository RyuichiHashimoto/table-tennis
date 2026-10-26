#!/usr/bin/env bash
set -euo pipefail

set -a
source ../.env
set +a

AWS_REGION="${AWS_REGION:-ap-northeast-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
AWS_PROFILE="${AWS_PROFILE:-}"

usage() {
  cat <<'USAGE'
Usage:
  AWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-northeast-1 ./scripts/ecr-login.sh

Environment variables:
  AWS_ACCOUNT_ID  Required. AWS account ID that owns the ECR registry.
  AWS_REGION      Optional. AWS region. Default: ap-northeast-1
  AWS_PROFILE     Optional. AWS CLI profile name.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$AWS_ACCOUNT_ID" ]]; then
  echo "ERROR: AWS_ACCOUNT_ID is required." >&2
  usage >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is not installed or not on PATH." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed or not on PATH." >&2
  exit 1
fi

AWS_ARGS=(--region "$AWS_REGION")
if [[ -n "$AWS_PROFILE" ]]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

aws ecr get-login-password "${AWS_ARGS[@]}" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "Logged in to $ECR_REGISTRY"

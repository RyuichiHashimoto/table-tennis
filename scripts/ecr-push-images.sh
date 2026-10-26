#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
AWS_PROFILE="${AWS_PROFILE:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CREATE_REPOSITORIES="${CREATE_REPOSITORIES:-true}"
PUSH_FRONTEND="${PUSH_FRONTEND:-true}"
PUSH_BACKEND="${PUSH_BACKEND:-true}"
FRONTEND_REPOSITORY="${FRONTEND_REPOSITORY:-table-tennis-frontend}"
BACKEND_REPOSITORY="${BACKEND_REPOSITORY:-table-tennis-backend}"

usage() {
  cat <<'USAGE'
Usage:
  AWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-northeast-1 IMAGE_TAG=v1 ./scripts/ecr-push-images.sh

Environment variables:
  AWS_ACCOUNT_ID        Required. AWS account ID that owns the ECR registry.
  AWS_REGION            Optional. AWS region. Default: ap-northeast-1
  AWS_PROFILE           Optional. AWS CLI profile name.
  IMAGE_TAG             Optional. Docker image tag. Default: latest
  CREATE_REPOSITORIES   Optional. Create ECR repositories if missing. Default: true
  PUSH_BACKEND          Optional. Push backend image. Default: true
  PUSH_FRONTEND         Optional. Push frontend image. Default: true
  BACKEND_REPOSITORY    Optional. ECR repository name. Default: table-tennis-backend
  FRONTEND_REPOSITORY   Optional. ECR repository name. Default: table-tennis-frontend

Examples:
  AWS_ACCOUNT_ID=123456789012 ./scripts/ecr-push-images.sh
  AWS_ACCOUNT_ID=123456789012 IMAGE_TAG=$(git rev-parse --short HEAD) ./scripts/ecr-push-images.sh
  AWS_ACCOUNT_ID=123456789012 PUSH_FRONTEND=false ./scripts/ecr-push-images.sh
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

create_repository_if_needed() {
  local repository="$1"

  if [[ "$CREATE_REPOSITORIES" != "true" ]]; then
    return
  fi

  if aws ecr describe-repositories "${AWS_ARGS[@]}" --repository-names "$repository" >/dev/null 2>&1; then
    return
  fi

  aws ecr create-repository "${AWS_ARGS[@]}" \
    --repository-name "$repository" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 \
    >/dev/null

  echo "Created ECR repository: $repository"
}

login_to_ecr() {
  aws ecr get-login-password "${AWS_ARGS[@]}" \
    | docker login --username AWS --password-stdin "$ECR_REGISTRY"
}

build_and_push() {
  local repository="$1"
  local context_dir="$2"
  local dockerfile="$3"
  local image_uri="${ECR_REGISTRY}/${repository}:${IMAGE_TAG}"

  create_repository_if_needed "$repository"

  echo "Building $image_uri"
  docker build -t "$image_uri" -f "$dockerfile" "$context_dir"

  echo "Pushing $image_uri"
  docker push "$image_uri"

  echo "Pushed $image_uri"
}

login_to_ecr

if [[ "$PUSH_BACKEND" == "true" ]]; then
  build_and_push "$BACKEND_REPOSITORY" "$PROJECT_ROOT/backend" "$PROJECT_ROOT/backend/Dockerfile"
fi

if [[ "$PUSH_FRONTEND" == "true" ]]; then
  build_and_push "$FRONTEND_REPOSITORY" "$PROJECT_ROOT/frontend" "$PROJECT_ROOT/frontend/Dockerfile"
fi

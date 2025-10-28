#!/bin/bash

# 서버에서 실행될 배포 스크립트
# 사용법: 서버의 프로젝트 디렉토리에 이 파일을 복사하고 실행

set -e  # 에러 발생 시 스크립트 중단

PROJECT_DIR="/path/to/your/project"  # 실제 프로젝트 경로로 변경
CONTAINER_NAME="ninedragons_web"
IMAGE_NAME="kobums/ninedragons_web:latest"

echo "🚀 Starting deployment..."

# 프로젝트 디렉토리로 이동
cd "$PROJECT_DIR"

# 최신 이미지 pull
echo "📥 Pulling latest image..."
docker pull "$IMAGE_NAME"

# 실행 중인 컨테이너 중지 및 제거
echo "🛑 Stopping and removing old container..."
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker stop "$CONTAINER_NAME" || true
    docker rm "$CONTAINER_NAME" || true
fi

# 새 컨테이너 시작
echo "▶️  Starting new container..."
docker-compose up -d

# 사용하지 않는 이미지 정리
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment completed successfully!"

# 컨테이너 상태 확인
echo "📊 Container status:"
docker ps | grep "$CONTAINER_NAME" || echo "Warning: Container not found"

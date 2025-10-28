# 자동 배포 설정 가이드

## 1. GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret

다음 4개의 시크릿을 추가하세요:

### DOCKER_USERNAME
- Docker Hub 사용자명
- 예: `kobums`

### DOCKER_PASSWORD
- Docker Hub 액세스 토큰 (비밀번호가 아닌 토큰 권장)
- Docker Hub → Account Settings → Security → New Access Token

### SERVER_HOST
- 배포할 서버의 IP 또는 도메인
- 예: `123.456.789.0` 또는 `ninedragonsapi.gowoobro.com`

### SERVER_USERNAME
- 서버 SSH 접속 사용자명
- 예: `ubuntu`, `root`, 등

### SERVER_SSH_KEY
- 서버 접속용 SSH private key
- 생성 방법:
  ```bash
  # 로컬에서 실행
  ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

  # Public key를 서버에 복사
  ssh-copy-id -i ~/.ssh/github_actions.pub user@server

  # Private key 내용을 복사 (전체 내용 복사)
  cat ~/.ssh/github_actions
  ```
- GitHub Secret에 private key 전체 내용을 붙여넣기

## 2. 서버 설정

### 2.1 프로젝트 디렉토리 설정
서버에 접속하여 프로젝트 디렉토리를 생성하고 docker-compose.yml 파일을 배치하세요.

```bash
mkdir -p /home/user/ninedragons_web
cd /home/user/ninedragons_web
```

docker-compose.yml 파일을 서버에 복사하거나 생성하세요.

### 2.2 워크플로우 파일 수정
`.github/workflows/deploy.yml` 파일에서 다음 부분을 서버의 실제 경로로 수정:

```yaml
script: |
  cd /path/to/your/project  # 예: cd /home/user/ninedragons_web
```

### 2.3 서버 요구사항
- Docker 설치
- Docker Compose 설치
- SSH 접속 가능
- GitHub Actions에서 사용할 SSH key의 public key가 `~/.ssh/authorized_keys`에 등록되어 있어야 함

## 3. 배포 프로세스

### 자동 배포
1. 코드 수정 후 main 브랜치에 push
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   ```

2. GitHub Actions가 자동으로:
   - ✅ 코드 빌드
   - ✅ Docker 이미지 생성 및 Docker Hub에 push
   - ✅ 서버에 SSH 접속
   - ✅ 최신 이미지 pull
   - ✅ 컨테이너 재시작

3. GitHub Repository → Actions 탭에서 배포 상태 확인

### 수동 배포 (서버에서 직접)
필요시 서버에서 직접 실행:

```bash
cd /home/user/ninedragons_web
docker-compose pull
docker-compose down
docker-compose up -d
docker image prune -f
```

또는 deploy.sh 스크립트 사용:
```bash
./deploy.sh
```

## 4. 트러블슈팅

### Docker Hub 로그인 실패
- DOCKER_USERNAME, DOCKER_PASSWORD 확인
- Docker Hub에서 Access Token 재생성

### SSH 접속 실패
- SERVER_HOST, SERVER_USERNAME 확인
- SERVER_SSH_KEY가 올바른 private key인지 확인
- 서버의 authorized_keys에 public key 등록 확인

### 컨테이너 시작 실패
- 서버에서 로그 확인: `docker logs ninedragons_web`
- 포트 충돌 확인: `sudo lsof -i :9003`

## 5. 브랜치 변경 (선택사항)

main 대신 다른 브랜치를 사용하려면 `.github/workflows/deploy.yml` 수정:

```yaml
on:
  push:
    branches:
      - main  # 원하는 브랜치명으로 변경 (예: develop, production)
```

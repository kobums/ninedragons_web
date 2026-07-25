# 배포 가이드

이 프론트는 **단독 이미지로 배포되지 않는다.** gowoobro 모노레포의 통합 정적 nginx
이미지(`kobums/gowoobro_static_web`)에 SPA 4개(tomelater / gym / apple / ninedragons)
중 하나로 빌드되어 들어간다. 서버에는 `web` 컨테이너 1대만 뜬다.

```
ninedragons.gowoobro.com → nginx-proxy(VIRTUAL_HOST_MULTIPORTS) → web 컨테이너 :9003 (정적)
wss://ninedragonsapi.gowoobro.com → ninedragons_back 컨테이너 :8003
```

WebSocket은 프론트가 절대 주소로 직접 붙으므로(`src/components/NineDragonsApp.tsx`)
nginx 쪽 프록시 설정이 필요 없다.

## 프론트 배포

1. 변경사항을 이 저장소 `main`에 머지한다. (자동 배포는 없다 — 아래를 직접 실행)
2. 모노레포 루트에서 통합 이미지를 빌드·푸시한다. 빌드 컨텍스트가 모노레포 루트인 점에 주의.

   ```bash
   cd ~/develop/gowoobro
   docker buildx build --platform linux/amd64 \
     -f web/Dockerfile -t kobums/gowoobro_static_web:latest --push .
   ```

3. 서버에 반영한다. **서버 docker compose는 v1이라 `docker-compose`(하이픈)** 를 쓴다.

   ```bash
   ssh root@<서버>
   cd /data
   docker-compose pull web
   docker-compose up -d web
   ```

4. 확인: `curl -s -o /dev/null -w '%{http_code}' https://ninedragons.gowoobro.com` → 200,
   그리고 `index.html`의 asset 해시가 바뀌었는지 본다.

⚠️ 통합 이미지는 tomelater / gym / apple 프론트와 **공유**한다. 재빌드하면 그 3개도
각 저장소의 커밋된 HEAD 기준으로 함께 배포되므로, 빌드 전에 세 저장소가 의도한
상태인지 확인할 것.

ℹ️ `web/Dockerfile`은 lockfile을 복사하지 않고 `npm install`을 돌린다(mac lockfile로
linux 이미지를 빌드하면 rollup 네이티브 패키지가 빠져 죽는 문제 회피). 그래서 번들
해시·크기가 로컬 `npm run build` 결과와 다를 수 있는데, 소스 차이가 아니라 의존성
재해석 결과다.

## 백엔드 배포

```bash
cd ~/develop/gowoobro/ninedragons/ninedragons_back
docker buildx build --platform linux/amd64 -t kobums/ninedragons_back:latest --push .

ssh root@<서버> 'cd /data && docker-compose pull ninedragons_back && docker-compose up -d ninedragons_back'
```

확인 — WebSocket 핸드셰이크가 101로 떨어지는지 본다. (HTTP/2로 붙으면 400이 나오므로
`--http1.1` 필수)

```bash
curl -s -i -N --http1.1 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://ninedragonsapi.gowoobro.com/ws | head -3
```

## 서버 구성

- 운영 compose: 서버의 `/data/docker-compose.yml` (로컬 사본은 `~/develop/vultr_docker`)
- HTTPS는 `nginx-proxy` + `acme-companion`이 자동 발급/갱신. 서비스에
  `VIRTUAL_HOST` / `LETSENCRYPT_HOST` 환경변수만 주면 된다.

## 레거시

- `Dockerfile`, `docker-compose.yml`(`kobums/ninedragons_web` 이미지)은 통합 nginx 이전의
  단독 실행용이다. 운영에서는 쓰지 않는다.
- GitHub Actions 자동 배포(`.github/workflows/deploy.yml`)와 `deploy.sh`는 서버 경로가
  `/path/to/your/project` 플레이스홀더인 채로 남아 동작하지 않았고, 푸시 대상 이미지도
  더는 쓰이지 않아 제거했다.

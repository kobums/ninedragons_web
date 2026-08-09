// WS 접속 주소 조립 — localhost 분기가 게임 셸 5곳에 복제돼 있던 것을 한 곳으로.
// 배포 도메인은 http(80)로 붙으면 301 리다이렉트라 WebSocket 핸드셰이크가
// 실패하므로 wss 고정이다.
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

export const buildWsUrl = (path: string): string =>
  isLocalHost
    ? `ws://localhost:8003${path}`
    : `wss://ninedragonsapi.gowoobro.com${path}`;

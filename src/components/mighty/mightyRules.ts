// 마이티 순수 규칙 헬퍼 — 렌더·입력 활성화용 클라이언트 프리뷰.
// 합법성의 최종 판정은 항상 서버가 한다.

import type { MTBid, MTBidSuit, MTCard, MTSuit } from '../../types/mighty';

export const SUIT_SYMBOL: Record<MTSuit, string> = {
  S: '♠',
  D: '♦',
  C: '♣',
  H: '♥',
};

export const BID_SUIT_LABEL: Record<MTBidSuit, string> = {
  S: '♠',
  D: '♦',
  C: '♣',
  H: '♥',
  N: '노기루',
};

export const SUIT_NAME_KO: Record<MTBidSuit, string> = {
  S: '스페이드',
  D: '다이아',
  C: '클로버',
  H: '하트',
  N: '노기루',
};

export const isRedSuit = (suit: MTSuit): boolean => suit === 'D' || suit === 'H';

export const isJoker = (card: MTCard): boolean => card === 'JK';

export const suitOf = (card: MTCard): MTSuit | null =>
  isJoker(card) ? null : (card[0] as MTSuit);

export const rankOf = (card: MTCard): number =>
  isJoker(card) ? 0 : Number(card.slice(1));

const RANK_LABELS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export const rankLabel = (rank: number): string => RANK_LABELS[rank] ?? String(rank);

// 점수 카드: 10·J·Q·K·A (조커 제외)
export const isScoreCard = (card: MTCard): boolean =>
  !isJoker(card) && rankOf(card) >= 10;

// 마이티 = S14, 기루다가 스페이드면 D14
export const mightyCard = (trump: MTBidSuit | null): MTCard =>
  trump === 'S' ? 'D14' : 'S14';

// 조커콜 카드 = C3, 기루다가 클로버면 S3
export const jokerCallCard = (trump: MTBidSuit | null): MTCard =>
  trump === 'C' ? 'S3' : 'C3';

// ---------- 입찰 ----------

export const MAX_BID_COUNT = 20;

// 최소 공약: 13 (노기루는 12부터 허용)
export const absoluteMinBid = (suit: MTBidSuit): number => (suit === 'N' ? 12 : 13);

// 해당 문양으로 낼 수 있는 최소 count. 낼 수 없으면 null.
// 직전 공약보다 높아야 함: count 큰 쪽, 같으면 노기루만 우위.
export const minBidCount = (suit: MTBidSuit, best: MTBid | null): number | null => {
  let min = absoluteMinBid(suit);
  if (best) {
    const overBest =
      suit === 'N' && best.suit !== 'N' ? best.count : best.count + 1;
    min = Math.max(min, overBest);
  }
  return min > MAX_BID_COUNT ? null : min;
};

// ---------- 플레이 프리뷰 ----------

// 지금 낼 수 있는 카드 집합 (클라 프리뷰 — 서버가 최종 판정).
// 리드 문양 팔로우 의무. 마이티·조커는 문양 무관 카드라 항상 후보에 남긴다.
// 조커콜 활성 시 조커 소지자는 조커만.
export const legalPlays = (
  hand: MTCard[],
  ledSuit: '' | MTSuit,
  jokerCallActive: boolean,
  trump: MTBidSuit | null,
): Set<MTCard> => {
  if (jokerCallActive && hand.includes('JK')) {
    return new Set(['JK']);
  }
  if (ledSuit === '') {
    return new Set(hand);
  }
  const followers = hand.filter((c) => suitOf(c) === ledSuit);
  if (followers.length === 0) {
    return new Set(hand);
  }
  const legal = new Set(followers);
  if (hand.includes('JK')) legal.add('JK');
  const mighty = mightyCard(trump);
  if (hand.includes(mighty)) legal.add(mighty);
  return legal;
};

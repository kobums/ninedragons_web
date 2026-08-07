import { useState } from 'react';
import './GameInfoButton.css';

type GameId = 'ninedragons' | 'numberchange' | 'davinci' | 'schottentotten' | 'jekyllhyde';

interface RuleSection {
  heading?: string;
  items: string[];
}

const RULES: Record<GameId, { title: string; sections: RuleSection[] }> = {
  ninedragons: {
    title: '구룡투',
    sections: [
      {
        heading: '진행',
        items: [
          '1~9 타일 아홉 장으로 아홉 라운드를 겨룹니다.',
          '매 라운드 서로 타일 한 장씩 내고, 높은 숫자가 이깁니다.',
          '단, 1은 9를 이깁니다. 같은 숫자는 무승부입니다.',
          '한 번 낸 타일은 다시 쓸 수 없고, 라운드 승자가 다음 라운드 선공입니다.',
        ],
      },
      {
        heading: '승리',
        items: ['5라운드를 먼저 이기거나, 9라운드 종료 시 더 많이 이긴 쪽이 승리합니다.'],
      },
    ],
  },
  numberchange: {
    title: '넘버체인지',
    sections: [
      {
        heading: '진행',
        items: [
          '각 팀은 1~7 블록 두 벌(14개)로 시작합니다.',
          '매 라운드 블록 두 개를 골라 동시에 제출하고, 합계가 큰 쪽이 1점을 얻습니다.',
          '라운드가 끝나면 서로 상대가 낸 블록 중 큰 것을 받아옵니다 — 블록이 계속 오갑니다.',
        ],
      },
      {
        heading: '히든 찬스 (게임당 1회)',
        items: [
          '제출할 때 히든을 쓰면 내 블록이 가려집니다.',
          '상대는 내 블록을 보지 못한 채 받아올 블록을 골라야 합니다.',
        ],
      },
      {
        heading: '승리',
        items: ['7점을 먼저 얻거나, 12라운드 종료 시 다득점 팀이 승리합니다. 동점이면 연장전입니다.'],
      },
    ],
  },
  davinci: {
    title: '다빈치 코드',
    sections: [
      {
        heading: '준비',
        items: [
          '검정·흰색 0~11 숫자 타일 24장과 조커(★) 2장을 사용합니다.',
          '2~3인은 4장, 4인은 3장을 원하는 색으로 골라 가져옵니다.',
          '타일은 왼쪽부터 오름차순으로 놓입니다(같은 숫자는 검정이 왼쪽). 조커는 원하는 위치에 놓고, 이후 옮길 수 없습니다.',
        ],
      },
      {
        heading: '내 차례',
        items: [
          '더미에서 원하는 색 타일을 한 장 뽑습니다.',
          '상대의 비공개 타일 하나를 지목해 값을 추리합니다 (조커는 ★로 추리).',
          '성공: 그 타일이 공개됩니다. 계속 추리하거나 멈출 수 있고, 멈추면 뽑은 타일은 비공개로 내 줄에 들어갑니다.',
          '실패: 뽑은 타일이 공개된 채로 내 줄에 들어갑니다.',
          '더미가 없으면 뽑기 없이 바로 추리하고, 실패하면 내 타일 하나를 골라 공개합니다.',
        ],
      },
      {
        heading: '승리',
        items: ['타일이 전부 공개된 사람은 탈락합니다. 마지막까지 비공개 타일을 지킨 사람이 승리합니다.'],
      },
    ],
  },
  schottentotten: {
    title: '쇼텐토텐',
    sections: [
      {
        heading: '진행',
        items: [
          '6색 1~9 클랜 카드 54장, 국경석 9개, 손패 6장으로 시작합니다.',
          '내 차례에 카드 한 장을 미완성 국경석 앞에 놓고, 더미에서 한 장 보충합니다.',
          '각 국경석은 양쪽이 3장씩 놓아 진형을 완성해 겨룹니다.',
        ],
      },
      {
        heading: '진형 서열 (높은 순)',
        items: [
          '컬러런(같은 색 연속 3장) > 트리플(같은 숫자 3장) > 컬러(같은 색 3장) > 런(연속 3장) > 합계.',
          '같은 진형이면 합계가 큰 쪽, 그것도 같으면 먼저 완성한 쪽이 이깁니다.',
        ],
      },
      {
        heading: '승리',
        items: ['국경석 5개를 가져오거나, 인접한 국경석 3개를 연속으로 가져오면 승리합니다.'],
      },
    ],
  },
  jekyllhyde: {
    title: '지킬 앤 하이드',
    sections: [
      {
        heading: '진행',
        items: [
          '악 3색(오만·분노·탐욕) 1~7 카드 21장 + 물약 4장(2⁺~5⁺), 총 25장으로 3라운드를 겨룹니다.',
          '라운드마다 10장을 받고, 라운드 수만큼(1/2/3장) 서로 카드를 교환한 뒤 트릭을 반복합니다.',
        ],
      },
      {
        heading: '트릭 판정',
        items: [
          '같은 색이면 높은 숫자가 이깁니다.',
          '다른 색이면 더 나중에 처음 등장한 색이 강합니다 (색 서열은 라운드 중 등장 순서로 정해집니다).',
          '물약은 같은 숫자보다 반 끗 위입니다 (2⁺는 2를 이기고 3에 집니다).',
        ],
      },
      {
        heading: '물약 효과 (트릭에 물약이 1장일 때, 함께 나온 색 발동)',
        items: [
          '오만: 트릭 승자가 패자의 트릭 하나를 빼앗습니다.',
          '분노: 색 서열이 초기화됩니다.',
          '탐욕: 서로 손에서 2장씩 골라 맞교환합니다.',
        ],
      },
      {
        heading: '승리',
        items: [
          '라운드가 끝나면 트릭 수 차이만큼 마커가 하이드 쪽으로 갑니다.',
          '마커가 하이드 홈에 도달하면 하이드 승리, 3라운드를 버티면 지킬 승리입니다.',
        ],
      },
    ],
  },
};

interface GameInfoButtonProps {
  game: GameId;
}

// 모든 게임 화면 우상단에 떠 있는 ⓘ 버튼. 누르면 룰 요약 팝업이 열린다.
export function GameInfoButton({ game }: GameInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const rules = RULES[game];

  return (
    <>
      <button
        type="button"
        className="game-info-fab"
        aria-label="게임 방법 보기"
        onClick={() => setOpen(true)}
      >
        i
      </button>

      {open && (
        <div className="game-info-overlay" onClick={() => setOpen(false)}>
          <div className="game-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="game-info-header">
              <h2>{rules.title} 게임 방법</h2>
              <button
                type="button"
                className="game-info-close"
                aria-label="닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="game-info-body">
              {rules.sections.map((section, i) => (
                <section key={i}>
                  {section.heading && <h3>{section.heading}</h3>}
                  <ul>
                    {section.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

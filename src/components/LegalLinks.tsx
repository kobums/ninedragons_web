import './LegalLinks.css';

const TERMS_URL = 'https://gowoobro.com/ko/app/2/terms';
const PRIVACY_URL = 'https://gowoobro.com/ko/app/2/privacy';

interface LegalLinksProps {
  // 어두운 배경(전적 페이지) 위에 놓일 때
  onDark?: boolean;
}

// 이용약관·개인정보 처리방침 링크 — 화면 하단에 작게 둔다.
export function LegalLinks({ onDark }: LegalLinksProps) {
  return (
    <nav className={`legal-links ${onDark ? 'on-dark' : ''}`}>
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
        이용약관
      </a>
      <span aria-hidden="true">·</span>
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
        개인정보 처리방침
      </a>
    </nav>
  );
}

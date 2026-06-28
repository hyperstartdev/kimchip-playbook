# KIMCHIP Playbook — 배포 & 연동 가이드

Vercel 정적 호스팅 + 서버리스 함수로 Meta / Amazon 광고 실시간 연동.
자격증명이 없으면 자동으로 데모 데이터를 표시하고, Vercel 환경변수를 채우면
배포 사이트가 자동으로 실데이터로 전환됩니다.

## 1. 폴더 구조 (배포 시 이렇게 배치)

```
kimchip-playbook/
├── index.html        ← kimchip-playbook.html 을 index.html 로 이름 변경
├── vercel.json
├── package.json
└── api/
    ├── meta.js       ← 제공된 meta.js
    └── amazon.js     ← 제공된 amazon.js
```

> 중요: `meta.js` 와 `amazon.js` 는 반드시 **api/** 폴더 안**에 두어야 합니다.
> 그래야 `/api/meta`, `/api/amazon` 주소로 호출됩니다.

## 2. 배포 (GitHub → Vercel, 권장)

1. GitHub에 새 저장소 생성 후 위 구조 그대로 업로드
2. vercel.com → Add New → Project → 해당 저장소 Import
3. Framework Preset: **Other** (빌드 설정 불필요), Deploy 클릭
4. 1~2분 후 `https://<프로젝트>.vercel.app` 라이브

## 3. 환경변수 설정 (Vercel > Settings > Environment Variables)

### Meta (페이스북/인스타) — 빠름, 오늘 가능
| 변수 | 설명 |
|---|---|
| `META_ACCESS_TOKEN` | 비즈니스 관리자 → 시스템 사용자 → 토큰 생성(권한 `ads_read`) |
| `META_AD_ACCOUNT_ID` | 광고계정 ID, 숫자만 (`act_` 제외) |
| `META_API_VERSION` | (선택) 기본 `v21.0` |

발급 경로: business.facebook.com → 비즈니스 설정 → 사용자 → 시스템 사용자
→ 토큰 생성 → 앱 선택 → `ads_read` 권한 → 토큰 복사.

### Amazon Ads — API 접근 승인 후 가능 (수일~수주)
| 변수 | 설명 |
|---|---|
| `AMZN_CLIENT_ID` | Login with Amazon 앱 client id |
| `AMZN_CLIENT_SECRET` | LWA client secret |
| `AMZN_REFRESH_TOKEN` | OAuth 동의 후 refresh token |
| `AMZN_PROFILE_ID` | 광고 프로파일 ID |
| `AMZN_REGION` | `na`(미국) / `eu` / `fe` |

선행 절차: advertising.amazon.com/API/docs 에서 Ads API 접근 신청 → 승인 →
LWA 앱 생성 → OAuth 동의로 refresh token 발급 → 프로파일 ID 조회.

> 환경변수 저장 후 **Redeploy** 해야 반영됩니다.

## 4. 동작 방식
- 페이지 헤더 배지: `● 실시간 연동`(실데이터) / `데모 데이터`(자격증명 없음/오류)
- Meta: Marketing API insights (매출·지출·ROAS·캠페인) 실시간
- Amazon: LWA 토큰 교환 + 캠페인 연결 확인. 매출/ACOS 등 성과 지표는
  Amazon Reporting API(비동기)가 추가로 필요 — 2차 작업에서 연동.

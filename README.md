# FoodPicker 관리자 웹 (foodpicker_adm)

소비기한 임박 상품을 할인 판매하는 **FoodPicker** 서비스의 운영자용 관리자 대시보드입니다.
판매자 승인/정지, 상품·주문·정산 관리, 리뷰/신고 처리, 배너·공지·쿠폰 운영 등 운영팀이 서비스를 관리하는 데 필요한 화면을 제공합니다.

> ⚠️ **현재 상태: 프론트엔드 프로토타입입니다.** 모든 데이터는 `src/data/mockData.ts`의 목데이터이며,
> 실제 백엔드(Supabase)와 아직 연동되어 있지 않습니다. 로그인 화면도 없습니다(의도적으로 구현 제외됨).
> 백엔드 연동 시 참고할 내용은 아래 [백엔드 연동 가이드](#백엔드-연동-가이드) 섹션을 확인하세요.

## 관련 프로젝트

FoodPicker는 3개의 앱으로 구성됩니다.

| 프로젝트 | 역할 | 상태 |
|---|---|---|
| `foodpicker_app` | 사용자(구매자)용 앱 (React Native/Expo) | 목데이터 기반 프로토타입 |
| `FoodPicker_seller_app` | 판매자용 앱 (React Native/Expo) | **Supabase 연동 완료** — 실제 DB 스키마의 기준(source of truth) |
| `foodpicker_adm` (본 저장소) | 관리자 웹 (React + Vite) | 목데이터 기반 프로토타입 |

관리자 웹의 데이터 모델(`src/types/index.ts`)은 실제로 Supabase에 연동되어 있는 **판매자 앱의 DB 스키마**
(`FoodPicker_seller_app/supabase/migrations/`)를 기준으로 필드명·상태값을 맞춰뒀습니다.

## 기술 스택

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** — 스타일링
- **react-router-dom** — 라우팅
- **recharts** — 대시보드/통계 차트
- **lucide-react** — 아이콘
- **xlsx** — 목록 화면의 엑셀 다운로드 기능

## 시작하기

```bash
npm install
npm run dev       # 개발 서버 실행 (기본 http://localhost:5173)
npm run build     # 타입체크 + 프로덕션 빌드
npm run lint      # ESLint 검사
npm run preview   # 빌드 결과 로컬 미리보기
```

## 폴더 구조

```
src/
├── components/
│   ├── layout/        # Sidebar, Header, Layout (반응형 레이아웃)
│   └── ui/             # Badge, Modal, Pagination, Toast 등 공통 UI
├── context/
│   └── AdminContext.tsx  # 현재 관리자 정보(하드코딩), 엑셀 다운로드 로그
├── data/
│   └── mockData.ts     # 전체 목데이터 (실 연동 시 API 호출로 교체 대상)
├── hooks/
│   └── useExcelDownload.ts
├── pages/               # 라우트별 화면 (아래 "화면 목록" 참고)
└── types/
    └── index.ts         # 전체 도메인 타입 정의 (Supabase 스키마와의 매핑 주석 포함)
```

## 화면 목록

| 경로 | 화면 | 실 DB 테이블 대응 |
|---|---|---|
| `/` | 대시보드 | 집계 API 필요 (하드코딩된 통계) |
| `/sellers` | 판매자 관리 | ✅ `stores` |
| `/products` | 상품 관리 | ✅ `products` |
| `/orders` | 주문 관리 | ✅ `orders` |
| `/settlements` | 정산 관리 | ✅ `settlements` |
| `/reviews` | 리뷰 관리 | ✅ `reviews` (모더레이션 상태 컬럼은 추가 필요) |
| `/reports` | 신고/문의 관리 | ❌ 신규 테이블 설계 필요 |
| `/banners` | 배너/공지 관리 | 공지는 ✅ `notices`(컬럼 확장 필요) / 배너는 ❌ 신규 필요 |
| `/categories` | 카테고리 관리 | ❌ 신규 필요 (현재 `products.category`는 자유 텍스트) |
| `/coupons` | 쿠폰/프로모션 | ❌ 신규 필요 |
| `/env-stats` | 환경 통계 | ❌ 집계 파이프라인 신규 필요 |
| `/admins` | 관리자 계정 | ❌ 인증/권한 모델 자체가 없음 |
| `/settings` | 운영 정책 설정 | ❌ 설정 저장용 테이블 필요 |

각 페이지 파일 상단에는 `[백엔드 연동 안내]` 주석으로 필요한 API 엔드포인트 예시와 DB 스키마 제안을 남겨뒀습니다.

## 백엔드 연동 가이드

1. **Supabase 클라이언트 추가**: 현재 `@supabase/supabase-js`가 설치되어 있지 않습니다.
   `FoodPicker_seller_app/src/lib/supabase.js` 패턴을 참고해 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   환경변수 기반 클라이언트를 추가하세요. **service role 키는 절대 클라이언트 번들에 포함하지 마세요.**
2. **camelCase ↔ snake_case 매핑**: 판매자 앱의 `src/lib/api.js`가 DB(snake_case) ↔ 앱(camelCase) 매핑 계층입니다.
   관리자 웹도 동일한 매핑 함수를 재사용/이식하는 것을 권장합니다.
3. **`src/data/mockData.ts` 교체**: 각 `mockXxx` 배열을 실제 `fetch/GET` 호출로 교체하면 됩니다. 타입(`src/types/index.ts`)은
   이미 실 스키마 기준으로 맞춰져 있어 큰 변경 없이 연결 가능합니다.
4. **신규 테이블이 필요한 화면**: 신고/문의, 배너, 카테고리, 쿠폰, 관리자 계정/권한, 운영 설정 — 위 표에서 ❌로 표시된 항목은
   실 서비스에 대응 테이블이 없으므로 백엔드에서 스키마 설계가 선행되어야 합니다(각 페이지 상단 주석에 제안 스키마 기재).
5. **인증/로그인**: 이 저장소에는 로그인 화면이 없고 `AdminContext.tsx`에 "최고관리자"가 하드코딩되어 있습니다.
   실 서비스 적용 전 반드시 Supabase Auth(또는 별도 관리자 인증) 연동과 서버 측 권한 검증이 필요합니다.
6. **민감정보 처리**: 판매자 주민번호(`residentNumberMasked`)는 반드시 마스킹된 값만 클라이언트에 내려주세요.
   실 DB 마이그레이션 주석에도 "민감정보, 실서비스 암호화 권장"이라고 명시되어 있습니다.

## 알려진 제약사항

- 인증/로그인 없음 (의도적 제외)
- 목데이터 기반이라 새로고침 시 변경사항이 초기화됨
- 신고/배너/카테고리/쿠폰/관리자계정/설정 화면은 실 DB 테이블이 없어 백엔드 설계 선행 필요

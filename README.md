# FoodPicker 관리자 웹 (foodpicker_admin)

소비기한 임박 상품을 할인 판매하는 **FoodPicker** 서비스의 운영자용 관리자 콘솔입니다.
판매자 승인/정지, 상품·주문·정산 관리, 리뷰/신고 처리, 배너·공지·카테고리·쿠폰 운영, 환경 통계, 관리자 계정/설정까지 13개 메뉴를 제공합니다.

> ✅ **Supabase 실데이터 연동 완료** (2026-07). 별도 백엔드 서버 없이 `@supabase/supabase-js`(anon key)로
> 판매자 앱·소비자 앱과 **동일한 Supabase 프로젝트**에 직접 접속하며, 관리자 판별·격리는 전부 서버(RLS/RPC)가 강제합니다.
> **service_role 키는 사용하지 않습니다** — 브라우저 번들에 절대 포함 금지.

## 관련 프로젝트

| 프로젝트 | 역할 | 상태 |
|---|---|---|
| `FoodPicker_customer_app` | 사용자(구매자)용 앱 (React Native/Expo) | ✅ Supabase 연동 |
| `FoodPicker_seller_app` | 판매자용 앱 (React Native/Expo) | ✅ Supabase 연동 — **마이그레이션 원본 보관** |
| `foodpicker_admin` (본 저장소) | 관리자 웹 (React + Vite) | ✅ Supabase 연동 |

플랫폼 공용 계약 문서: `../docs/DB_SCHEMA.md`(테이블/RLS), `../docs/API_SPEC.md`(클라이언트 접근 계약).

## 기술 스택

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** · **react-router-dom** · **recharts** · **lucide-react** · **xlsx**
- **@supabase/supabase-js** — Auth(이메일 로그인) + PostgREST + Storage

## 시작하기

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 채우기
npm run dev            # 개발 서버 (기본 http://localhost:5173)
npm run build          # 타입체크 + 프로덕션 빌드
```

### 백엔드 준비 (Supabase SQL Editor, 순서대로 1회)

1. `FoodPicker_seller_app/supabase/migrations/20260715000000_coupon_checkout.sql` (미적용 시)
2. `FoodPicker_seller_app/supabase/migrations/20260716000000_admin.sql` ← **관리자 웹 백엔드 전체**
3. 최초 관리자 등록: `FoodPicker_seller_app/supabase/provision_admin.sql` (파일 안 이메일 수정 후 실행)
4. (선택) 샘플 신고/배너 시드: `FoodPicker_seller_app/supabase/seed_admin_dev.sql`

### 관리자 계정 흐름

- 관리자 후보는 로그인 화면의 **'계정 만들기'** 로 가입(이메일 인증 필요) → `admin_profiles` 에 등록되기 전까지는 "권한 없음" 화면에서 차단됩니다.
- 최초 1명은 `provision_admin.sql` 로 super 부여, 이후에는 최고관리자가 **관리자 계정 메뉴**에서 이메일로 등록(`admin_add_account` RPC).
- 역할 5종: 최고관리자(super) / 운영관리자(ops) / 정산관리자(settlement) / CS관리자(cs) / 읽기전용(viewer — 엑셀 다운로드 불가). 역할은 표시/다운로드 게이트 용도이며, 최종 강제는 서버 RLS/RPC.

## Vercel 배포

GitHub 연동(권장): Vercel 대시보드 → **Add New Project** → 이 저장소 import → 환경변수 등록 → Deploy.

CLI 사용 시:

```bash
npm i -g vercel
vercel        # 최초 연결 (프레임워크 Vite 자동 인식)
vercel --prod
```

- **환경변수** (Project Settings → Environment Variables, Production/Preview 모두):
  - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = anon public key
- SPA 라우팅 rewrite 는 `vercel.json` 에 포함(BrowserRouter 새로고침 404 방지).
- 배포 후 Supabase → Authentication → URL Configuration 의 Redirect URLs 에 배포 도메인 추가 권장.

## 폴더 구조

```
src/
├── lib/
│   ├── supabase.ts    # Supabase 클라이언트 (.env 기반)
│   ├── labels.ts      # DB enum(영문 키) ↔ 한글 라벨 맵 + 날짜/지역/마스킹 헬퍼
│   └── api.ts         # 데이터 계층: row 매퍼 + 조회(admin_* 뷰) + 변경(admin_* RPC/직접 CRUD)
├── context/
│   └── AdminContext.tsx  # 인증 게이트(로그인→권한확인→콘솔) + 다운로드/감사 로그
├── components/        # layout(Sidebar/Header) + 공통 UI(Badge/Modal/…)
├── pages/             # Login + 13개 관리 메뉴 (전부 실데이터)
└── types/index.ts     # 도메인 타입 (화면은 한글 라벨, 변환은 lib/labels.ts)
```

## 데이터 접근 규약

| 작업 | 경로 |
|---|---|
| 전체 목록 조회 | `admin_stores`·`admin_products`·`admin_reviews`·`admin_settlements`·`admin_coupons` 뷰(조인·집계 포함, `is_admin()` 게이트) 또는 admin RLS 정책이 걸린 원본 테이블(orders/reports 등) |
| 집계 대시보드 | `admin_dashboard_stats()` / `admin_env_stats()` RPC 1회 호출 |
| 승인·정지·환불·모더레이션·정산확정 등 | `admin_set_store_approval`, `admin_set_store_suspension`, `admin_set_product_status`, `admin_set_order_status`, `admin_refund_order`, `admin_moderate_review`, `admin_set_settlement_status`, `admin_report_refund` … — security definer RPC 가 판매자/구매자 알림 발송과 감사 로그(`admin_action_logs`)까지 처리 |
| 관리자 전용 엔티티 | banners / categories / notices / coupons / reports / platform_settings 직접 CRUD (RLS 가 관리자만 허용) + 클라이언트 `logAction()` |
| 관리자 계정 | `admin_add_account` / `admin_update_account` / `touch_admin_login` RPC (super 전용 검증 서버측) |

## 보안 메모

- 관리자 판별은 JWT 클레임이 아니라 **`admin_profiles` 테이블**(`is_admin()` security definer) — 비활성화 즉시 효력.
- 판매자 주민번호는 화면에서 마스킹(`residentNumberMasked`)만 노출. 계좌/서류 등 민감정보 접근은 전부 감사 로그 대상 화면에서만.
- 클라이언트 role 은 표시·다운로드 버튼 게이트 용도일 뿐, 모든 쓰기는 서버 RLS/RPC 가 재검증.

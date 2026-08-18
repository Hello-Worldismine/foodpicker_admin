# FoodPicker 관리자 웹 (foodpicker_admin)

소비기한 임박 상품을 할인 판매하는 **FoodPicker** 서비스의 운영자용 관리자 콘솔입니다.
판매자 승인/정지, 상품·주문·정산 관리, 리뷰/신고 처리, 배너·공지·카테고리·쿠폰·FAQ 운영, 환경 통계, 관리자 계정/설정까지 14개 메뉴를 제공합니다.

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
5. `FoodPicker_seller_app/supabase/migrations/20260722000000_faqs.sql`
   (`faqs` 테이블 신설 + RLS + 기존 FAQ 10건 시드. 실행 전까지 **FAQ 관리 메뉴는 조회 실패 화면만 표시**됩니다.
   자세한 내용은 [FAQ 관리 섹션](#faq-관리) 참고.)
6. `FoodPicker_seller_app/supabase/migrations/20260722010000_category_icons_coupon_offer.sql`
   (카테고리 아이콘 이미지 컬럼 + `category-icons` 버킷, 쿠폰 **매장 지정 발급** 플로우 — 판매자 알림 트리거 + `respond_coupon_offer` RPC.
   실행 전까지 카테고리 아이콘 업로드·매장 지정 쿠폰 발급은 저장 시 오류가 납니다.)
7. `FoodPicker_seller_app/supabase/migrations/20260818000000_settlement_completion.sql`
   (**정산 관리 백엔드 보완** — 정산예정일 지정·판매자 정산 알림·메모 전용 RPC·기간 지정 정산 생성·
   정산 주기 설정 반영·매장별 수수료율 변경 RPC. 자세한 내용은 [정산 관리 섹션](#정산-관리) 참고.
   실행 전까지 정산예정일 지정/정산 생성/수수료율 변경은 오류가 나고, 정산 확정·보류는
   구 시그니처로 자동 폴백되어 동작하되 판매자 알림이 발송되지 않습니다.)

### 관리자 계정 흐름

- 관리자 후보는 로그인 화면의 **'계정 만들기'** 로 가입(이메일 인증 필요) → `admin_profiles` 에 등록되기 전까지는 "권한 없음" 화면에서 차단됩니다.
- 최초 1명은 `provision_admin.sql` 로 super 부여, 이후에는 최고관리자가 **관리자 계정 메뉴**에서 이메일로 등록(`admin_add_account` RPC).
- 역할 5종: 최고관리자(super) / 운영관리자(ops) / 정산관리자(settlement) / CS관리자(cs) / 읽기전용(viewer — 엑셀 다운로드 불가). 역할은 표시/다운로드 게이트 용도이며, 최종 강제는 서버 RLS/RPC.

## FAQ 관리

`/faqs` 메뉴는 프론트엔드·백엔드 마이그레이션까지 준비 완료 — **`20260722000000_faqs.sql`을 Supabase SQL Editor에서 1회 실행**해야 실제 동작합니다(위 백엔드 준비 5번).

- `faqs` 테이블(`category`, `question`, `answer`, `display_order`, `is_active`) + RLS(관리자 쓰기 전용, `is_active=true` 행은 공개 읽기) 생성.
- 소비자 앱에 하드코딩돼 있던 기존 FAQ 10건을 최초 데이터로 함께 넣어줍니다(멱등 — 이미 데이터가 있으면 건너뜀).
- `category`는 영문 키(`order_payment`/`pickup`/`product_store`/`account`) 4종만 허용하는 CHECK 제약이 걸려 있고, 화면 쪽 한글 라벨 매핑은 `src/lib/labels.ts`의 `FAQ_CATEGORY_KO`/`FAQ_CATEGORY_EN`이 담당합니다.
- **소비자 앱 연동(별도 작업)**: `FoodPicker_customer_app/src/screens/FAQScreen.js`가 아직 FAQ 를 하드코딩(`FAQS` 상수)해서 보여주고 있어, 관리자 웹에서 등록/수정해도 앱 화면엔 반영되지 않습니다. 연동하려면 그 화면을 `faqs` 테이블(`is_active=true`, `category`/`display_order` 순 정렬) 조회로 바꿔야 합니다(공개 읽기 RLS 준비됨).

관련 코드: `src/pages/FaqManagement.tsx`(화면), `src/lib/api.ts`의 `fetchFaqs`/`createFaq`/`updateFaq`/`toggleFaqActive`/`deleteFaq`(데이터 계층), `src/types/index.ts`의 `Faq`/`FaqCategory`(타입).

## 정산 관리

`/settlements` 메뉴는 `settlements`(주문 단위 행)를 **판매자 × 정산기간** 그룹으로 집계해 보여주고,
그룹 단위로 확정/보류/해제를 처리합니다. 백엔드는 `20260818000000_settlement_completion.sql`(백엔드 준비 7번)이 담당합니다.

| 기능 | 경로 |
|---|---|
| 목록·상세(주문별 내역 포함) | `admin_settlements` 뷰 → `api.fetchSettlements()` 가 그룹 집계 + `orders[]` 로 원본 행 보존 |
| 확정 / 보류 / 보류해제 (단건·일괄) | `admin_set_settlement_status(ids[], status, memo, settled_on)` — 감사 로그 + **판매자 알림**(`notifications.type='settlement'`) |
| 관리자 메모 편집 | `admin_set_settlement_memo(ids[], memo)` — 상태 변경/알림 없이 메모만 갱신 |
| 정산 생성(기간 지정) | `admin_generate_settlements(start, end, pay?)` — 이미 정산된 주문은 제외(멱등) |
| 정기 배치 | `generate_weekly_settlements()` + cron `foodpicker-weekly-settlements`(매주 수 00:00 UTC). 실제 마감 기간은 `platform_settings.settlement_cycle`(주간/격주/월간)이 결정 |
| 매장별 수수료율 변경 | `admin_set_store_commission(store_id, rate)` — 판매자 관리 상세 패널의 [수수료율 → 변경] |

- **정산 조정액**: 상세의 금액식은 `총 판매금액 − 플랫폼수수료 − PG수수료 − 환불금액 + 조정액 = 최종 정산금액` 입니다.
  조정액은 **본사 쿠폰 보전분**(`cost_bearer='platform'/'shared'` 쿠폰의 플랫폼 부담분)과 환불 회계(`admin_refund_order` 는
  순매출을 차감) 잔차를 합친 파생값이라, 어떤 데이터에서도 합계가 맞아떨어집니다.
  `쿠폰 판매자 부담액`(`settlements.coupon_burden`)은 정산금액에서 이미 빠진 몫이라 참고 표시입니다.
- **정산예정일(실지급일)** 은 확정 모달에서 지정합니다. 지정한 날짜가 판매자 알림 문구에 함께 나갑니다.
- **관리자 메모는 판매자에게 보입니다** (`settlements.admin_memo` 는 보류 사유 통지 겸용 — 판매자 앱 정산 화면 노출).
- **수수료율 변경은 소급되지 않습니다.** 주문 생성 시점의 `stores.commission_rate` 로 `orders.fee` 가 확정되고,
  정산은 그 값을 그대로 집계합니다. 설정 화면의 '수수료율' 은 `platform_settings.default_commission_rate` 로,
  20260818 이후 **신규 매장의 기본 수수료율**(`stores.commission_rate` DEFAULT)로 실제 적용됩니다.

## 쿠폰 매장 지정 발급 (2026-07-22)

- 쿠폰 생성 모달에서 **전체 발급 / 매장 지정 발급**을 선택. 매장 지정 시 매장 검색 → 선택 → 발급하면
  `coupons` 에 `seller_id` + `request_status='pending'` + `is_active=false` 로 생성됩니다(판매자 수락 대기).
- DB 트리거(`notify_coupon_offer`)가 판매자에게 `coupon_assigned` 알림을 발송하고, 판매자가
  `respond_coupon_offer` RPC 로 수락하면 `approved`·활성화되어 `store_coupons` 게이트를 통과 —
  사용자 앱 상점 상세의 쿠폰 다운로드 UI 에 노출됩니다. (판매자 앱 수락/거절 화면은 별도 작업.)
- 백엔드: `20260722010000_category_icons_coupon_offer.sql` (백엔드 준비 6번).

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
├── pages/             # Login + 14개 관리 메뉴 (전부 실데이터 — FAQ는 "FAQ 관리" 섹션의 마이그레이션 선행 필요)
└── types/index.ts     # 도메인 타입 (화면은 한글 라벨, 변환은 lib/labels.ts)
```

## 데이터 접근 규약

| 작업 | 경로 |
|---|---|
| 전체 목록 조회 | `admin_stores`·`admin_products`·`admin_reviews`·`admin_settlements`·`admin_coupons` 뷰(조인·집계 포함, `is_admin()` 게이트) 또는 admin RLS 정책이 걸린 원본 테이블(orders/reports 등) |
| 집계 대시보드 | `admin_dashboard_stats()` / `admin_env_stats()` RPC 1회 호출 |
| 승인·정지·환불·모더레이션·정산확정 등 | `admin_set_store_approval`, `admin_set_store_suspension`, `admin_set_product_status`, `admin_set_order_status`, `admin_refund_order`, `admin_moderate_review`, `admin_set_settlement_status`, `admin_report_refund` … — security definer RPC 가 판매자/구매자 알림 발송과 감사 로그(`admin_action_logs`)까지 처리 |
| 관리자 전용 엔티티 | banners / categories / notices / coupons / reports / platform_settings / faqs 직접 CRUD (RLS 가 관리자만 허용) + 클라이언트 `logAction()` |
| 관리자 계정 | `admin_add_account` / `admin_update_account` / `touch_admin_login` RPC (super 전용 검증 서버측) |

## 보안 메모

- 관리자 판별은 JWT 클레임이 아니라 **`admin_profiles` 테이블**(`is_admin()` security definer) — 비활성화 즉시 효력.
- 판매자 주민번호는 화면에서 마스킹(`residentNumberMasked`)만 노출. 계좌/서류 등 민감정보 접근은 전부 감사 로그 대상 화면에서만.
- 클라이언트 role 은 표시·다운로드 버튼 게이트 용도일 뿐, 모든 쓰기는 서버 RLS/RPC 가 재검증.

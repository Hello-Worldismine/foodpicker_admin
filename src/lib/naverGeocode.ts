// 주소 → 좌표(위경도) 변환기 — 관리자웹(브라우저) 전용.
//
// [배경] 판매자앱은 Daum 우편번호로 "주소 문자열"만 받아 stores.address 에 저장해왔고
//        stores.lat/lng 는 채우지 못했다(지오코딩 도입분이 아직 앱에 배포되지 않음).
//        그 결과 사용자앱 지도에 매장 핀이 뜨지 않는다.
//        관리자웹은 브라우저라 네이버 지도 JS SDK 의 geocoder 서브모듈을 그대로 쓸 수 있으므로,
//        판매자앱 재빌드를 기다리지 않고 운영자가 좌표를 채울 수 있게 한다.
//
// [원본] 판매자앱 src/components/NaverGeocoder.jsx (WebView 판)을 브라우저용으로 이식했다.
//        REST 지오코딩(NCP)과 달리 시크릿 키가 필요 없고 도메인 제한 방식이라
//        VITE_NAVER_MAP_CLIENT_ID(공개 키)만 있으면 된다.
//
// [주의] 네이버 응답의 x = 경도(lng), y = 위도(lat) 다. 절대 뒤바꾸지 말 것.
//        (서버 RPC admin_set_store_coords 가 대한민국 영역 검증으로 swap 을 한 번 더 막는다.)
/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    naver?: any;
    // SDK 가 인증 실패 시 호출하는 전역 훅. 등록하지 않으면 아무 신호 없이 무한 대기한다.
    navermap_authFailure?: () => void;
  }
}

// 네이버 지도 클라이언트 키(ncpKeyId)는 **공개 값**이다. 앱 번들·웹 페이지에 그대로 박히고,
// 보안은 키 비밀유지가 아니라 NCP 콘솔의 'Web 서비스 URL' 도메인 제한으로 이뤄진다.
// 그래서 기본값을 코드에 두는 것이 안전하며, 사용자앱도 같은 방식으로 폴백을 두고 있다.
//
// 폴백을 두는 이유: .env 는 .gitignore 대상이라 저장소를 clone 한 사람에게 전달되지 않는다.
// 폴백이 없으면 새로 받은 개발자마다 판매자관리 화면에서
// '지도 기능 사용 불가: 지도 키 미설정' 붉은 배너를 보게 된다(수정사항 시트 관리자페이지 8행).
// .env 에 값이 있으면 그쪽이 우선하므로 키를 교체할 때는 .env 만 바꾸면 된다.
const DEFAULT_CLIENT_ID = '1wza2xsjez';
const CLIENT_ID = (import.meta.env.VITE_NAVER_MAP_CLIENT_ID ?? '').trim() || DEFAULT_CLIENT_ID;
const SCRIPT_ID = 'fp-naver-maps-sdk';
/** SDK 로드 타임아웃 — 스크립트가 내려오지 않거나 인증 응답이 오지 않는 상황을 잘라낸다. */
const LOAD_TIMEOUT_MS = 8000;
/** 개별 지오코딩 타임아웃 — 콜백이 오지 않아도 이 시간이 지나면 '실패(null)' 로 넘긴다. */
const GEOCODE_TIMEOUT_MS = 8000;
/** 일괄 보정용 스로틀 간격 — 연속 호출 사이 최소 대기(ms). */
const THROTTLE_MS = 300;

/** 개별 주소 문제가 아니라 지도 SDK 자체가 못 쓰는 상태(= 다음 건도 똑같이 실패)임을 나타내는 코드. */
const FATAL_CODES = ['NO_KEY', 'AUTH_FAILED', 'LOAD_FAILED'] as const;

export interface Coords {
  lat: number;
  lng: number;
}

/** code 가 붙은 Error — 호출부가 isMapFatalError() 로 '전체 중단' 여부를 판단한다. */
type MapError = Error & { code?: string };

function mapError(code: string, message: string): MapError {
  const err = new Error(message) as MapError;
  err.code = code;
  return err;
}

/** 지도 SDK 자체가 사용 불가한 오류인가(= 일괄 보정을 계속해도 전부 같은 이유로 실패한다). */
export function isMapFatalError(e: unknown): boolean {
  const code = (e as MapError | null)?.code;
  return !!code && (FATAL_CODES as readonly string[]).includes(code);
}

/** .env 에 VITE_NAVER_MAP_CLIENT_ID 가 설정돼 있는가(버튼 비활성화 사유 표시용). */
export function isMapKeyConfigured(): boolean {
  return CLIENT_ID !== '';
}

// ── SDK 로더 ───────────────────────────────────────────────────────────────

let loadPromise: Promise<void> | null = null;
/** 로드 이후에 뒤늦게 도착한 인증 실패 등, 이후 모든 호출을 즉시 실패시킬 사유. */
let fatalError: MapError | null = null;
/** 진행 중인 지오코딩의 reject 핸들러 — 인증 실패 시 타임아웃을 기다리지 않고 즉시 끊는다. */
const pendingRejects = new Set<(err: MapError) => void>();

function failAllPending(err: MapError): void {
  const list = Array.from(pendingRejects);
  pendingRejects.clear();
  list.forEach(reject => reject(err));
}

/**
 * 네이버 지도 SDK(geocoder 서브모듈 포함)를 head 에 1회만 주입하고 로드 완료를 Promise 로 돌려준다.
 * 실패(키 미설정·인증 실패·로드 실패·타임아웃)는 resolve 가 아니라 reject 다 — 조용한 무한 대기를 만들지 않는다.
 * 결과 Promise 는 캐시된다(실패도 캐시 — 같은 이유로 수십 번 재시도하지 않게).
 */
export function loadNaverMaps(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(mapError('NO_KEY', '네이버 지도 키가 설정되지 않았습니다. (.env 의 VITE_NAVER_MAP_CLIENT_ID)'));
      return;
    }
    if (window.naver?.maps?.Service) { resolve(); return; }

    let settled = false;
    const finish = (err: MapError | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (err) { fatalError = err; reject(err); } else { resolve(); }
    };

    const timer = window.setTimeout(
      () => finish(mapError('LOAD_FAILED', '네이버 지도 SDK 로드가 시간 내에 끝나지 않았습니다. (네트워크 확인)')),
      LOAD_TIMEOUT_MS,
    );

    // 인증 실패 훅은 스크립트 주입 '전에' 등록해야 한다(SDK 가 실행 직후 호출할 수 있다).
    // 로드 완료 뒤에 도착하는 경우도 있어, 여기서 fatalError 를 남기고 진행 중 요청까지 끊는다.
    window.navermap_authFailure = () => {
      const err = mapError(
        'AUTH_FAILED',
        `네이버 지도 인증에 실패했습니다. (키: ${CLIENT_ID}) NCP 콘솔 > Maps > Web 서비스 URL 에 `
        + `현재 접속 오리진(${window.location.origin})을 등록했는지 확인하세요.`,
      );
      fatalError = err;
      failAllPending(err);
      finish(err);
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = 'https://openapi.map.naver.com/openapi/v3/maps.js'
        + `?ncpKeyId=${encodeURIComponent(CLIENT_ID)}&submodules=geocoder`;
    }
    script.addEventListener('load', () => {
      // 스크립트는 어떤 키를 줘도 200 으로 내려온다 — geocoder 서브모듈 존재까지 확인해야 한다.
      if (window.naver?.maps?.Service) finish(null);
      else finish(mapError('LOAD_FAILED', '네이버 지도 geocoder 서브모듈을 불러오지 못했습니다.'));
    });
    script.addEventListener('error', () => {
      finish(mapError('LOAD_FAILED', '네이버 지도 SDK 스크립트를 불러오지 못했습니다.'));
    });
    if (!existing) document.head.appendChild(script);
  });

  return loadPromise;
}

// ── 스로틀 ────────────────────────────────────────────────────────────────

let nextAllowedAt = 0;

/** 직전 호출로부터 THROTTLE_MS 가 지날 때까지 대기(일괄 보정 시 연속 호출 완화). */
function throttle(): Promise<void> {
  const now = Date.now();
  const startAt = Math.max(now, nextAllowedAt);
  nextAllowedAt = startAt + THROTTLE_MS;
  const wait = startAt - now;
  return wait > 0 ? new Promise(resolve => window.setTimeout(resolve, wait)) : Promise.resolve();
}

// ── 지오코딩 ──────────────────────────────────────────────────────────────

/**
 * 주소 문자열 → { lat, lng }.
 *  - 검색 결과가 없거나(status !== OK / addresses 비어 있음) 응답이 이상하면 null (그 주소만 실패).
 *  - 키 미설정·인증 실패·SDK 로드 실패는 throw (isMapFatalError() 로 구분해 일괄 보정을 중단시킨다).
 */
export async function geocode(address: string): Promise<Coords | null> {
  const query = (address ?? '').trim();
  if (!query) return null;

  await loadNaverMaps();
  if (fatalError) throw fatalError;
  await throttle();
  if (fatalError) throw fatalError;

  return new Promise<Coords | null>((resolve, reject) => {
    let settled = false;
    const done = (value: Coords | null, err?: MapError) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      pendingRejects.delete(rejectHook);
      if (err) reject(err); else resolve(value);
    };
    const rejectHook = (err: MapError) => done(null, err);
    const timer = window.setTimeout(() => done(null), GEOCODE_TIMEOUT_MS);
    pendingRejects.add(rejectHook);

    try {
      window.naver.maps.Service.geocode({ query }, (status: any, response: any) => {
        if (status !== window.naver.maps.Service.Status.OK) { done(null); return; }
        const list = response?.v2?.addresses ?? [];
        if (!list.length) { done(null); return; }
        // 네이버 응답은 x = 경도, y = 위도.
        const lat = parseFloat(list[0].y);
        const lng = parseFloat(list[0].x);
        done(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null);
      });
    } catch {
      done(null);
    }
  });
}

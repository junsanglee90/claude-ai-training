/**
 * data.js — Google Apps Script API 연동 레이어
 *
 * ★ 모든 요청을 GET으로 처리 (CORS/redirect 이슈 방지)
 */

// ──────────────────────────────────────────────
const API_URL = 'https://script.google.com/a/macros/woowayouths.com/s/AKfycbyT1FKjWIE_ecBADc6sP-p63t3Pt4RGV3JJefRj35XjLgFZxOPzii1GAfeIl1ngG9Cs/exec';
// ──────────────────────────────────────────────

/** GET 요청 (모든 API 호출에 사용) */
async function apiGet(params) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, String(v)));

  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error('네트워크 오류가 발생했습니다.');
  return res.json();
}

/** 일정 목록 + 현재 신청 인원 조회 */
async function fetchSchedules() {
  const data = await apiGet({ action: 'getSchedules' });
  if (!data.ok) throw new Error(data.error);
  return data.schedules;
}

/** 특정 일정의 신청자 목록 조회 */
async function fetchRegistrationsBySchedule(scheduleId) {
  const data = await apiGet({ action: 'getRegistrations', scheduleId });
  if (!data.ok) throw new Error(data.error);
  return data.registrations;
}

/** 이름+조직으로 내 신청 내역 조회 */
async function fetchLookup(org, name) {
  const data = await apiGet({ action: 'lookup', org, name });
  if (!data.ok) throw new Error(data.error);
  return data.registrations;
}

/** 수강 신청 */
async function requestRegister({ scheduleId, org, name }) {
  return apiGet({ action: 'register', scheduleId, org, name });
}

/** 수강 취소 */
async function requestCancel(id) {
  return apiGet({ action: 'cancel', id });
}

/** 관리자 로그인 */
async function requestAdminLogin(password) {
  return apiGet({ action: 'adminLogin', pw: password });
}

/** 관리자: 신청자 추가 */
async function requestAdminAdd({ scheduleId, org, name, password }) {
  return apiGet({ action: 'adminAdd', scheduleId, org, name, pw: password });
}

/** 관리자: 신청자 삭제 */
async function requestAdminDelete({ id, password }) {
  return apiGet({ action: 'adminDelete', id, pw: password });
}

/** 관리자: 전체 신청자 조회 */
async function fetchAllRegistrations(password) {
  const data = await apiGet({ action: 'getAllRegistrations', pw: password });
  if (!data.ok) throw new Error(data.error);
  return data.registrations;
}

/** 날짜 포맷 (2026-05-13, 수 → "2026년 5월 13일 (수)") */
function formatDate(dateStr, dayOfWeek) {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dayOfWeek})`;
}

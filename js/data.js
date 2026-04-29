/**
 * data.js — Google Apps Script API 연동 레이어
 *
 * ★ JSONP 방식으로 CORS 이슈 완전 우회
 *   <script> 태그는 CORS 제한을 받지 않으므로
 *   Workspace 조직 내 Apps Script도 외부에서 호출 가능
 */

// ──────────────────────────────────────────────
const API_URL = 'https://script.google.com/a/macros/woowayouths.com/s/AKfycbyT1FKjWIE_ecBADc6sP-p63t3Pt4RGV3JJefRj35XjLgFZxOPzii1GAfeIl1ngG9Cs/exec';
// ──────────────────────────────────────────────

/**
 * JSONP 방식 API 호출
 * - <script> 태그를 동적으로 생성하여 CORS를 우회
 * - Apps Script가 callback(JSON) 형태의 JS를 반환
 */
function apiCall(params) {
  return new Promise(function(resolve, reject) {
    // 고유한 콜백 함수명 생성
    var cbName = '_jsonp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    params.callback = cbName;

    // URL 조립
    var url = API_URL + '?';
    var parts = [];
    Object.keys(params).forEach(function(k) {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k])));
    });
    url += parts.join('&');

    // 타임아웃 (15초)
    var timeoutId = setTimeout(function() {
      cleanup();
      reject(new Error('요청 시간이 초과되었습니다.'));
    }, 15000);

    // 정리 함수
    function cleanup() {
      clearTimeout(timeoutId);
      delete window[cbName];
      var el = document.getElementById(cbName);
      if (el) el.parentNode.removeChild(el);
    }

    // 콜백 함수 등록 (Apps Script가 이 함수를 호출)
    window[cbName] = function(data) {
      cleanup();
      resolve(data);
    };

    // <script> 태그 생성 및 삽입
    var script = document.createElement('script');
    script.id = cbName;
    script.src = url;
    script.onerror = function() {
      cleanup();
      reject(new Error('서버 연결에 실패했습니다.'));
    };
    document.head.appendChild(script);
  });
}

/** 일정 목록 + 현재 신청 인원 조회 */
async function fetchSchedules() {
  var data = await apiCall({ action: 'getSchedules' });
  if (!data.ok) throw new Error(data.error);
  return data.schedules;
}

/** 특정 일정의 신청자 목록 조회 */
async function fetchRegistrationsBySchedule(scheduleId) {
  var data = await apiCall({ action: 'getRegistrations', scheduleId: scheduleId });
  if (!data.ok) throw new Error(data.error);
  return data.registrations;
}

/** 이름+조직으로 내 신청 내역 조회 */
async function fetchLookup(org, name) {
  var data = await apiCall({ action: 'lookup', org: org, name: name });
  if (!data.ok) throw new Error(data.error);
  return data.registrations;
}

/** 수강 신청 */
async function requestRegister(info) {
  return apiCall({ action: 'register', scheduleId: info.scheduleId, org: info.org, name: info.name });
}

/** 수강 취소 */
async function requestCancel(id) {
  return apiCall({ action: 'cancel', id: id });
}

/** 관리자 로그인 */
async function requestAdminLogin(password) {
  return apiCall({ action: 'adminLogin', pw: password });
}

/** 관리자: 신청자 추가 */
async function requestAdminAdd(info) {
  return apiCall({ action: 'adminAdd', scheduleId: info.scheduleId, org: info.org, name: info.name, pw: info.password });
}

/** 관리자: 신청자 삭제 */
async function requestAdminDelete(info) {
  return apiCall({ action: 'adminDelete', id: info.id, pw: info.password });
}

/** 관리자: 전체 신청자 조회 */
async function fetchAllRegistrations(password) {
  var data = await apiCall({ action: 'getAllRegistrations', pw: password });
  if (!data.ok) throw new Error(data.error);
  return data.registrations;
}

/** 날짜 포맷 */
function formatDate(dateStr, dayOfWeek) {
  var parts = dateStr.split('-');
  return parts[0] + '년 ' + parseInt(parts[1]) + '월 ' + parseInt(parts[2]) + '일 (' + dayOfWeek + ')';
}

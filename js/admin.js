/**
 * admin.js — 관리자 대시보드 (API 연동 버전)
 */

let adminState = {
  selectedScheduleId: null,
  password: '',
  schedules: [],
  registrations: []
};

// ─── 초기화 ───
function initAdminPage() {
  document.getElementById('adminPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  // 세션 복원 시도
  const savedPw = sessionStorage.getItem('ax_admin_pw');
  if (savedPw) {
    adminState.password = savedPw;
    showDashboard();
  }
}

// ─── 로그인 ───
async function login() {
  const pw = document.getElementById('adminPassword').value.trim();
  if (!pw) {
    document.getElementById('loginError').textContent = '비밀번호를 입력해 주세요.';
    return;
  }

  showLoading(true);
  try {
    const result = await requestAdminLogin(pw);
    if (result.ok) {
      adminState.password = pw;
      sessionStorage.setItem('ax_admin_pw', pw);
      showDashboard();
    } else {
      document.getElementById('loginError').textContent = '비밀번호가 올바르지 않습니다.';
      document.getElementById('adminPassword').value = '';
      document.getElementById('adminPassword').focus();
    }
  } catch (err) {
    document.getElementById('loginError').textContent = '서버 연결에 실패했습니다.';
    console.error(err);
  } finally {
    showLoading(false);
  }
}

function logout() {
  sessionStorage.removeItem('ax_admin_pw');
  adminState = { selectedScheduleId: null, password: '', schedules: [], registrations: [] };
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('dashboardSection').classList.add('hidden');
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('adminPassword').value = '';
  document.getElementById('loginError').textContent = '';
}

// ─── 대시보드 표시 ───
async function showDashboard() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  document.getElementById('logoutBtn').style.display = '';
  await loadDashboardData();
}

async function loadDashboardData() {
  showLoading(true);
  try {
    const [schedules, registrations] = await Promise.all([
      fetchSchedules(),
      fetchAllRegistrations(adminState.password)
    ]);

    adminState.schedules = schedules;
    adminState.registrations = registrations;

    if (!adminState.selectedScheduleId && schedules.length > 0) {
      adminState.selectedScheduleId = schedules[0].id;
    }

    renderDashboard();
  } catch (err) {
    console.error(err);
    showAdminToast('데이터를 불러오는 데 실패했습니다.');
  } finally {
    showLoading(false);
  }
}

// ─── 대시보드 렌더링 ───
function renderDashboard() {
  const { schedules, registrations } = adminState;
  const totalSlots = schedules.reduce((s, x) => s + x.maxSlots, 0);
  const totalReg = registrations.length;

  document.getElementById('statTotal').textContent = totalSlots + '석';
  document.getElementById('statRegistered').textContent = totalReg + '명';
  document.getElementById('statAvailable').textContent = (totalSlots - totalReg) + '석';

  renderScheduleTabs(schedules);
  if (adminState.selectedScheduleId) {
    renderRegistrantSection(adminState.selectedScheduleId);
  }
}

function renderScheduleTabs(schedules) {
  const container = document.getElementById('scheduleTabs');
  container.innerHTML = schedules.map(s => {
    const count = adminState.registrations.filter(r => r.scheduleId === s.id).length;
    const full = count >= s.maxSlots;
    const selected = adminState.selectedScheduleId === s.id;
    return `
      <button class="sched-tab${selected ? ' sched-tab--active' : ''}${full ? ' sched-tab--full' : ''}"
              onclick="selectAdminSchedule(${s.id})">
        <span class="sched-tab-date">${formatShortDate(s.date)}</span>
        <span class="sched-tab-time">${s.time}</span>
        <span class="sched-tab-count${full ? ' count--full' : ''}">${count}/${s.maxSlots}</span>
      </button>`;
  }).join('');
}

function formatShortDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dow = days[new Date(dateStr + 'T00:00:00').getDay()];
  return `${parseInt(m)}/${parseInt(d)} (${dow})`;
}

function selectAdminSchedule(id) {
  adminState.selectedScheduleId = id;
  document.getElementById('addFormSection').classList.add('hidden');
  renderDashboard();
}

function renderRegistrantSection(scheduleId) {
  const s = adminState.schedules.find(x => x.id === scheduleId);
  const regs = adminState.registrations.filter(r => r.scheduleId === scheduleId);
  const count = regs.length;
  const max = s ? s.maxSlots : 0;
  const avail = max - count;

  document.getElementById('detailHeader').innerHTML = s ? `
    <div class="detail-title">
      <span class="detail-date">${formatShortDate(s.date)}</span>
      <span class="detail-time-loc">${s.time} &nbsp;·&nbsp; ${s.location}</span>
    </div>
    <div class="detail-chips">
      <span class="chip chip--total">전체 ${max}석</span>
      <span class="chip chip--reg">신청 ${count}명</span>
      <span class="chip ${avail <= 0 ? 'chip--full' : 'chip--avail'}">잔여 ${avail}석</span>
    </div>` : '';

  const tbody = document.getElementById('registrantTbody');
  if (regs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">신청자가 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = regs.map((r, idx) => `
    <tr>
      <td class="td-center td-num">${idx + 1}</td>
      <td>${escapeHtml(r.org)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td class="td-center td-muted">${formatDateTime(r.registeredAt)}</td>
      <td class="td-center">
        <button class="btn-del" onclick="adminDelete('${r.id}')" title="삭제">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </td>
    </tr>`).join('');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '-';
  // "2026-05-13 14:30:00" 형태
  const parts = dateTimeStr.split(' ');
  if (parts.length < 2) return dateTimeStr;
  const [y, m, d] = parts[0].split('-');
  const timePart = parts[1].substring(0, 5); // HH:mm
  return `${parseInt(m)}/${parseInt(d)} ${timePart}`;
}

// ─── 관리자 삭제 ───
async function adminDelete(id) {
  showConfirmAdmin('이 신청자를 삭제하시겠습니까?', async () => {
    showLoading(true);
    try {
      const result = await requestAdminDelete({ id, password: adminState.password });
      if (result.ok) {
        showAdminToast('삭제되었습니다.');
        await loadDashboardData();
      } else {
        showAdminToast('삭제에 실패했습니다.');
      }
    } catch (err) {
      showAdminToast('서버 연결에 실패했습니다.');
      console.error(err);
    } finally {
      showLoading(false);
    }
  });
}

// ─── 신청자 추가 폼 ───
function toggleAddForm() {
  const section = document.getElementById('addFormSection');
  const isHidden = section.classList.toggle('hidden');
  if (!isHidden) {
    document.getElementById('addOrg').value = '';
    document.getElementById('addName').value = '';
    document.getElementById('addOrg').focus();
  }
}

async function submitAdd() {
  const org = document.getElementById('addOrg').value.trim();
  const name = document.getElementById('addName').value.trim();

  if (!org || !name) { alert('조직명과 이름을 모두 입력해 주세요.'); return; }
  if (!adminState.selectedScheduleId) { alert('일정을 선택해 주세요.'); return; }

  showLoading(true);
  try {
    const result = await requestAdminAdd({
      scheduleId: adminState.selectedScheduleId,
      org,
      name,
      password: adminState.password
    });

    if (!result.ok) {
      if (result.error === 'FULL') alert('해당 일정이 마감 상태입니다.');
      else if (result.error === 'DUPLICATE') alert('이미 등록된 신청자입니다.');
      else alert('추가에 실패했습니다.');
      return;
    }

    document.getElementById('addFormSection').classList.add('hidden');
    showAdminToast('신청자가 추가되었습니다.');
    await loadDashboardData();
  } catch (err) {
    alert('서버 연결에 실패했습니다.');
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// ─── 유틸 ───
function showLoading(show) {
  let overlay = document.getElementById('loadingOverlay');
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div>';
      document.body.appendChild(overlay);
    }
    overlay.classList.add('loading--show');
  } else {
    if (overlay) overlay.classList.remove('loading--show');
  }
}

function showConfirmAdmin(message, onYes) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <p class="modal-msg">${message}</p>
      <div class="modal-footer modal-footer--two">
        <button class="btn btn--ghost" id="cfmNo">취소</button>
        <button class="btn btn--danger" id="cfmYes">확인</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cfmNo').onclick = () => overlay.remove();
  overlay.querySelector('#cfmYes').onclick = () => { overlay.remove(); onYes(); };
}

function showAdminToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('toast--show')); });
  setTimeout(() => {
    t.classList.remove('toast--show');
    setTimeout(() => t.remove(), 300);
  }, 2000);
}

// ─── 페이지 로드 ───
document.addEventListener('DOMContentLoaded', initAdminPage);

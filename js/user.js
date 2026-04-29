/**
 * user.js — 수강신청 사용자 페이지 (API 연동 버전)
 */

let state = {
  org: '',
  name: '',
  selectedScheduleId: null,
  schedules: [] // 서버에서 받아온 일정 캐시
};

// ─── 초기화 ───
function initPage() {
  document.getElementById('inputOrg').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inputName').focus();
  });
  document.getElementById('inputName').addEventListener('keydown', e => {
    if (e.key === 'Enter') goToStep2();
  });
  document.getElementById('lookupOrg').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('lookupName').focus();
  });
  document.getElementById('lookupName').addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupRegistration();
  });
}

// ─── 탭 전환 ───
function switchTab(tab) {
  ['register', 'lookup'].forEach(t => {
    document.getElementById('section-' + t).classList.toggle('hidden', t !== tab);
    document.getElementById('nav-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'lookup') {
    document.getElementById('lookupResult').innerHTML = '';
  }
}

// ─── 단계 표시 ───
function showStep(step) {
  [1, 2, 3].forEach(s => {
    document.getElementById('card-step-' + s).classList.toggle('hidden', s !== step);
    const ind = document.getElementById('step-ind-' + s);
    ind.classList.toggle('active', s === step);
    ind.classList.toggle('completed', s < step);
    ind.classList.toggle('inactive', s > step);
  });
}

// ─── Step 1 → Step 2 ───
function goToStep1() {
  showStep(1);
}

async function goToStep2() {
  const org = document.getElementById('inputOrg').value.trim();
  const name = document.getElementById('inputName').value.trim();

  if (!org) { showInputError('inputOrg', '조직명을 입력해 주세요.'); return; }
  if (!name) { showInputError('inputName', '이름을 입력해 주세요.'); return; }

  state.org = org;
  state.name = name;
  state.selectedScheduleId = null;

  // 서버에서 최신 일정 정보 로드
  showLoading(true);
  try {
    state.schedules = await fetchSchedules();
    renderSchedules();
    showStep(2);
  } catch (err) {
    showModal('일정 정보를 불러오는 데 실패했습니다.\n잠시 후 다시 시도해 주세요.');
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// ─── 입력 에러 표시 ───
function showInputError(id, msg) {
  const input = document.getElementById(id);
  input.classList.add('input-error');
  let errEl = input.parentNode.querySelector('.error-msg');
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'error-msg';
    input.parentNode.appendChild(errEl);
  }
  errEl.textContent = msg;
  input.focus();
  input.addEventListener('input', () => {
    input.classList.remove('input-error');
    const e = input.parentNode.querySelector('.error-msg');
    if (e) e.remove();
  }, { once: true });
}

// ─── 일정 렌더링 ───
function renderSchedules() {
  const container = document.getElementById('scheduleList');
  container.innerHTML = state.schedules.map(s => {
    const count = s.currentCount || 0;
    const available = s.maxSlots - count;
    const full = available <= 0;
    const selected = state.selectedScheduleId === s.id;
    const fillPct = Math.min((count / s.maxSlots) * 100, 100);
    const slotClass = full ? 'slot-text--full' : available <= 5 ? 'slot-text--warning' : 'slot-text--ok';

    return `
      <div class="schedule-item${full ? ' schedule-item--full' : ''}${selected ? ' schedule-item--selected' : ''}"
           onclick="${full ? 'handleFullSlot()' : `selectSchedule(${s.id})`}">
        <div class="schedule-main">
          <div class="schedule-date">${formatDate(s.date, s.dayOfWeek)}</div>
          <div class="schedule-time">${s.time}</div>
          <div class="schedule-location"><svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M6 0C3.24 0 1 2.24 1 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.5c-.83 0-1.5-.67-1.5-1.5S5.17 3.5 6 3.5 7.5 4.17 7.5 5 6.83 6.5 6 6.5z" fill="currentColor"/></svg>${s.location}</div>
        </div>
        <div class="schedule-side">
          <div class="slot-bar-wrap">
            <div class="slot-bar"><div class="slot-bar-fill" style="width:${fillPct}%"></div></div>
            <span class="slot-text ${slotClass}">${full ? '마감' : `잔여 ${available}석`}</span>
          </div>
          <span class="badge ${full ? 'badge--full' : 'badge--open'}">${full ? '마감' : '신청 가능'}</span>
        </div>
        ${selected ? '<div class="check-mark"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#6366f1"/><path d="M5 10l4 4 6-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' : ''}
      </div>`;
  }).join('');
}

function selectSchedule(id) {
  state.selectedScheduleId = id;
  renderSchedules();
}

function handleFullSlot() {
  showModal('선택하신 일정은 마감되었습니다.\n다른 일정을 선택해 주세요.');
}

// ─── 수강 신청 제출 ───
async function submitRegistration() {
  if (!state.selectedScheduleId) {
    showModal('수강 일정을 선택해 주세요.');
    return;
  }

  showLoading(true);
  try {
    const result = await requestRegister({
      scheduleId: state.selectedScheduleId,
      org: state.org,
      name: state.name
    });

    if (!result.ok) {
      if (result.error === 'FULL') {
        showModal('선택하신 일정이 마감되었습니다.\n다른 일정을 선택해 주세요.', async () => {
          state.selectedScheduleId = null;
          state.schedules = await fetchSchedules();
          renderSchedules();
        });
      } else if (result.error === 'DUPLICATE') {
        showModal('이미 해당 일정에 수강 신청이 완료된 상태입니다.');
      } else {
        showModal('신청 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.');
      }
      return;
    }

    const schedule = state.schedules.find(s => s.id === state.selectedScheduleId);
    renderSuccess(result.registration, schedule);
    showStep(3);
  } catch (err) {
    showModal('서버 연결에 실패했습니다.\n잠시 후 다시 시도해 주세요.');
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// ─── 완료 화면 ───
function renderSuccess(reg, schedule) {
  document.getElementById('successDetails').innerHTML = `
    <div class="detail-row"><span class="detail-label">소속</span><span class="detail-value">${escapeHtml(reg.org)}</span></div>
    <div class="detail-row"><span class="detail-label">이름</span><span class="detail-value">${escapeHtml(reg.name)}</span></div>
    <div class="detail-row"><span class="detail-label">교육일</span><span class="detail-value">${schedule ? formatDate(schedule.date, schedule.dayOfWeek) : ''}</span></div>
    <div class="detail-row"><span class="detail-label">시간</span><span class="detail-value">${schedule ? schedule.time : ''}</span></div>
    <div class="detail-row"><span class="detail-label">장소</span><span class="detail-value">${schedule ? schedule.location : ''}</span></div>
  `;
}

function resetRegistration() {
  state = { org: '', name: '', selectedScheduleId: null, schedules: [] };
  document.getElementById('inputOrg').value = '';
  document.getElementById('inputName').value = '';
  showStep(1);
}

// ─── 신청 내역 조회 ───
async function lookupRegistration() {
  const org = document.getElementById('lookupOrg').value.trim();
  const name = document.getElementById('lookupName').value.trim();
  if (!org || !name) { showModal('조직명과 이름을 모두 입력해 주세요.'); return; }

  const container = document.getElementById('lookupResult');
  showLoading(true);
  try {
    const [regs, schedules] = await Promise.all([
      fetchLookup(org, name),
      fetchSchedules()
    ]);

    if (regs.length === 0) {
      container.innerHTML = `
        <div class="lookup-empty">
          <div class="lookup-empty-icon">📋</div>
          <p class="lookup-empty-title">조회된 내역이 없습니다</p>
          <p class="lookup-empty-desc">조직명과 이름을 정확히 입력해 주세요.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="lookup-result">
        <h3 class="lookup-result-title">수강 신청 내역 <span class="result-count">${regs.length}건</span></h3>
        ${regs.map(r => {
          const s = schedules.find(x => x.id === r.scheduleId);
          return `
            <div class="result-card">
              <div class="result-info">
                <div class="result-date">${s ? formatDate(s.date, s.dayOfWeek) : '알 수 없음'}</div>
                <div class="result-time">${s ? s.time : ''}</div>
                <div class="result-loc">${s ? '📍 ' + s.location : ''}</div>
              </div>
              <button class="btn btn--danger-outline" onclick="confirmCancel('${r.id}')">신청 취소</button>
            </div>`;
        }).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = `
      <div class="lookup-empty">
        <div class="lookup-empty-icon">⚠️</div>
        <p class="lookup-empty-title">조회에 실패했습니다</p>
        <p class="lookup-empty-desc">잠시 후 다시 시도해 주세요.</p>
      </div>`;
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// ─── 신청 취소 ───
function confirmCancel(id) {
  showConfirm('수강 신청을 취소하시겠습니까?', async () => {
    showLoading(true);
    try {
      const result = await requestCancel(id);
      if (result.ok) {
        showToast('수강 신청이 취소되었습니다.');
        lookupRegistration(); // 다시 조회
      } else {
        showModal('취소에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (err) {
      showModal('서버 연결에 실패했습니다.');
      console.error(err);
    } finally {
      showLoading(false);
    }
  });
}

// ─── 유틸: HTML 이스케이프 ───
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── 유틸: 로딩 오버레이 ───
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

// ─── 유틸: 모달 ───
function showModal(message, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <p class="modal-msg">${message.replace(/\n/g, '<br>')}</p>
      <div class="modal-footer">
        <button class="btn btn--primary modal-ok">확인</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-ok').onclick = () => {
    overlay.remove();
    if (callback) callback();
  };
}

function showConfirm(message, onYes) {
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

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('toast--show')); });
  setTimeout(() => {
    t.classList.remove('toast--show');
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

// ─── 페이지 로드 ───
document.addEventListener('DOMContentLoaded', initPage);

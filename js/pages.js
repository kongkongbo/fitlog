/**
 * 四个页面的渲染与交互（参考「今天练了吗」设计重做）。
 * 所有数据操作走 store，所有图表走 stats，不使用任何假数据。
 */
import * as store from './store.js';
import { seriesFor, summary, exerciseNames, lineChart } from './stats.js';
import { esc, toast, openModal, closeModal, confirmDialog, ICON_TRASH, ICON_PLAN, ICON_RECORD, emptyHTML } from './ui.js';

let currentExercise = null;
let planWeekDate = null;   // 计划页当前查看的周内某天
let recordMonth = null;    // 记录页当前月份 YYYY-MM

// ============ 顶部 header ============
function setHeader({ kicker, title, subtitle, action = '' }) {
  const k = document.getElementById('pageKicker');
  const t = document.getElementById('pageTitle');
  const s = document.getElementById('pageSubtitle');
  const a = document.getElementById('headerAction');
  if (k) k.textContent = kicker;
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
  if (a) a.innerHTML = action;
}

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
function formatDateCN(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK_NAMES[d.getDay()]}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

// ============ 动作编辑组件 ============
function exerciseRowHTML(ex = {}) {
  return `<div class="ex-edit" data-ex-row>
    <div class="ex-edit-top">
      <input class="input ex-name-input" placeholder="动作名称，如 卧推" value="${esc(ex.name || '')}" list="exNameList">
      <button class="icon-btn" data-remove title="移除动作">${ICON_TRASH}</button>
    </div>
    <div class="ex-fields">
      <div class="field field-mini"><label class="field-label">重量 (kg)</label><input class="input ex-weight" type="number" min="0" step="0.5" value="${ex.weight ?? 0}"></div>
      <div class="field field-mini"><label class="field-label">组数</label><input class="input ex-sets" type="number" min="0" step="1" value="${ex.sets ?? 0}"></div>
      <div class="field field-mini"><label class="field-label">次数</label><input class="input ex-reps" type="number" min="0" step="1" value="${ex.reps ?? 0}"></div>
    </div>
  </div>`;
}
function datalistHTML(names) {
  return `<datalist id="exNameList">${names.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>`;
}
function mountExerciseEditor(root) {
  const body = root.querySelector('[data-ex-list]');
  const addBtn = root.querySelector('[data-add-ex]');
  const rows = () => Array.from(body.querySelectorAll('[data-ex-row]'));
  const wire = (row) => { row.querySelector('[data-remove]').onclick = () => row.remove(); };
  rows().forEach(wire);
  addBtn.onclick = () => {
    const div = document.createElement('div');
    div.innerHTML = exerciseRowHTML({});
    const row = div.firstElementChild;
    body.appendChild(row);
    wire(row);
    row.querySelector('.ex-name-input').focus();
  };
  root._collect = () => rows().map((row) => ({
    name: row.querySelector('.ex-name-input').value.trim(),
    weight: parseFloat(row.querySelector('.ex-weight').value) || 0,
    sets: parseInt(row.querySelector('.ex-sets').value, 10) || 0,
    reps: parseInt(row.querySelector('.ex-reps').value, 10) || 0,
  })).filter((e) => e.name);
}

// ============================================================
// 计划页：本周计划 + 今日安排 + 本周完成
// ============================================================
export async function renderPlans(ctx) {
  const { content } = ctx;
  const today = store.today();
  if (!planWeekDate) planWeekDate = today;
  const week = store.weekDates(planWeekDate);
  const [plans, schedules, drafts, records, goal] = await Promise.all([
    store.getPlans(), store.getSchedules(), store.getDrafts(), store.getRecords(), store.getWeeklyGoal(),
  ]);
  const scheduleMap = Object.fromEntries(schedules.map((s) => [s.date, s]));
  const draftDates = new Set(drafts.map((d) => d.date));
  const recordDates = new Set(records.map((r) => r.date));
  const doneCount = records.filter((r) => week.includes(r.date)).length;
  const pct = goal > 0 ? Math.min(100, Math.round(doneCount / goal * 100)) : 0;

  setHeader({
    kicker: 'YOUR PERSONAL FITNESS SPACE',
    title: '把训练，变成日常。',
    subtitle: '照自己的节奏，一点点向前。',
    action: `<span class="date-pill">${formatDateCN(today)}</span>
      <button class="btn btn-primary" id="addPlanBtn"><span class="icon-plus">＋</span> 新建计划</button>`,
  });

  // 今日安排：查看日期对应的计划
  const daySchedule = scheduleMap[planWeekDate];
  const dayPlan = daySchedule?.planId ? plans.find((p) => p.id === daySchedule.planId) : null;
  const dayHasDraft = draftDates.has(planWeekDate);
  const dayHasRecord = recordDates.has(planWeekDate);

  content.innerHTML = `
    <div class="two-col">
      <div class="stack">
        <div class="card week-card">
          <div class="week-label">
            <div class="card-title">本周计划</div>
            <div class="card-subtle">${week[0].slice(5).replace('-', '.')} — ${week[6].slice(5).replace('-', '.')}</div>
          </div>
          <div class="week-strip">
            ${week.map((d) => {
              const dd = new Date(d + 'T00:00:00');
              const hasPlan = !!scheduleMap[d] || draftDates.has(d) || recordDates.has(d);
              return `<div class="week-day ${d === planWeekDate ? 'selected' : ''} ${hasPlan ? 'has-plan' : ''}" data-day="${d}">
                <span class="wd-name">${WEEK_NAMES[dd.getDay()] === '日' ? '日' : '周' + WEEK_NAMES[dd.getDay()]}</span>
                <span class="wd-num">${dd.getDate()}</span>
                <span class="wd-dot"></span>
              </div>`;
            }).join('')}
          </div>
          <div class="today-panel">
            <div class="tp-top">
              <span class="badge ${dayPlan || dayHasDraft ? '' : 'badge-muted'}">今日安排 · ${dayPlan ? esc(dayPlan.name) : dayHasDraft ? '进行中' : '未安排'}</span>
              <span class="link-btn" id="editScheduleBtn">编辑安排</span>
            </div>
            ${dayPlan ? `
              <h3>${esc(dayPlan.name)}</h3>
              <div class="tp-desc">${(dayPlan.exercises || []).length} 个动作 · ${esc((dayPlan.exercises || []).slice(0, 3).map((e) => e.name).join('、'))}${(dayPlan.exercises || []).length > 3 ? ' …' : ''}</div>
              <button class="btn btn-primary btn-block btn-large" id="startBtn">${dayHasDraft ? '继续训练' : dayHasRecord ? '再练一次 →' : '开始训练 →'}</button>
            ` : `
              <h3>今天，想练点什么？</h3>
              <div class="tp-desc">不用准备得很完美，从你的第一个动作开始。</div>
              <button class="btn btn-primary btn-block btn-large" id="startBtn">＋ 开始训练 →</button>
            `}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title">全部计划</div><span class="link-btn" id="addPlanLink">＋ 新建计划</span></div>
          ${plans.length ? `<div class="grid">${plans.map((p) => {
            const n = (p.exercises || []).length;
            return `<div class="card card-click" data-plan="${p.id}" style="box-shadow:none;background:var(--green-softer)">
              <div class="card-head" style="margin-bottom:8px"><div class="card-title-sm">${esc(p.name)}</div><span class="badge badge-muted">${n} 个动作</span></div>
              <div class="card-line">${n ? esc((p.exercises || []).slice(0, 3).map((e) => e.name).join(' · ')) : '暂无动作'}</div>
            </div>`;
          }).join('')}</div>` : `<div class="card-line" style="padding:12px 0">还没有计划，点右上角新建。</div>`}
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head">
            <div class="card-title">本周完成</div>
            <span class="badge">慢慢积累</span>
          </div>
          <div class="ring-wrap">
            <div class="ring">
              <svg width="150" height="150" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r="62" fill="none" stroke="#edf2ed" stroke-width="12"/>
                <circle cx="75" cy="75" r="62" fill="none" stroke="#2c6e49" stroke-width="12"
                  stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 62).toFixed(1)}"
                  stroke-dashoffset="${(2 * Math.PI * 62 * (1 - pct / 100)).toFixed(1)}"/>
              </svg>
              <div class="ring-center">
                <div class="ring-num">${doneCount}</div>
                <div class="ring-label">/ ${goal} 次训练</div>
              </div>
            </div>
            <div class="ring-note">设一个小目标，让坚持更有方向。</div>
            <span class="link-btn" id="setGoalBtn">设置训练目标</span>
          </div>
        </div>
      </div>
    </div>`;

  // 绑定：选日期
  content.querySelectorAll('[data-day]').forEach((el) => {
    el.onclick = () => { planWeekDate = el.dataset.day; renderPlans(ctx); };
  });
  // 开始/继续训练
  document.getElementById('startBtn').onclick = () => {
    if (dayHasDraft) return ctx.go('records'); // 有进行中训练，去记录页继续
    if (dayPlan) {
      store.upsertDraft(planWeekDate, dayPlan.id, dayPlan.name, dayPlan.exercises.map((e) => ({ ...e })))
        .then(() => { toast('已生成今日训练，去记录页填写实际重量'); ctx.go('records'); });
    } else {
      recordDraftEditor(ctx, planWeekDate); // 自由训练：先建草稿
    }
  };
  // 编辑安排
  document.getElementById('editScheduleBtn').onclick = () => scheduleEditor(ctx, planWeekDate, daySchedule, plans);
  // 设置目标
  document.getElementById('setGoalBtn').onclick = () => goalEditor(ctx);
  // 新建计划
  document.getElementById('addPlanBtn').onclick = () => planEditor(ctx);
  const addLink = document.getElementById('addPlanLink');
  if (addLink) addLink.onclick = () => planEditor(ctx);
  // 计划卡片
  content.querySelectorAll('[data-plan]').forEach((el) => {
    el.onclick = () => planDetail(ctx, el.dataset.plan);
  });
}

async function scheduleEditor(ctx, date, current, plans) {
  openModal(`
    <div class="modal-title">编辑今日安排</div>
    <div class="modal-sub">${formatDateCN(date)} · 选择这天要练的计划</div>
    <div class="modal-body">
      <div class="field">
        <label class="field-label">选择计划</label>
        <select class="select" id="schedPlan" style="width:100%">
          <option value="">不安排</option>
          ${plans.map((p) => `<option value="${p.id}" ${current?.planId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      ${!plans.length ? '<div class="card-sub">还没有计划，请先新建计划。</div>' : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-cancel>取消</button>
      <button class="btn btn-primary" data-save>保存安排</button>
    </div>
  `, { onMount: (root) => {
    root.querySelector('[data-cancel]').onclick = closeModal;
    root.querySelector('[data-save]').onclick = async () => {
      const planId = root.querySelector('#schedPlan').value;
      if (planId) {
        const plan = plans.find((p) => p.id === planId);
        await store.setSchedule(date, planId, plan.name);
      } else {
        await store.clearSchedule(date);
      }
      closeModal(); toast('安排已更新'); renderPlans(ctx);
    };
  }});
}

async function goalEditor(ctx) {
  const goal = await store.getWeeklyGoal();
  openModal(`
    <div class="modal-title">设置训练目标</div>
    <div class="modal-sub">给自己定一个每周的小目标</div>
    <div class="modal-body">
      <div class="field"><label class="field-label">每周训练次数</label>
        <input class="input" id="goalInput" type="number" min="0" max="21" value="${goal}"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-cancel>取消</button>
      <button class="btn btn-primary" data-save>保存目标</button>
    </div>
  `, { onMount: (root) => {
    root.querySelector('[data-cancel]').onclick = closeModal;
    root.querySelector('[data-save]').onclick = async () => {
      const v = Math.max(0, parseInt(root.querySelector('#goalInput').value, 10) || 0);
      await store.setWeeklyGoal(v);
      closeModal(); toast('目标已更新'); renderPlans(ctx);
    };
  }});
}

async function planEditor(ctx, plan = null) {
  const isEdit = !!plan;
  const names = await store.allExerciseNames();
  const templates = await store.getTemplates();
  openModal(`
    <div class="modal-title">${isEdit ? '编辑计划' : '新建计划'}</div>
    <div class="modal-sub">${isEdit ? '修改计划名称和目标值' : '安排动作，并设定目标重量、组数和次数'}</div>
    <div class="modal-body">
      <div class="field"><label class="field-label">计划名称</label>
        <input class="input" id="planName" placeholder="如 推日训练 / 全身训练" value="${esc(plan?.name || '')}"></div>
      ${!isEdit && templates.length ? `<div class="field"><label class="field-label">从模板导入（可选）</label>
        <select class="select" id="planTemplate" style="width:100%"><option value="">不导入，手动添加</option>
        ${templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>` : ''}
      <label class="field-label">动作与目标</label>
      <div data-ex-list>${(plan?.exercises || []).map((e) => exerciseRowHTML(e)).join('')}</div>
      ${datalistHTML(names)}
      <button class="add-ex-btn" data-add-ex>＋ 添加动作</button>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-cancel>取消</button>
      <button class="btn btn-primary" data-save>${isEdit ? '保存修改' : '创建计划'}</button>
    </div>
  `, { wide: true, onMount: (root) => {
    mountExerciseEditor(root);
    const tpl = root.querySelector('#planTemplate');
    if (tpl) tpl.onchange = async () => {
      const t = (await store.getTemplates()).find((x) => x.id === tpl.value);
      if (!t) return;
      root.querySelector('[data-ex-list]').innerHTML = (t.exercises || []).map((e) => exerciseRowHTML({ name: e.name })).join('');
      mountExerciseEditor(root);
    };
    root.querySelector('[data-cancel]').onclick = closeModal;
    root.querySelector('[data-save]').onclick = async () => {
      const name = root.querySelector('#planName').value.trim();
      if (!name) return toast('请填写计划名称', 'error');
      const exercises = root._collect();
      if (!exercises.length) return toast('请至少添加一个动作', 'error');
      if (isEdit) await store.updatePlan(plan.id, name, exercises);
      else await store.addPlan(name, exercises, tpl ? tpl.value : null);
      closeModal(); toast(isEdit ? '计划已更新' : '计划已创建'); renderPlans(ctx);
    };
  }});
}

async function planDetail(ctx, id) {
  const plans = await store.getPlans();
  const p = plans.find((x) => x.id === id);
  if (!p) return;
  setHeader({ kicker: 'YOUR PLAN', title: p.name, subtitle: `${(p.exercises || []).length} 个动作 · 规划你的每一次训练` });
  const { content } = ctx;
  content.innerHTML = `<div class="stack">
    <div class="card">
      <div class="card-head"><div class="card-title">动作安排</div><span class="badge">${(p.exercises || []).length} 个动作</span></div>
      ${(p.exercises || []).length ? p.exercises.map((e, i) => `<div class="list-row">
        <div class="ex-index">${i + 1}</div><div class="ex-name">${esc(e.name)}</div>
        <div class="ex-values"><b>${e.weight}</b> kg × <b>${e.sets}</b> 组 × <b>${e.reps}</b> 次</div>
      </div>`).join('') : '<div class="card-line">暂无动作</div>'}
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost" id="backBtn">返回</button>
      <button class="btn btn-ghost" id="editPlanBtn">编辑计划</button>
      <button class="btn btn-ghost" id="delPlanBtn">删除</button>
      <button class="btn btn-primary" id="startBtn" style="margin-left:auto">开始训练 →</button>
    </div>
  </div>`;
  document.getElementById('backBtn').onclick = () => renderPlans(ctx);
  document.getElementById('editPlanBtn').onclick = () => planEditor(ctx, p);
  document.getElementById('delPlanBtn').onclick = async () => {
    const ok = await confirmDialog({ title: '删除计划？', text: `删除「${esc(p.name)}」，已完成的训练记录不受影响。` });
    if (!ok) return;
    await store.deletePlan(p.id); toast('计划已删除'); renderPlans(ctx);
  };
  document.getElementById('startBtn').onclick = async () => {
    await store.upsertDraft(store.today(), p.id, p.name, p.exercises.map((e) => ({ ...e })));
    toast('已生成今日训练，去记录页填写实际重量'); ctx.go('records');
  };
}

// 自由训练草稿编辑
async function recordDraftEditor(ctx, date) {
  const names = await store.allExerciseNames();
  openModal(`
    <div class="modal-title">开始自由训练</div>
    <div class="modal-sub">${formatDateCN(date)} · 先添加动作，稍后在记录页填写实际重量</div>
    <div class="modal-body">
      <div class="field"><label class="field-label">训练名称</label>
        <input class="input" id="draftName" value="自由训练"></div>
      <label class="field-label">动作</label>
      <div data-ex-list>${exerciseRowHTML({})}</div>
      ${datalistHTML(names)}
      <button class="add-ex-btn" data-add-ex>＋ 添加动作</button>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-cancel>取消</button>
      <button class="btn btn-primary" data-save>创建训练</button>
    </div>
  `, { wide: true, onMount: (root) => {
    mountExerciseEditor(root);
    root.querySelector('[data-cancel]').onclick = closeModal;
    root.querySelector('[data-save]').onclick = async () => {
      const name = root.querySelector('#draftName').value.trim() || '自由训练';
      const exercises = root._collect();
      if (!exercises.length) return toast('请至少添加一个动作', 'error');
      await store.upsertDraft(date, null, name, exercises);
      closeModal(); toast('已创建，去记录页继续'); ctx.go('records');
    };
  }});
}

// ============================================================
// 记录页：今日训练 + 训练记录
// ============================================================
export async function renderRecords(ctx) {
  const { content } = ctx;
  const today = store.today();
  if (!recordMonth) recordMonth = today.slice(0, 7);
  const [drafts, records] = await Promise.all([store.getDrafts(), store.getRecords()]);
  const todayDraft = drafts.find((d) => d.date === today);
  const todayRecords = records.filter((r) => r.date === today);
  const monthRecords = records.filter((r) => (r.date || '').startsWith(recordMonth))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

  setHeader({
    kicker: '今 天 练 了 吗 · YOUR DAILY PRACTICE',
    title: '每一次，都有记录。',
    subtitle: '积累属于你的训练日历。',
    action: `<button class="btn btn-primary" id="addRecordBtn">＋ 补录训练</button>`,
  });

  // 今日训练状态
  let sessionHTML;
  if (todayDraft) {
    sessionHTML = `
      <span class="badge badge-amber">有未完成训练</span>
      <h3>照自己的节奏来</h3>
      <div class="s-desc">${esc(todayDraft.planName)} · ${(todayDraft.exercises || []).length} 个动作待完成</div>
      <div class="s-hint">空白训练清单会带入今天的计划；已有动作可在记录页补入计划，保留原数据。</div>
      <button class="btn btn-primary btn-block btn-large" id="continueBtn" style="margin-top:18px">继续未完成训练</button>`;
  } else if (todayRecords.length) {
    sessionHTML = `
      <span class="badge">今日已完成</span>
      <h3>今天，已经练过了</h3>
      <div class="s-desc">${todayRecords.length} 次训练 · 每一次都算数</div>
      <button class="btn btn-ghost btn-block btn-large" id="addMoreBtn" style="margin-top:18px">再补一次训练</button>`;
  } else {
    sessionHTML = `
      <span class="badge badge-muted">今日未训练</span>
      <h3>照自己的节奏来</h3>
      <div class="s-desc">今天还没有安排训练，可以开始一次新的训练。</div>
      <div class="s-hint">空白训练清单会带入今天的计划；已有动作可在记录页补入计划，保留原数据。</div>
      <button class="btn btn-primary btn-block btn-large" id="startFreeBtn" style="margin-top:18px">＋ 开始今天的训练</button>`;
  }

  content.innerHTML = `
    <div class="stack">
      <div class="card session-card">${sessionHTML}</div>
      <div class="card">
        <div class="card-head">
          <div class="card-title">训练记录</div>
          <input class="select" id="monthInput" type="month" value="${recordMonth}" style="width:auto;padding-right:14px">
        </div>
        ${monthRecords.length ? monthRecords.map((r) => `
          <div class="record-row" data-record="${r.id}">
            <div class="rr-main">
              <div class="rr-title">${esc(r.planName || '自由训练')}</div>
              <div class="rr-meta">${esc(r.date)} · ${(r.exercises || []).length} 个动作</div>
            </div>
            <div class="rr-action">继续记录 ›</div>
          </div>`).join('') : `<div class="card-line" style="padding:12px 0">${monthLabel(recordMonth)}还没有训练记录。</div>`}
      </div>
    </div>`;

  document.getElementById('addRecordBtn').onclick = () => recordEditor(ctx);
  const monthInput = document.getElementById('monthInput');
  if (monthInput) monthInput.onchange = (e) => { recordMonth = e.target.value || today.slice(0, 7); renderRecords(ctx); };
  const cont = document.getElementById('continueBtn');
  if (cont) cont.onclick = () => draftEditor(ctx, todayDraft);
  const addMore = document.getElementById('addMoreBtn');
  if (addMore) addMore.onclick = () => recordEditor(ctx);
  const startFree = document.getElementById('startFreeBtn');
  if (startFree) startFree.onclick = () => recordDraftEditor(ctx, today);
  content.querySelectorAll('[data-record]').forEach((el) => {
    el.onclick = () => renderRecordDetail(ctx, el.dataset.record);
  });
}

// 编辑进行中训练草稿
async function draftEditor(ctx, draft) {
  const names = await store.allExerciseNames();
  openModal(`
    <div class="modal-title">继续未完成训练</div>
    <div class="modal-sub">${formatDateCN(draft.date)} · 填写实际完成的重量、组数和次数</div>
    <div class="modal-body">
      <div class="field"><label class="field-label">训练名称</label>
        <input class="input" id="draftName" value="${esc(draft.planName || '自由训练')}"></div>
      <label class="field-label">动作明细</label>
      <div data-ex-list>${(draft.exercises || []).map((e) => exerciseRowHTML(e)).join('')}</div>
      ${datalistHTML(names)}
      <button class="add-ex-btn" data-add-ex>＋ 添加动作</button>
      <div class="field" style="margin-top:18px"><label class="field-label">备注（可选）</label>
        <textarea class="textarea" id="draftNote"></textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" id="discardBtn">放弃草稿</button>
      <button class="btn btn-primary" data-save>完成训练</button>
    </div>
  `, { wide: true, onMount: (root) => {
    mountExerciseEditor(root);
    root.querySelector('[data-cancel]')?.addEventListener('click', closeModal);
    root.querySelector('#discardBtn').onclick = async () => {
      const ok = await confirmDialog({ title: '放弃这份草稿？', text: '进行中的训练将被删除，此操作不可撤销。' });
      if (!ok) return;
      await store.removeDraft(draft.date);
      closeModal(); toast('草稿已放弃'); renderRecords(ctx);
    };
    root.querySelector('[data-save]').onclick = async () => {
      const name = root.querySelector('#draftName').value.trim() || '自由训练';
      const exercises = root._collect();
      if (!exercises.length) return toast('请至少添加一个动作', 'error');
      const note = root.querySelector('#draftNote').value.trim();
      await store.finishDraft(draft.date, name, exercises, note);
      closeModal(); toast('训练已完成，已记入训练记录'); renderRecords(ctx);
    };
  }});
}

async function recordEditor(ctx, record = null) {
  const isEdit = !!record;
  const names = await store.allExerciseNames();
  openModal(`
    <div class="modal-title">${isEdit ? '编辑记录' : '补录训练'}</div>
    <div class="modal-sub">记录每个动作的重量、组数和次数</div>
    <div class="modal-body">
      <div class="field"><label class="field-label">训练名称</label>
        <input class="input" id="recName" placeholder="如 推日训练 / 自由训练" value="${esc(record && record.planName !== '自由训练' ? record.planName : '')}"></div>
      <div class="field"><label class="field-label">日期</label>
        <input class="input" id="recDate" type="date" value="${esc(record?.date || store.today())}"></div>
      <label class="field-label">动作明细</label>
      <div data-ex-list>${(record?.exercises || []).map((e) => exerciseRowHTML(e)).join('')}</div>
      ${datalistHTML(names)}
      <button class="add-ex-btn" data-add-ex>＋ 添加动作</button>
      <div class="field" style="margin-top:18px"><label class="field-label">备注（可选）</label>
        <textarea class="textarea" id="recNote" placeholder="今天的状态、感受等">${esc(record?.note || '')}</textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-cancel>取消</button>
      <button class="btn btn-primary" data-save>${isEdit ? '保存修改' : '保存记录'}</button>
    </div>
  `, { wide: true, onMount: (root) => {
    mountExerciseEditor(root);
    root.querySelector('[data-cancel]').onclick = closeModal;
    root.querySelector('[data-save]').onclick = async () => {
      const name = root.querySelector('#recName').value.trim() || '自由训练';
      const date = root.querySelector('#recDate').value;
      if (!date) return toast('请选择日期', 'error');
      const note = root.querySelector('#recNote').value.trim();
      const exercises = root._collect();
      if (!exercises.length) return toast('请至少添加一个动作', 'error');
      if (isEdit) await store.updateRecord(record.id, name, exercises, date, note);
      else await store.addRecord(null, name, exercises, date, note);
      closeModal(); toast(isEdit ? '记录已更新' : '记录已保存'); renderRecords(ctx);
    };
  }});
}

export async function renderRecordDetail(ctx, id) {
  const records = await store.getRecords();
  const r = records.find((x) => x.id === id);
  if (!r) return;
  setHeader({ kicker: 'YOUR DAILY PRACTICE', title: r.planName || '自由训练', subtitle: formatDateCN(r.date) });
  const { content } = ctx;
  content.innerHTML = `<div class="stack">
    <div class="card">
      <div class="card-head"><div class="card-title">动作明细</div><span class="badge">${(r.exercises || []).length} 个动作</span></div>
      ${(r.exercises || []).map((e, i) => `<div class="list-row">
        <div class="ex-index">${i + 1}</div><div class="ex-name">${esc(e.name)}</div>
        <div class="ex-values"><b>${e.weight}</b> kg × <b>${e.sets}</b> 组 × <b>${e.reps}</b> 次</div>
      </div>`).join('')}
      ${r.note ? `<div class="section-title">备注</div><div class="card-line">${esc(r.note)}</div>` : ''}
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost" id="backBtn">返回列表</button>
      <button class="btn btn-ghost" id="editRecBtn">编辑</button>
      <button class="btn btn-danger" id="delRecBtn" style="margin-left:auto">删除记录</button>
    </div>
  </div>`;
  document.getElementById('backBtn').onclick = () => renderRecords(ctx);
  document.getElementById('editRecBtn').onclick = () => recordEditor(ctx, r);
  document.getElementById('delRecBtn').onclick = async () => {
    const ok = await confirmDialog({ title: '删除这条记录？', text: `删除「${esc(r.planName)}」${esc(r.date)} 的记录，此操作不可撤销。` });
    if (!ok) return;
    await store.deleteRecord(r.id); toast('记录已删除'); renderRecords(ctx);
  };
}

// ============================================================
// 进步页
// ============================================================
export async function renderStats(ctx) {
  const { content } = ctx;
  setHeader({
    kicker: 'YOUR PROGRESS',
    title: '坚持，看得见。',
    subtitle: '每一次记录，都是向前的一小步。',
  });
  const records = await store.getRecords();
  const names = exerciseNames(records);
  if (!names.length) {
    content.innerHTML = emptyHTML(ICON_RECORD, '暂无可统计的数据', '先添加一些训练记录，这里就会显示动作的重量变化。', '去记录一次训练', 'emptyBtn');
    document.getElementById('emptyBtn').onclick = () => ctx.go('records');
    return;
  }
  if (!currentExercise || !names.includes(currentExercise)) currentExercise = names[0];
  const series = seriesFor(records, currentExercise);
  const s = summary(series);
  const diffColor = s.change >= 0 ? 'var(--green)' : '#c0392b';
  content.innerHTML = `
    <div class="card" style="box-shadow:none;background:transparent;border:none;padding:0;margin-bottom:20px">
      <select class="select" id="statSelect" style="width:100%;max-width:280px">
        ${names.map((n) => `<option value="${esc(n)}" ${n === currentExercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
    </div>
    <div class="stat-bar">
      <div class="stat-box"><div class="stat-label">当前重量</div><div class="stat-value">${s.current}<small>kg</small></div></div>
      <div class="stat-box"><div class="stat-label">历史最高</div><div class="stat-value">${s.best}<small>kg</small></div></div>
      <div class="stat-box"><div class="stat-label">较首次</div><div class="stat-value" style="color:${diffColor}">${s.change >= 0 ? '+' : ''}${s.change}<small>kg</small></div></div>
      <div class="stat-box"><div class="stat-label">记录次数</div><div class="stat-value">${s.count}<small>次</small></div></div>
    </div>
    <div class="card">
      <div class="card-title">${esc(currentExercise)} · 重量趋势</div>
      <div class="chart-wrap">${lineChart(series)}</div>
    </div>
    ${series.length ? `<div class="card" style="margin-top:20px">
      <div class="card-title" style="margin-bottom:8px">历史数据</div>
      ${[...series].reverse().map((x) => `<div class="list-row"><div class="ex-name">${esc(x.date)}</div><div class="ex-values"><b>${x.weight}</b> kg</div></div>`).join('')}
    </div>` : ''}`;
  document.getElementById('statSelect').onchange = (e) => { currentExercise = e.target.value; renderStats(ctx); };
}

// ============================================================
// 我的页
// ============================================================
export async function renderSettings(ctx) {
  const { content } = ctx;
  setHeader({
    kicker: 'YOUR SPACE',
    title: '我的训练空间。',
    subtitle: '打理好模板与数据，安心向前。',
  });
  const templates = await store.getTemplates();
  const goal = await store.getWeeklyGoal();
  content.innerHTML = `<div class="stack">
    <div class="card">
      <div class="card-head"><div class="card-title">训练目标</div><span class="badge">每周</span></div>
      <div class="setting-row">
        <div class="setting-info"><div class="setting-name">每周训练 ${goal} 次</div>
          <div class="setting-desc">在计划页可以看到本周完成进度</div></div>
        <div class="setting-actions"><button class="btn btn-ghost btn-sm" id="goalBtnFromSettings">调整</button></div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">训练模板</div><span class="link-btn" id="addTplBtn">＋ 新建模板</span></div>
      ${templates.length ? templates.map((t) => `<div class="setting-row">
        <div class="setting-info"><div class="setting-name">${esc(t.name)}</div>
          <div class="setting-desc">${(t.exercises || []).length} 个动作 · ${esc((t.exercises || []).map((e) => e.name).join('、'))}</div></div>
        <div class="setting-actions">
          <button class="btn btn-ghost btn-sm" data-tedit="${t.id}">编辑</button>
          <button class="btn btn-danger btn-sm" data-tdel="${t.id}">删除</button>
        </div></div>`).join('') : '<div class="card-line" style="padding:12px 0">还没有模板。</div>'}
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:6px">数据备份与恢复</div>
      <div class="card-line" style="margin-bottom:8px">所有数据保存在当前设备的浏览器本地存储中。建议定期导出备份。</div>
      <div class="setting-row"><div class="setting-info"><div class="setting-name">导出备份</div>
        <div class="setting-desc">把当前全部数据另存为一个 JSON 文件。</div></div>
        <div class="setting-actions"><button class="btn btn-ghost btn-sm" id="exportBtn">导出</button></div></div>
      <div class="setting-row"><div class="setting-info"><div class="setting-name">恢复数据</div>
        <div class="setting-desc">从备份文件导入，覆盖前会自动再备份。</div></div>
        <div class="setting-actions"><button class="btn btn-ghost btn-sm" id="importBtn">选择文件</button></div></div>
      <input type="file" id="importFile" accept="application/json,.json" style="display:none">
    </div>
  </div>`;

  document.getElementById('goalBtnFromSettings').onclick = () => goalEditor(ctx);
  document.getElementById('addTplBtn').onclick = () => templateEditor(ctx);
  content.querySelectorAll('[data-tedit]').forEach((b) => b.onclick = () => templateEditor(ctx, templates.find((t) => t.id === b.dataset.tedit)));
  content.querySelectorAll('[data-tdel]').forEach((b) => b.onclick = async () => {
    const t = templates.find((x) => x.id === b.dataset.tdel);
    const ok = await confirmDialog({ title: '删除模板？', text: `删除模板「${esc(t.name)}」，已创建的计划不受影响。` });
    if (!ok) return;
    await store.deleteTemplate(t.id); toast('模板已删除'); renderSettings(ctx);
  });
  document.getElementById('exportBtn').onclick = () => exportBackup();
  document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = (e) => handleImport(ctx, e.target.files[0]);
}

async function templateEditor(ctx, tpl = null) {
  const isEdit = !!tpl;
  const names = await store.allExerciseNames();
  openModal(`
    <div class="modal-title">${isEdit ? '编辑模板' : '新建模板'}</div>
    <div class="modal-sub">填写一组动作，创建计划时可一键导入</div>
    <div class="modal-body">
      <div class="field"><label class="field-label">模板名称</label>
        <input class="input" id="tplName" placeholder="如 推日 / 拉日 / 腿部" value="${esc(tpl?.name || '')}"></div>
      <label class="field-label">动作列表</label>
      <div id="tplExList">${(tpl?.exercises || []).map((e) => tplExRow(e.name)).join('')}</div>
      ${datalistHTML(names)}
      <button class="add-ex-btn" id="tplAddEx">＋ 添加动作</button>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-cancel>取消</button>
      <button class="btn btn-primary" data-save>${isEdit ? '保存修改' : '创建模板'}</button>
    </div>
  `, { onMount: (root) => {
    const list = root.querySelector('#tplExList');
    const wire = (row) => { row.querySelector('[data-tremove]').onclick = () => row.remove(); };
    root.querySelectorAll('#tplExList > div').forEach(wire);
    root.querySelector('#tplAddEx').onclick = () => {
      const div = document.createElement('div');
      div.innerHTML = tplExRow('');
      const row = div.firstElementChild;
      list.appendChild(row); wire(row); row.querySelector('input').focus();
    };
    root.querySelector('[data-cancel]').onclick = closeModal;
    root.querySelector('[data-save]').onclick = async () => {
      const name = root.querySelector('#tplName').value.trim();
      if (!name) return toast('请填写模板名称', 'error');
      const exNames = Array.from(list.querySelectorAll('input')).map((i) => i.value.trim()).filter(Boolean);
      if (!exNames.length) return toast('请至少添加一个动作', 'error');
      if (isEdit) await store.updateTemplate(tpl.id, name, exNames);
      else await store.addTemplate(name, exNames);
      closeModal(); toast(isEdit ? '模板已更新' : '模板已创建'); renderSettings(ctx);
    };
  }});
}

function tplExRow(name) {
  return `<div style="display:flex;gap:10px;margin-bottom:10px">
    <input class="input ex-name-input" placeholder="动作名称" value="${esc(name || '')}" list="exNameList">
    <button class="icon-btn" data-tremove>${ICON_TRASH}</button>
  </div>`;
}

// ---------- 备份导出 / 恢复 ----------
export async function exportBackup() {
  const data = await store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `today-trained-backup-${store.today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('备份已导出');
  return data;
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: '文件格式不正确。' };
  if (!Array.isArray(data.records)) return { ok: false, error: '未找到记录数据。' };
  return {
    ok: true,
    data: {
      templates: Array.isArray(data.templates) ? data.templates : [],
      plans: Array.isArray(data.plans) ? data.plans : [],
      records: data.records,
      settings: Array.isArray(data.settings) ? data.settings : [],
      drafts: Array.isArray(data.drafts) ? data.drafts : [],
      schedules: Array.isArray(data.schedules) ? data.schedules : [],
    },
    counts: {
      templates: (data.templates || []).length,
      plans: (data.plans || []).length,
      records: data.records.length,
    },
  };
}

export async function handleImport(ctx, file) {
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    toast('文件不是有效的 JSON', 'error'); return;
  }
  const check = validateBackup(parsed);
  if (!check.ok) { toast(check.error, 'error'); return; }
  const c = check.counts;
  const ok = await confirmDialog({
    title: '确认恢复数据？', okText: '确认恢复', danger: false,
    text: `备份文件包含 <b>${c.templates}</b> 个模板、<b>${c.plans}</b> 个计划、<b>${c.records}</b> 条记录。<br>导入将覆盖当前全部数据，覆盖前会自动再备份一份。确定继续吗？`,
  });
  if (!ok) return;
  await exportBackup();
  await store.importAll(check.data);
  toast('数据已恢复');
  renderSettings(ctx);
}

/**
 * 业务数据层：模板 / 计划 / 记录 的增删改查。
 * 纯逻辑，不依赖 DOM，浏览器与 Node 测试共用。
 */
import * as db from './db.js';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
export const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function normalizeExercise(e) {
  return {
    id: e.id || uid(),
    name: String(e.name || '').trim(),
    weight: Number(e.weight) || 0,
    sets: Number(e.sets) || 0,
    reps: Number(e.reps) || 0,
  };
}

// ---------- 模板 ----------
export async function addTemplate(name, exerciseNames) {
  const t = {
    id: uid(),
    name: String(name || '').trim(),
    exercises: exerciseNames.filter(Boolean).map((n) => ({ id: uid(), name: String(n).trim() })),
    createdAt: Date.now(),
  };
  await db.put('templates', t);
  return t;
}

export async function updateTemplate(id, name, exerciseNames) {
  const t = await db.get('templates', id);
  if (!t) throw new Error('模板不存在');
  const old = t.exercises || [];
  t.name = String(name || '').trim();
  t.exercises = exerciseNames.filter(Boolean).map((n, i) => ({ id: old[i]?.id || uid(), name: String(n).trim() }));
  await db.put('templates', t);
  return t;
}

export async function deleteTemplate(id) {
  await db.del('templates', id);
}

export const getTemplates = () => db.getAll('templates');

// ---------- 计划 ----------
export async function addPlan(name, exercises, templateId = null) {
  const p = {
    id: uid(),
    name: String(name || '').trim(),
    templateId,
    exercises: exercises.filter((e) => e.name).map(normalizeExercise),
    createdAt: Date.now(),
  };
  await db.put('plans', p);
  return p;
}

export async function updatePlan(id, name, exercises) {
  const p = await db.get('plans', id);
  if (!p) throw new Error('计划不存在');
  const old = p.exercises || [];
  p.name = String(name || '').trim();
  p.exercises = exercises.filter((e) => e.name).map((e, i) => ({ ...normalizeExercise(e), id: old[i]?.id || uid() }));
  await db.put('plans', p);
  return p;
}

export async function deletePlan(id) {
  await db.del('plans', id);
}

export const getPlans = () => db.getAll('plans');

// ---------- 记录 ----------
export async function addRecord(planId, planName, exercises, date, note) {
  const r = {
    id: uid(),
    planId: planId || null,
    planName: String(planName || '').trim() || '自由训练',
    date: date || today(),
    note: String(note || '').trim(),
    exercises: exercises.filter((e) => e.name).map(normalizeExercise),
    createdAt: Date.now(),
  };
  await db.put('records', r);
  return r;
}

export async function updateRecord(id, planName, exercises, date, note) {
  const r = await db.get('records', id);
  if (!r) throw new Error('记录不存在');
  const old = r.exercises || [];
  r.planName = String(planName || '').trim() || '自由训练';
  r.date = date || r.date;
  r.note = String(note || '').trim();
  r.exercises = exercises.filter((e) => e.name).map((e, i) => ({ ...normalizeExercise(e), id: old[i]?.id || uid() }));
  await db.put('records', r);
  return r;
}

export async function deleteRecord(id) {
  await db.del('records', id);
}

export const getRecords = () => db.getAll('records');

/** 从计划生成当天记录（数据复制，不含引用依赖） */
export async function startTraining(planId) {
  const p = await db.get('plans', planId);
  if (!p) throw new Error('计划不存在');
  return addRecord(p.id, p.name, p.exercises, today(), '');
}

// ---------- 统计 ----------
/** 汇总所有记录中出现过的动作名（去重排序） */
export async function allExerciseNames() {
  const records = await getRecords();
  const names = new Map();
  for (const r of records) for (const e of r.exercises || []) if (e.name) names.set(e.name, true);
  return Array.from(names.keys()).sort((a, b) => a.localeCompare(b, 'zh'));
}

// ---------- 设置（每周训练目标） ----------
const WEEKLY_GOAL_KEY = 'weeklyGoal';
/** 读取每周目标次数，默认 3 */
export async function getWeeklyGoal() {
  const row = await db.get('settings', WEEKLY_GOAL_KEY);
  return row ? Number(row.value) : 3;
}
export async function setWeeklyGoal(value) {
  await db.put('settings', { id: WEEKLY_GOAL_KEY, value: Number(value) || 0 });
  return Number(value) || 0;
}

// ---------- 日期安排（周计划：哪天练哪个计划） ----------
/** 设置某天的安排：date 形如 2026-10-16，planId 为计划ID */
export async function setSchedule(date, planId, planName) {
  const row = { id: date, date, planId: planId || null, planName: planName || '', createdAt: Date.now() };
  await db.put('schedules', row);
  return row;
}
export async function clearSchedule(date) {
  await db.del('schedules', date);
}
export const getSchedules = () => db.getAll('schedules');
export const getSchedule = (date) => db.get('schedules', date);

// ---------- 进行中训练（未完成训练草稿） ----------
/** 为某天创建/继续一份进行中训练 */
export async function upsertDraft(date, planId, planName, exercises) {
  const existing = await db.get('drafts', date);
  const draft = {
    id: date,
    date,
    planId: planId || null,
    planName: planName || '自由训练',
    exercises: exercises.filter((e) => e.name).map((e) => ({ ...normalizeExercise(e), id: e.id || uid() })),
    updatedAt: Date.now(),
  };
  await db.put('drafts', draft);
  return draft;
}
export const getDraft = (date) => db.get('drafts', date);
export const getDrafts = () => db.getAll('drafts');
export async function removeDraft(date) {
  await db.del('drafts', date);
}
/** 把进行中训练完成为正式记录（草稿转记录） */
export async function finishDraft(date, planName, exercises, note) {
  const draft = await db.get('drafts', date);
  const record = await addRecord(draft?.planId || null, planName || draft?.planName, exercises, date, note);
  await db.del('drafts', date);
  return record;
}

// ---------- 周统计 ----------
/** 获取某日期所在周的周一~周日日期数组（周一开头） */
export function weekDates(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=周日
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const pad = (n) => String(n).padStart(2, '0');
    out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
  }
  return out;
}
/** 本周完成的训练次数（基于真实记录） */
export async function completedCountInWeek(dateStr) {
  const dates = new Set(weekDates(dateStr));
  const records = await getRecords();
  return records.filter((r) => dates.has(r.date)).length;
}

/** 备份 / 恢复 / 清空 */
export const exportAll = () => db.exportAll();
export const importAll = (data) => db.importAll(data);
export const clearAll = () => db.clearAll();

/**
 * 统计计算（纯函数）：基于真实记录，不做任何造假。
 */

/** 从记录列表中提取某动作的重量序列，按日期升序 */
export function seriesFor(records, exerciseName) {
  const series = [];
  for (const r of records) {
    for (const e of r.exercises || []) {
      if (e.name === exerciseName) {
        series.push({ date: r.date, weight: Number(e.weight) || 0, recordId: r.id });
      }
    }
  }
  series.sort((a, b) => a.date.localeCompare(b.date));
  return series;
}

/** 概览卡数值：当前 / 历史最高 / 较首次变化 / 记录次数 */
export function summary(series) {
  const n = series.length;
  if (!n) return { current: 0, best: 0, change: 0, count: 0 };
  const current = series[n - 1].weight;
  const best = Math.max(...series.map((s) => s.weight));
  const first = series[0].weight;
  return { current, best, change: Math.round((current - first) * 10) / 10, count: n };
}

/** 记录列表中所有动作名（去重排序） */
export function exerciseNames(records) {
  const set = new Set();
  for (const r of records) for (const e of r.exercises || []) if (e.name) set.add(e.name);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

/**
 * 生成 SVG 折线图（纯字符串），供浏览器直接插入。
 * 数据点按 series 顺序绘制，坐标由真实 weight 计算。
 */
export function lineChart(series, opts = {}) {
  const W = 760, H = 300;
  const padL = 52, padR = 24, padT = 24, padB = 48;
  const n = series.length;
  if (!n) return '<div class="chart-empty">该动作暂无重量记录</div>';
  const weights = series.map((s) => s.weight);
  const maxV = Math.max(...weights);
  const minV = Math.min(...weights);
  const span = maxV - minV || 1;
  const x = (i) => n === 1
    ? padL + (W - padL - padR) / 2
    : padL + i * (W - padL - padR) / (n - 1);
  const y = (v) => padT + (H - padT - padB) * (1 - (v - minV) / span);

  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const val = minV + span * g / 4;
    const gy = y(val);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#eef0f0" stroke-width="1"/>`
      + `<text x="${padL - 10}" y="${gy + 4}" text-anchor="end" font-size="11" fill="#9aa0a6">${Math.round(val)}</text>`;
  }
  const pts = series.map((s, i) => `${x(i)},${y(s.weight)}`).join(' ');
  const area = `${padL},${H - padB} ${pts} ${x(n - 1)},${H - padB}`;
  const dots = series.map((s, i) => `
    <circle cx="${x(i)}" cy="${y(s.weight)}" r="4.5" fill="#fff" stroke="#2f9e52" stroke-width="2.5"/>
    <text x="${x(i)}" y="${y(s.weight) - 12}" text-anchor="middle" font-size="11" fill="#5f6368">${s.weight}</text>`).join('');
  const step = n > 8 ? Math.ceil(n / 6) : 1;
  const labels = series.map((s, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    return `<text x="${x(i)}" y="${H - padB + 22}" text-anchor="middle" font-size="10" fill="#9aa0a6">${s.date.slice(5)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="重量趋势折线图">
    ${grid}
    <polygon points="${area}" fill="#e7f4ec" opacity="0.55"/>
    <polyline points="${pts}" fill="none" stroke="#2f9e52" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

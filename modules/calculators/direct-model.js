// direct-model.js — ПРЯМАЯ (плотностная) модель снежного покрова. ИССЛЕДОВАТЕЛЬСКИЙ СТЕНД.
//
// Статус: НЕ используется в боте (обратная задача — оценка возраста по глубине — на этой
// модели разрушается: 3-7 MAE 6.085 против 2.707 у внедрённой kn0, см. INTEGRATION_README.md).
// Лежит в репозитории как проект на будущее (плотность, таяние, перекалибровка других регионов).
//
// Воспроизводит локальный стенд (analyze_final_sweep.js, эпохи Open-Meteo):
//   forward test MAE 2024-25: 2.314 (плотность, melt=0) · 2.087 (melt=2) · 2.021 (G0=0.4, melt=8).
// Полная валидация требует локальные данные (om_epochs.json, snow_long_nast.csv) — см. README.md.
//
// Отличия от внедрённой tracker-tool.js:
//   - плотность слоя ρ(T) учитывается: оседание ~ (ρ_ref/ρ)^g, слой снега h = P·G0·(ρ_ref/ρ);
//   - влажность RH в плотности: r = ρ(T)·(1 + c·(RH−82)/100) (+ ветер через ww, по умолчанию 0);
//   - таяние per-layer на эпохах T≥0 ВНУТРИ цикла слоёв (слои под настом защищены);
//   - нет стартового слоя H0: глубина = накопленный снег за окно (H_start = 0).
'use strict';

const EPOCH_DAYS = 0.25;   // суток на метео-эпоху (4 эпохи в сутках)
const RHO_REF = 0.09;      // опорная плотность, г/см³

// Конфигурация по умолчанию — лучшая наблюдённая комбинация стенда (melt=2, умеренный/физичный).
const DEFAULT_CFG = {
  G0: 0.45,   // коэффициент снегопада (см высоты на мм осадков при ρ=ρ_ref)
  g: 1,       // показатель ρ в оседании
  c: 1.5,     // чувствительность плотности к влажности RH (на 1% сверх 82%)
  ww: 0,      // чувствительность к ветру (стенд: не подтвердилась, 0)
  tau: 3,     // старение: S = 1/(1+(age/τ)^γ)
  gam: 2,
  K: 0.0264,  // скорость оседания при 0 °C (как в tracker-tool.js)
  C: 0.136,   // температурная чувствительность оседания (Arrhenius-экспонента)
  melt: 2,    // таяние на эпохах T≥0: h *= exp(−melt·Δt)
  form: 'mult' // 'mult' — экспоненциальное таяние; 'abs' — вычитание melt·Δt
};

// ---------- даты (ISO-строки) ----------
function _parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error('bad date: ' + s);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
}

// ---------- плотность свежевыпавшего снега по температуре, г/см³ ----------
// Якоря: −20 → 0.05, −10 → 0.09, −2 → 0.17, 0 → 0.28 (линейная интерполяция).
function rhoOf(T) {
  if (T <= -20) return 0.05;
  if (T >= 0) return 0.28;
  if (T < -10) return 0.05 + (T + 20) / 10 * 0.04;
  if (T < -2) return 0.09 + (T + 10) / 8 * 0.08;
  return 0.17 + (T + 2) / 2 * 0.11;
}

// ---------- наст (ледяная корка): оттепель+осадки либо сумма тёплых T ----------
function isNast(ep, prev) {
  const s = Math.max(ep.T, 0) + (prev ? Math.max(prev.T, 0) : 0);
  return s > 10 || (ep.T > 0 && ep.P > 0);
}

/**
 * Прямая модель: глубина снега в конце окна [startDate, endDate], если снег начал
 * накапливаться с пустой поверхности. Эпохи — массив {date (ISO), rank, T, P, type}
 * ('снег' | 'дождь' | ''). Влажность/ветер — необязательно через cfg.wx = {date: {hum, wind}}.
 *
 * @param {string} season        — сезон (для совместимости с tracker-tool.js; не используется)
 * @param {string} startDate     — дата начала окна (ISO)
 * @param {string} endDate       — дата замера (ISO)
 * @param {object} [cfg]         — конфигурация (DEFAULT_CFG по умолчанию)
 * @param {object[]} [externalEpochs] — эпохи (обязательно; см. README про getEpochs)
 * @returns {number} глубина H, см
 */
function fwd(season, startDate, endDate, cfg = DEFAULT_CFG, externalEpochs = null) {
  const c = Object.assign({}, DEFAULT_CFG, cfg || {});
  const wx = c.wx || {};
  const s0 = _parseISO(startDate), s1 = _parseISO(endDate);
  const eps = [];
  for (const e of externalEpochs || []) {
    const ed = _parseISO(e.date);
    if (ed < s0 || ed > s1) continue;
    eps.push({ date: e.date, rank: e.rank, T: e.T, P: e.P, type: e.type });
  }
  const layers = [];
  let crustEpoch = null;
  for (let i = 0; i < eps.length; i++) {
    const ep = eps[i], prev = i > 0 ? eps[i - 1] : null;
    if (crustEpoch === null && isNast(ep, prev)) crustEpoch = i;
    for (let j = 0; j < layers.length; j++) {
      if (crustEpoch !== null && layers[j].born < crustEpoch) continue; // заморожен под настом
      const ageDays = (i - layers[j].born) * EPOCH_DAYS;
      const S = 1 / (1 + Math.pow(ageDays / c.tau, c.gam)); // старение (метаморфоз)
      layers[j].h *= Math.exp(-c.K * Math.exp(c.C * ep.T) * EPOCH_DAYS * S * Math.pow(RHO_REF / layers[j].rho, c.g));
      if (c.melt > 0 && ep.T >= 0) {
        if (c.form === 'mult') layers[j].h *= Math.exp(-c.melt * EPOCH_DAYS);
        else layers[j].h = Math.max(0, layers[j].h - c.melt * EPOCH_DAYS);
      }
    }
    if (ep.type === 'снег') {
      const w = wx[ep.date] || {};
      const rh = w.hum === undefined ? 82 : w.hum;
      const v = w.wind === undefined ? 0 : w.wind;
      const r = rhoOf(ep.T) * (1 + c.c * (rh - 82) / 100) * (1 + c.ww * v);
      layers.push({ h: ep.P * c.G0 * (RHO_REF / r), born: i, rho: r });
    } else if (ep.type === 'дождь') {
      // KTAI=0: дождь не снимает высоту (как в стенде); удаляем только обнулившиеся слои
      const kept = [];
      for (const L of layers) if (L.h > 1e-9) kept.push(L);
      layers.length = 0;
      for (const L of kept) layers.push(L);
    }
  }
  let H = 0;
  for (const L of layers) H += L.h;
  return H;
}

// ---------- демо (без внешних данных) ----------
function demo() {
  // Синтетическое окно: снегопад 3 мм при −12 °C, затем 3 дня без осадков.
  const eps = [];
  const days = [
    ['2025-01-10', -12, 3, 'снег'],
    ['2025-01-11', -8, 0, ''],
    ['2025-01-12', -5, 0, ''],
    ['2025-01-13', 2, 0, ''],   // тёплый день — таяние
  ];
  for (const [date, T, P, type] of days) {
    for (let rank = 0; rank < 4; rank++) eps.push({ date, rank, T, P, type });
  }
  const H0 = fwd('2025', '2025-01-10', '2025-01-13', { ...DEFAULT_CFG, melt: 0 }, eps);
  const Hm = fwd('2025', '2025-01-10', '2025-01-13', { ...DEFAULT_CFG, melt: 8 }, eps);
  console.log(`demo: H(melt=0) = ${H0.toFixed(3)} см, H(melt=8) = ${Hm.toFixed(3)} см`);
  if (!(Hm < H0)) { console.error('FAIL: таяние должно уменьшать H'); process.exit(1); }
  if (!(H0 > 0)) { console.error('FAIL: снегопад должен давать ненулевую H'); process.exit(1); }
  console.log('DEMO OK — прямая модель работает (плотность + старение + наст + таяние)');
}

module.exports = { DEFAULT_CFG, rhoOf, isNast, fwd };
if (require.main === module && process.argv.includes('--demo')) demo();

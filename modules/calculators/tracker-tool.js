// tracker-tool.js — JS-порт tracker_tool.py (послойная модель + обратный поиск + патчи «не знаю»).
// Проверен на совпадение с Python на примерах 2024-25 (см. test-tracker-js.js).
// Источник эпох: epochs.json (дневник) по умолчанию; эпохи можно передать извне (Open-Meteo getEpochs).
'use strict';

const fs = require('fs');
const path = require('path');

// Калибровка на эпохах Open-Meteo (2025-11): KN=0.60, H0=0.50 — recall 0-2 = 0.957 на 2024-25;
// старая калибровка (KN=0.50, H0=0.20) сохранена в tracker-tool_backup.json.
const KREF = 0.0264, C = 0.136, KN = 0.60, KTAI = 0.0, H0 = 0.50, EPOCH_DAYS = 0.25;
const SEASONS = ['2022-23', '2023-24', '2024-25'];

// ---------- эпохи из дневника (JSON) ----------
const _DIARY = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'epochs.json'), 'utf8')
);

function _epochs(season, externalEpochs) {
    if (externalEpochs) return externalEpochs;
    return _DIARY[season] || [];
}

function _epochDateSet(season, externalEpochs) {
    const s = new Set();
    for (const e of _epochs(season, externalEpochs)) s.add(e.date);
    return s;
}

// ---------- даты (ISO-строки) ----------
function _parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error('bad date: ' + s);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
function _addDays(s, t) {
    const d = _parseISO(s);
    d.setUTCDate(d.getUTCDate() + t);
    return d.toISOString().slice(0, 10);
}
function _daysDiff(a, b) { // a - b в днях (ISO-строки)
    return Math.round((_parseISO(a) - _parseISO(b)) / 86400000);
}

// ---------- прямое округление как в Python (f"{x:.1f}" / round(x,1), half-even) ----------
function _roundHalfEven(x, nd) {
    const m = Math.pow(10, nd);
    const y = x * m;
    const f = Math.floor(y);
    const diff = y - f;
    let r;
    if (diff < 0.5) r = f;
    else if (diff > 0.5) r = f + 1;
    else r = (f % 2 === 0) ? f : f + 1; // ровно .5 → к чётному
    return r / m;
}
function _fmt1(x) { // как f"{x:.1f}"
    return _roundHalfEven(x, 1).toFixed(1);
}

// ---------- track_epochs (порт epochs.track_epochs) ----------
function trackEpochs(season, startDate, endDate, startRank = 0, endRank = 3, externalEpochs = null) {
    const all = _epochs(season, externalEpochs);
    const res = [];
    for (const ep of all) {
        if (ep.date < startDate || ep.date > endDate) continue;
        if (ep.date === startDate && ep.rank < startRank) continue;
        if (ep.date === endDate && ep.rank > endRank) continue;
        res.push(ep);
    }
    return res;
}

// ---------- tmax_epochs ----------
function tmaxEpochs(season, D, externalEpochs = null) {
    const ds = _epochDateSet(season, externalEpochs);
    for (let t = 0; t < 31; t++) {
        if (!ds.has(_addDays(D, -t))) return Math.max(0, t - 1);
    }
    return 30;
}

// ---------- is_nast_epoch (порт epochs.is_nast_epoch) ----------
function isNastEpoch(ep, prev) {
    const s = Math.max(ep.T, 0) + (prev ? Math.max(prev.T, 0) : 0);
    return s > 10 || (ep.T > 0 && ep.P > 0);
}

// ---------- даты наста из архива ----------
function nastDates(season, D, lookback = 30, externalEpochs = null) {
    const eps = _epochs(season, externalEpochs);
    const dateSet = new Set();
    for (const e of eps) {
        if (e.date <= D && _daysDiff(D, e.date) <= lookback) dateSet.add(e.date);
    }
    const dates = Array.from(dateSet).sort(); // ISO-строки сортируются хронологически
    const nast = [];
    for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        const day = eps.filter(e => e.date === d);
        const warmRain = day.some(e => e.T > 0 && e.P > 0);
        let freeze = null;
        if (i + 1 < dates.length) {
            const nxt = eps.filter(e => e.date === dates[i + 1]);
            if (nxt.length && nxt.every(e => e.T < 0)) freeze = dates[i + 1];
        }
        if (warmRain && freeze !== null) nast.push([d, freeze]);
    }
    return nast; // [[день оттепели/дождя, день заморозки], ...]
}

// ---------- послойная прямая модель ----------
function forward(season, startDate, endDate, crustMode = 'auto', HStart = null, externalEpochs = null) {
    const eps = trackEpochs(season, startDate, endDate, 0, 3, externalEpochs);
    const layers = [{ h: (HStart === null ? H0 : HStart), born: -1 }];
    let crustEpoch = null;
    if (crustMode === 'yes') {
        const nd = nastDates(season, endDate, 30, externalEpochs);
        const ndF = nd.filter(p => p[1] >= startDate); // только насты в окне
        if (ndF.length) {
            const freezeDate = ndF[ndF.length - 1][1];
            for (let i = 0; i < eps.length; i++) {
                if (eps[i].date >= freezeDate) { crustEpoch = i; break; }
            }
        }
        // наст раньше окна — не замораживаем (crustEpoch = null)
    }
    for (let i = 0; i < eps.length; i++) {
        const ep = eps[i];
        const prev = i > 0 ? eps[i - 1] : null;
        if (crustMode === 'auto' && crustEpoch === null && isNastEpoch(ep, prev)) {
            crustEpoch = i;
        }
        for (const L of layers) {
            if (crustEpoch !== null && L.born < crustEpoch) continue; // заморожен под настом
            L.h *= Math.exp(-KREF * Math.exp(C * ep.T) * EPOCH_DAYS);
        }
        if (ep.type === 'снег') {
            layers.push({ h: KN * ep.P, born: i });
        } else if (ep.type === 'дождь') {
            let rem = KTAI * Math.max(ep.T, 0) * ep.P;
            for (let j = layers.length - 1; j >= 0 && rem > 0; j--) {
                const L = layers[j];
                const d = Math.min(L.h, rem);
                L.h -= d;
                rem -= d;
            }
            const kept = [];
            for (const L of layers) if (L.h > 1e-9) kept.push(L);
            layers.length = 0;
            layers.push(...kept);
        }
    }
    let H = 0;
    for (const L of layers) H += L.h;
    return H;
}

// ---------- estimateAge с патчами «не знаю» ----------
function estimateAge(season, D, H, crustMode = 'auto', minHistory = 10, externalEpochs = null) {
    const res = { status: null, age: null, age_range: null, warnings: [], nast_date: null, t_max: null, sigma: null };
    H = Number(H);
    const tm = tmaxEpochs(season, D, externalEpochs);
    res.t_max = tm;
    if (tm < minHistory) {
        res.status = 'недостаточно данных';
        return res;
    }
    // наст из архива — только свежие <= 14 дней
    const nd = nastDates(season, D, 30, externalEpochs);
    if (nd.length) {
        const ndFresh = nd.filter(p => _daysDiff(D, p[1]) <= 14);
        if (ndFresh.length) res.nast_date = ndFresh[ndFresh.length - 1][1];
    }
    // обратный поиск
    const errs = [];
    for (let t = 0; t <= tm; t++) {
        const d0 = _addDays(D, -t);
        const Hp = forward(season, d0, D, crustMode, null, externalEpochs);
        errs.push(Math.abs(Hp - H));
    }
    let tStar = 0;
    for (let i = 1; i <= tm; i++) if (errs[i] < errs[tStar]) tStar = i; // первый минимум (как argmin)
    const emin = errs[tStar];
    // непрерывный интервал правдоподобных t вокруг t*
    let lo = tStar;
    while (lo > 0 && errs[lo - 1] <= emin + 1.0) lo--;
    let hi = tStar;
    while (hi < tm && errs[hi + 1] <= emin + 1.0) hi++;
    const width = hi - lo;
    let sigma = 0.0;
    if (width > 0) {
        const vals = [];
        for (let v = lo; v <= hi; v++) vals.push(v);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        sigma = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length);
    }
    res.sigma = Math.round(sigma * 100) / 100;
    res.age_range = [lo, hi];
    // патч 1: t* > 10
    if (tStar > 10) {
        res.status = 'неопределима';
        res.warnings.push('возраст > 10 дней — давность неопределима');
        res.warnings = Array.from(new Set(res.warnings));
        return res;
    }
    // патч 2: резкий снегопад (P>5 при T<-5) за последние 3 дня
    const eps = _epochs(season, externalEpochs);
    for (const e of eps) {
        if (e.date <= D && _daysDiff(D, e.date) <= 3 && e.P > 5 && e.T < -5) {
            res.warnings.push('возможна ошибка из-за уплотнения (резкий снегопад в последние 3 дня)');
            break;
        }
    }
    // патч 3: наст в истории (T>0 + P>0)
    for (const e of eps) {
        if (e.date <= D && _daysDiff(D, e.date) <= 30 && e.T > 0 && e.P > 0) {
            res.warnings.push('возможна ошибка, проверьте вручную (в истории была оттепель/дождь)');
            break;
        }
    }
    // патч 4: интервал шире 7 суток → неопределима
    if (width > 7) {
        res.status = 'неопределима';
        res.warnings.push('слишком широкий интервал правдоподобных возрастов — давность неопределима');
        res.warnings = Array.from(new Set(res.warnings));
        return res;
    }
    // патч 5: σ > 2 → диапазон
    if (sigma > 2.0) {
        res.status = 'диапазон';
        res.age_range = [lo, hi];
        res.warnings = Array.from(new Set(res.warnings));
        return res;
    }
    res.status = 'ok';
    res.age = tStar;
    res.warnings = Array.from(new Set(res.warnings));
    return res;
}

// ---------- цепочка замеров ----------
function estimateChain(season, visitDate, depths, crustMode = 'auto', externalEpochs = null) {
    depths = depths.map(d => Number(d));
    const H = Math.min(...depths);
    const spread = Math.max(...depths) - H;
    const out = {
        n_замеров: depths.length,
        n_следов: depths.length,
        глубина_мин: _roundHalfEven(H, 1),
        разброс: _roundHalfEven(spread, 1),
        неравномерный: spread > 3.0,
        строки: [`Глубина: минимум ${_fmt1(H)} см (разброс ${_fmt1(spread)} см)`],
    };
    if (spread > 3.0) out.строки.push('след неравномерный, широкий интервал');
    out['оценка'] = estimateAge(season, visitDate, H, crustMode, 10, externalEpochs);
    // логирование (не должно ломать инструмент)
    try {
        const logPath = path.join(__dirname, 'tracker_log.txt');
        fs.appendFileSync(logPath,
            `${new Date().toISOString()} | season=${season} | visit=${visitDate} | depths=[${depths.join(', ')}] | ` +
            `H_min=${out.глубина_мин} | n_следов=${out.n_следов} | spread=${out.разброс} | result=${formatEstimate(out['оценка'])}\n`, 'utf8');
    } catch (e) { /* ignore */ }
    return out;
}

// ---------- форматирование ----------
function formatEstimate(est) {
    let s;
    if (est.status === 'недостаточно данных') s = 'недостаточно данных (история погоды < 10 дней)';
    else if (est.status === 'неопределима') s = 'давность неопределима';
    else if (est.status === 'диапазон') s = `давность ≈ ${est.age_range[0]}–${est.age_range[1]} дней`;
    else s = `давность ≈ ${est.age} дней`;
    if (est.nast_date) s += ` (наст по архиву: ~${est.nast_date})`;
    return s;
}

function formatForBot(est, chainResult = null) {
    const lines = [];
    if (chainResult) {
        lines.push(`📍 Глубина: ${chainResult.глубина_мин} см (разброс ${chainResult.разброс} см)`);
        if ((chainResult.n_следов || chainResult.n_замеров) < 3) lines.push('⚠️ Замеров меньше 3 — цепь неполная, точность ниже.');
        if (chainResult.неравномерный) lines.push('⚠️ Разброс > 3 см — возможен намет или разные условия. Проверьте, что замеры в разных следах цепи.');
    }
    if (est.status === 'недостаточно данных') lines.push('🎯 Давность: недостаточно данных');
    else if (est.status === 'неопределима') lines.push('🎯 Давность: неопределима');
    else if (est.status === 'диапазон') lines.push(`🎯 Давность: ≈${est.age_range[0]}–${est.age_range[1]} дней`);
    else lines.push(`🎯 Давность: ≈${est.age} дней`);
    if (est.nast_date) lines.push(`🧊 Наст по архиву: ~${est.nast_date}`);
    for (const w of est.warnings || []) lines.push(`⚠️ ${w}`);
    return lines.join('\n');
}

module.exports = {
    SEASONS, forward, estimateAge, estimateChain, nastDates, tmaxEpochs,
    formatEstimate, formatForBot, isNastEpoch,
};

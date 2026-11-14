// Тест фиксов A (структуры: крупные иначе все), B (выбор по подтверждённым), C+D (guard по inliers)
let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

// ===== A: структуры — крупные (>=3) если есть, иначе все >=1 =====
function pickStructures(structures) {
    const all = structures.filter(s => s.triangleIds.size >= 1);
    const large = all.filter(s => s.triangleIds.size >= 3);
    return large.length > 0 ? large : all;
}
const photo3 = [23, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(n => ({ triangleIds: { size: n } }));
const photo4 = [1, 1, 1, 1, 1, 1, 1, 1].map(n => ({ triangleIds: { size: n } }));
const a3 = pickStructures(photo3);
const a4 = pickStructures(photo4);
check('A: фото 3 (крупные есть) → только 2 крупные', a3.length === 2 && a3.every(s => s.triangleIds.size >= 3));
check('A: фото 4 (крупных нет) → все 8 однотреугольных', a4.length === 8);

// ===== B: выбор структуры по числу подтверждённых точек =====
function selectBest(results) {
    let best = null, bestTotal = 0;
    for (const r of results) {
        const t = (r.results ? (r.results.confirmed?.length || 0) + (r.results.anchors?.length || 0) : 0);
        if (!best || t > bestTotal) { best = r; bestTotal = t; }
    }
    return best;
}
const good = { transform: { scale: 0.175 }, results: { confirmed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], anchors: [1, 2, 3] } };
const bad = { transform: { scale: 0.286 }, results: { confirmed: [1, 2], anchors: [1] } };
const b = selectBest([bad, good]);
check('B: выбирается структура с БОЛЬШЕ подтверждённых (good, scale 0.175), не scale≈1', b === good);

// ===== C: guard по inliers (согласованное подмножество ≥5, ошибка ≤10px) =====
function guardCheck(pairs, transform) {
    let guardPoints = 0, guardInliers = 0;
    const apply = (p, t) => ({ x: p.x * t.scale, y: p.y * t.scale });
    for (const m of pairs) {
        guardPoints++;
        const proj = apply(m.photo, transform);
        if (Math.hypot(m.model.x - proj.x, m.model.y - proj.y) <= 10) guardInliers++;
    }
    const guardErrorOk = guardPoints < 5 || guardInliers >= 5;
    const guardScaleOk = transform.scale > 0.1 && transform.scale < 10;
    return { ok: guardErrorOk && guardScaleOk, guardInliers, guardPoints };
}
const pair = (px, mx) => ({ photo: { x: px, y: 0 }, model: { x: mx, y: 0 } });
// фото 4: scale 0.175; хорошая пара: photo 600 → proj 600*0.175=105 ≈ model 105 (ошибка ~0)
const dirtyPairs = [...Array(6)].map(() => pair(600, 105)).concat([...Array(23)].map(() => pair(600, 800)));
const c4 = guardCheck(dirtyPairs, { scale: 0.175 });
check('C: фото 4 (6 inliers из 29) → ПРОПУСК', c4.ok === true && c4.guardInliers === 6);
// фото 2: 107 пар, ~100 inliers → ПРОПУСК (раньше median 32.1 → отклонение)
const p2pairs = [...Array(100)].map(() => pair(50, 52)).concat([...Array(7)].map(() => pair(50, 600)));
check('C: фото 2 (100 inliers из 107) → ПРОПУСК', guardCheck(p2pairs, { scale: 0.963 }).ok === true);
// блот-кейс: мусор, 1 inlier, scale 2.3 → ОТКЛОНЕНИЕ
const bloat = [...Array(20)].map(() => pair(50, 900));
check('C: блот (1 inlier, scale 2.3) → ОТКЛОНЕНИЕ', guardCheck(bloat, { scale: 2.3 }).ok === false);
// мало пар (<5) → ПРОПУСК
check('C: 3 пары → ПРОПУСК', guardCheck([pair(50, 52), pair(60, 62), pair(70, 72)], { scale: 1.0 }).ok === true);

// ===== D: сливаем только inlier-пары =====
function filterInliers(pairs, transform) {
    const apply = (p, t) => ({ x: p.x * t.scale, y: p.y * t.scale });
    return pairs.filter(m => {
        const proj = apply(m.photo, transform);
        return Math.hypot(m.model.x - proj.x, m.model.y - proj.y) <= 10;
    });
}
const d = filterInliers(dirtyPairs, { scale: 0.175 });
check('D: в слияние идут только согласованные (6 из 29)', d.length === 6);

// ===== E: финальный консенсус по парам (реальный ValidationModule) =====
const VM = require('../modules/footprint/validation/ValidationModule');
const vm = Object.create(VM.prototype);
// фото 4: 25 финальных пар — 7 хороших (истинный transform scale 0.175, rot -0.712, tx -61.7, ty 387.9)
const T4 = { scale: 0.175, rotation: -0.712, translation: { x: -61.7, y: 387.9 } };
const apply4 = (p, t) => ({
    x: p.x * t.scale * Math.cos(t.rotation) - p.y * t.scale * Math.sin(t.rotation) + t.translation.x,
    y: p.x * t.scale * Math.sin(t.rotation) + p.y * t.scale * Math.cos(t.rotation) + t.translation.y
});
const seed4 = 1234;
let s4 = seed4;
const rnd4 = () => (s4 = (s4 * 1103515245 + 12345) % 2147483648) / 2147483648;
const ftA = [], ftB = [];
for (let i = 0; i < 7; i++) {   // хорошие
    const p = { x: 200 + i * 70, y: 180 + (i % 2) * 55 };
    ftA.push(p);
    const q = apply4(p, T4);
    q.x += rnd4() - 0.5; q.y += rnd4() - 0.5;
    ftB.push(q);
}
for (let i = 0; i < 18; i++) {  // мусорные
    ftA.push({ x: 800 + rnd4() * 800, y: 800 + rnd4() * 800 });
    ftB.push({ x: 2000 + rnd4() * 800, y: 2000 + rnd4() * 800 });
}
const e = vm._robustConsensusFit(ftA, ftB);
check('E: финальный консенсус по 25 парам → найден (не null)', e !== null);
check('E: transform ≈ истинный (scale/rot/сдвиг)',
    e !== null && Math.abs(e.scale - 0.175) < 0.05 && Math.abs(e.rotation - (-0.712)) < 0.05 &&
    Math.abs(e.translation.x - (-61.7)) < 25 && Math.abs(e.translation.y - 387.9) < 25);

// ===== F: контур следа как ограничитель (Фаза 10.6) =====
function pointInOutline(px, py, outlinePoints) {
    if (!outlinePoints || outlinePoints.length < 3) return true;
    let inside = false;
    for (let i = 0, j = outlinePoints.length - 1; i < outlinePoints.length; j = i++) {
        const xi = outlinePoints[i].x, yi = outlinePoints[i].y;
        const xj = outlinePoints[j].x, yj = outlinePoints[j].y;
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}
const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
check('F: точка внутри → true', pointInOutline(50, 50, square) === true);
check('F: точка снаружи → false', pointInOutline(150, 50, square) === false);
check('F: точка за контуром (далеко) → false', pointInOutline(300, 300, square) === false);
check('F: нет контура → true (не ограничиваем)', pointInOutline(50, 50, null) === true);

console.log(fail === 0 ? '\n🎉 A+B+C+D+E+F OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

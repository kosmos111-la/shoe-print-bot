// Тест ШАГ 3 (вариант B): робастный консенсус transform.
// - _robustConsensusFit: чистый случай, грязный 6/24 (ключевой), вырожденные.
// - calculateTransform: интеграция (возвращает консенсус для грязного набора).
const VM = require('../modules/footprint/validation/ValidationModule');
const vm = Object.create(VM.prototype);

// Детерминированный LCG для воспроизводимости
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rndIn = (lo, hi) => lo + rnd() * (hi - lo);

// Известный transform: scale 1.2, rotation 0.3, translation (50, -30)
const T = { scale: 1.2, rotation: 0.3, translation: { x: 50, y: -30 } };
const apply = (p, t) => ({
    x: p.x * t.scale * Math.cos(t.rotation) - p.y * t.scale * Math.sin(t.rotation) + t.translation.x,
    y: p.x * t.scale * Math.sin(t.rotation) + p.y * t.scale * Math.cos(t.rotation) + t.translation.y
});
const close = (got, want, tol) => Math.abs(got - want) < tol;

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

// ---------- 1) ЧИСТЫЙ случай: 6 хороших пар ----------
const goodA = [], goodB = [];
for (let i = 0; i < 6; i++) {
    const p = { x: 200 + i * 70, y: 180 + (i % 2) * 55 };
    goodA.push(p);
    const q = apply(p, T);
    q.x += rndIn(-0.5, 0.5); q.y += rndIn(-0.5, 0.5);
    goodB.push(q);
}
const r1 = vm._robustConsensusFit(goodA, goodB);
check('чистый: консенсус найден', r1 !== null);
check('чистый: inliers = все 6 (или ≥5)',
    r1 !== null && close(r1.scale, 1.2, 0.05) && close(r1.rotation, 0.3, 0.05));

// ---------- 2) ГРЯЗНЫЙ случай (ключевой): 6 хороших + 18 мусорных ----------
const dirtyA = [...goodA.map(p => ({ ...p }))];
const dirtyB = [...goodB.map(p => ({ ...p }))];
for (let i = 0; i < 18; i++) {
    // мусор: фото-точка и «модельная» точка в далёком регионе (несовместимы с T)
    dirtyA.push({ x: rndIn(800, 1600), y: rndIn(800, 1600) });
    dirtyB.push({ x: rndIn(2000, 2800), y: rndIn(2000, 2800) });
}
const r2 = vm._robustConsensusFit(dirtyA, dirtyB);
check('грязный 6/24: консенсус найден (не null)', r2 !== null);
check('грязный 6/24: transform ≈ известный (scale/rot)', r2 !== null &&
    close(r2.scale, 1.2, 0.08) && close(r2.rotation, 0.3, 0.08));
check('грязный 6/24: translation ≈ (50,-30)', r2 !== null &&
    close(r2.translation.x, 50, 25) && close(r2.translation.y, -30, 25));

// ---------- 3) ВЫРОЖДЕННЫЕ ----------
check('2 якоря → null', vm._robustConsensusFit(goodA.slice(0, 2), goodB.slice(0, 2)) === null);
check('разные длины → null', vm._robustConsensusFit(goodA, goodB.slice(0, 4)) === null);
check('пустые → null', vm._robustConsensusFit([], []) === null);

// 3 несовместимые пары (треугольники НЕ подобны) → нет консенсуса ≥3 → null
const incA = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
const incB = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 800 }];  // не подобен A
check('3 несовместимые пары → null', vm._robustConsensusFit(incA, incB) === null);

// ---------- 4) ИНТЕГРАЦИЯ: calculateTransform на грязном наборе ----------
const graphA = { nodes: new Map() }, graphB = { nodes: new Map() };
const anchors = [];
for (let i = 0; i < dirtyA.length; i++) {
    const pa = `p${i}`, mb = `m${i}`;
    graphA.nodes.set(pa, { id: pa, x: dirtyA[i].x, y: dirtyA[i].y, confidence: 0.9 });
    graphB.nodes.set(mb, { id: mb, x: dirtyB[i].x, y: dirtyB[i].y, confidence: 0.9 });
    anchors.push({ pointA: pa, pointB: mb, confidence: 0.9 });
}
const r4 = vm.calculateTransform(anchors, graphA, graphB);
check('calculateTransform (грязный): вернул transform', r4 !== null);
check('calculateTransform (грязный): transform ≈ известный',
    r4 !== null && close(r4.scale, 1.2, 0.08) && close(r4.rotation, 0.3, 0.08));

console.log(fail === 0 ? '\n🎉 робастный консенсус (ШАГ 3/B) OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

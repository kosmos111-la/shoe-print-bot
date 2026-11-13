// Тест F1+F2: лучи не рисуются через мусорный transform; структуры отвергнутого шага не показываются.

// --- F1: реплика serializeRays (только ключевая логика) ---
function serializeRaysReplica(model) {
    const out = [];
    const graphNodes = model && model.graph && model.graph.nodes;
    for (const s of (model && model.structures) || []) {
        const t = s.transform || null;
        const tValid = !!(t && t.scale > 0 && t.scale >= 0.5 && t.scale <= 2 && Number.isFinite(t.rotation));
        for (const r of (s.rays || [])) {
            const from = r.fromPoint, to = r.toPoint;
            if (!from || !to) continue;
            let toX = to.x, toY = to.y, toIsModel = false, transformInvalid = false;
            if (graphNodes && to.id !== undefined && to.id !== null &&
                (graphNodes instanceof Map ? graphNodes.has(to.id) : Object.prototype.hasOwnProperty.call(graphNodes, to.id))) {
                if (tValid) {
                    const inv = inverseApplyTransform({ x: to.x, y: to.y }, t);
                    toX = inv.x; toY = inv.y;
                    toIsModel = true;
                } else {
                    toX = to.x; toY = to.y;
                    toIsModel = true;
                    transformInvalid = true;
                }
            }
            out.push({ x1: from.x, y1: from.y, x2: toX, y2: toY, toIsModel, transformInvalid });
        }
    }
    return out;
}
function inverseApplyTransform(point, transform) {
    if (!transform || !(transform.scale > 0)) return { x: point.x, y: point.y };
    const { scale, rotation } = transform;
    const tx = transform.tx ?? (transform.translation ? transform.translation.x : 0);
    const ty = transform.ty ?? (transform.translation ? transform.translation.y : 0);
    const dx = point.x - tx, dy = point.y - ty;
    const cosR = Math.cos(rotation), sinR = Math.sin(rotation);
    return { x: (dx * cosR + dy * sinR) / scale, y: (-dx * sinR + dy * cosR) / scale };
}

// --- F2: реплика детекта отклонения ---
function detectMergeRejected(logs) {
    return logs.some(l =>
        /ПРЕДОХРАНИТЕЛЬ: слияние ОТМЕНЕНО|transform_guard|validation_failed|transform_failed|Улучшение модели не удалось/.test(l)
    );
}
function buildPayloadReplica(payload, mergeRejected) {
    if (mergeRejected) {
        payload.matchMap = [];
        payload.matchedTriangles = [];
        payload.rays = [];
        payload.mergeRejected = true;
    }
    return payload;
}

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

const graphNodes = new Map([['m_1', {}]]);
const model = (transform, toId) => ({
    graph: { nodes: graphNodes },
    structures: [{ transform, rays: [{ fromPoint: { id: 'p_a', x: 100, y: 200 }, toPoint: { id: toId, x: 500, y: 700 } }] }]
});

// 1) Валидный transform (scale=1) + модельный конец → инверсия, НЕ invalid
const r1 = serializeRaysReplica(model({ scale: 1, rotation: 0, tx: 10, ty: 20 }, 'm_1'));
check('валидный transform: инверсия применена, transformInvalid=false',
    r1.length === 1 && r1[0].toIsModel === true && r1[0].transformInvalid === false &&
    r1[0].x2 === 490 && r1[0].y2 === 680);   // (500-10)/1, (700-20)/1

// 2) Мусорный transform (scale=0.18 — как на грязном фото) → НЕ инверсия, invalid
const r2 = serializeRaysReplica(model({ scale: 0.18, rotation: -0.637, tx: -131, ty: 405 }, 'm_1'));
check('мусорный transform (scale 0.18): не инверсируем, transformInvalid=true',
    r2.length === 1 && r2[0].transformInvalid === true && r2[0].x2 === 500 && r2[0].y2 === 700);

// 3) transform отсутствует (null) → invalid
const r3 = serializeRaysReplica(model(null, 'm_1'));
check('transform отсутствует: transformInvalid=true', r3.length === 1 && r3[0].transformInvalid === true);

// 4) Фото-конец (не в графе модели) → не трогаем
const r4 = serializeRaysReplica(model({ scale: 0.18, rotation: 0, tx: 0, ty: 0 }, 'pt_5'));
check('фото-конец: координаты как есть, toIsModel=false, invalid=false',
    r4.length === 1 && r4[0].toIsModel === false && r4[0].transformInvalid === false && r4[0].x2 === 500);

// 5) Границы валидности: scale 0.5/2.0 валиден, 0.4/2.1 невалиден
check('scale 0.5 — валиден', serializeRaysReplica(model({ scale: 0.5, rotation: 0, tx: 0, ty: 0 }, 'm_1'))[0].transformInvalid === false);
check('scale 2.0 — валиден', serializeRaysReplica(model({ scale: 2.0, rotation: 0, tx: 0, ty: 0 }, 'm_1'))[0].transformInvalid === false);
check('scale 0.4 — invalid', serializeRaysReplica(model({ scale: 0.4, rotation: 0, tx: 0, ty: 0 }, 'm_1'))[0].transformInvalid === true);

// --- F2 ---
check('F2: лог с ПРЕДОХРАНИТЕЛЬ → rejected',
    detectMergeRejected(['🛡️ ПРЕДОХРАНИТЕЛЬ: слияние ОТМЕНЕНО — transform несостоятелен: medianError=12.1px']) === true);
check('F2: лог с transform_guard → rejected',
    detectMergeRejected(['⚠️ Улучшение модели не удалось: transform_guard']) === true);
check('F2: лог с validation_failed → rejected',
    detectMergeRejected(['⚠️ Улучшение модели не удалось: validation_failed']) === true);
check('F2: чистый лог → not rejected',
    detectMergeRejected(['📊 Лучей: success=92, failed=0', '🎯 Решение: same_footprint']) === false);
const payload = { matchMap: [{ photoId: 'pt_2', modelId: 'm_2' }], matchedTriangles: [['pt_1', 'pt_2', 'pt_3']], rays: [{ x1: 1 }] };
const cleared = buildPayloadReplica({ ...payload }, true);
check('F2: rejected → matchMap/треугольники/лучи очищены, mergeRejected=true',
    cleared.matchMap.length === 0 && cleared.matchedTriangles.length === 0 && cleared.rays.length === 0 && cleared.mergeRejected === true);

console.log(fail === 0 ? '\n🎉 F1+F2 OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

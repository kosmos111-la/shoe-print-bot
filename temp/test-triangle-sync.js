// Тест синхронизации якорных треугольников между холстами
function sameIdSet(t, ids) {
    if (!t || t.length !== ids.length) return false;
    const set = new Set(ids);
    return t.every(id => set.has(id));
}
function photoTriToModelIds(step, tri) {
    return tri.map(id => {
        const m = step.byPhotoId.get(id);
        return m ? m.modelId : id;
    });
}
function modelTriToPhotoIds(step, tri) {
    return tri.map(id => {
        const m = step.byModelId.get(id);
        return m ? m.photoId : id;
    });
}
function trianglesContainingPoint(step, side, pointId) {
    const pairs = [];
    if (side === 'left') {
        for (const t of step.photo.matchedTriangles || []) {
            if (t.includes(pointId)) pairs.push({ photoIds: t, modelIds: photoTriToModelIds(step, t) });
        }
    } else {
        for (const t of step.model.triangles || []) {
            if (t.includes(pointId)) pairs.push({ photoIds: modelTriToPhotoIds(step, t), modelIds: t });
        }
    }
    return pairs.length ? pairs : null;
}
function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function pointInTriangle(p, a, b, c) {
    const s1 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const s2 = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
    const s3 = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}
function hitTestTriangle(step, side, dp, tol) {
    const pts = side === 'left'
        ? new Map(step.photo.points.map(p => [p.id, p]))
        : new Map(step.model.graph.nodes.map(n => [n.id, n]));
    const tris = side === 'left' ? step.photo.matchedTriangles : step.model.triangles;
    let best = null, bestD = tol;
    for (const t of tris) {
        if (t.length !== 3) continue;
        const a = pts.get(t[0]), b = pts.get(t[1]), c = pts.get(t[2]);
        if (!a || !b || !c) continue;
        if (pointInTriangle(dp, a, b, c)) {
            return side === 'left'
                ? { photoIds: t, modelIds: photoTriToModelIds(step, t) }
                : { photoIds: modelTriToPhotoIds(step, t), modelIds: t };
        }
        const d = Math.min(distToSegment(dp, a, b), distToSegment(dp, b, c), distToSegment(dp, c, a));
        if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return null;
    return side === 'left'
        ? { photoIds: best, modelIds: photoTriToModelIds(step, best) }
        : { photoIds: modelTriToPhotoIds(step, best), modelIds: best };
}

// Синтетический шаг: фото-треугольник pt_1-pt_2-pt_3 ↔ модель m1-m2-m3
const step = {
    byPhotoId: new Map([
        ['pt_1', { photoId: 'pt_1', modelId: 'm1' }],
        ['pt_2', { photoId: 'pt_2', modelId: 'm2' }],
        ['pt_3', { photoId: 'pt_3', modelId: 'm3' }]
    ]),
    byModelId: new Map([
        ['m1', { photoId: 'pt_1', modelId: 'm1' }],
        ['m2', { photoId: 'pt_2', modelId: 'm2' }],
        ['m3', { photoId: 'pt_3', modelId: 'm3' }]
    ]),
    photo: {
        points: [
            { id: 'pt_1', x: 100, y: 100 },
            { id: 'pt_2', x: 300, y: 100 },
            { id: 'pt_3', x: 200, y: 300 },
            { id: 'pt_4', x: 500, y: 500 }
        ],
        matchedTriangles: [['pt_1', 'pt_2', 'pt_3']]
    },
    model: {
        graph: { nodes: [
            { id: 'm1', x: 110, y: 110 },
            { id: 'm2', x: 310, y: 110 },
            { id: 'm3', x: 210, y: 310 }
        ] },
        triangles: [['m3', 'm1', 'm2']]   // порядок вершин ДРУГОЙ — синк должен сработать
    }
};

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

// 1) Прямое соответствие
check('фото-треугольник → модель', JSON.stringify(photoTriToModelIds(step, ['pt_1', 'pt_2', 'pt_3'])) === '["m1","m2","m3"]');
check('модель-треугольник → фото', JSON.stringify(modelTriToPhotoIds(step, ['m3', 'm1', 'm2'])) === '["pt_3","pt_1","pt_2"]');

// 2) Синк по вершине (обе стороны)
check('вершина слева → пара', trianglesContainingPoint(step, 'left', 'pt_1') &&
    trianglesContainingPoint(step, 'left', 'pt_1')[0].modelIds.join(',') === 'm1,m2,m3');
check('вершина справа → пара', (() => {
    const p = trianglesContainingPoint(step, 'right', 'm2');
    return p && sameIdSet(p[0].photoIds, ['pt_1', 'pt_2', 'pt_3']) && sameIdSet(p[0].modelIds, ['m3', 'm1', 'm2']);
})());
check('вершина без треугольника → null', trianglesContainingPoint(step, 'left', 'pt_4') === null);

// 3) Хит-тест (внутри треугольника) — обе стороны
const inside = { x: 200, y: 200 };
const hitL = hitTestTriangle(step, 'left', inside, 5);
const hitR = hitTestTriangle(step, 'right', inside, 5);
check('хит слева (внутри)', hitL && hitL.photoIds.join(',') === 'pt_1,pt_2,pt_3' && hitL.modelIds.join(',') === 'm1,m2,m3');
check('хит справа (внутри)', hitR && hitR.modelIds.join(',') === 'm3,m1,m2' && hitR.photoIds.join(',') === 'pt_3,pt_1,pt_2');
check('хит мимо → null', hitTestTriangle(step, 'left', { x: 450, y: 460 }, 5) === null);

// 4) Рендер-маччинг: модель-треугольник с другим порядком вершин совпадает с парой
const pairL = { photoIds: ['pt_1', 'pt_2', 'pt_3'], modelIds: ['m1', 'm2', 'm3'] };
check('model.triangles [m3,m1,m2] матчится по modelIds', step.model.triangles.some(t => sameIdSet(t, pairL.modelIds)));
check('photo.matchedTriangles матчится по photoIds', step.photo.matchedTriangles.some(t => sameIdSet(t, pairL.photoIds)));

// 5) Точка без matchMap-пары: id остаётся как есть (fallback)
const step2 = { ...step, byPhotoId: new Map() };
check('без пары: id не меняется', JSON.stringify(photoTriToModelIds(step2, ['pt_1', 'pt_2', 'pt_3'])) === '["pt_1","pt_2","pt_3"]');

console.log(fail === 0 ? '\n🎉 синхронизация треугольников OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

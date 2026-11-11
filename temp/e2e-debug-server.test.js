// Временный сквозной тест debug-server (стаб Roboflow + фейковый footprintManager).
// Запуск: node temp/e2e-debug-server.test.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// ── 1) Стаб Roboflow: Outline-trail + 5 протекторов (полигоны) ──
const protectors = [];
for (let i = 0; i < 5; i++) {
    const x0 = 100 + i * 120, y0 = 200 + i * 40;
    protectors.push({
        class: 'shoe-protector',
        confidence: 0.9 - i * 0.02,
        points: [{ x: x0, y: y0 }, { x: x0 + 40, y: y0 }, { x: x0 + 40, y: y0 + 40 }, { x: x0, y: y0 + 40 }]
    });
}
const outlinePoints = [];
for (let i = 0; i < 40; i++) {
    const ang = (i / 40) * Math.PI * 2;
    outlinePoints.push({ x: 600 + Math.cos(ang) * 300, y: 500 + Math.sin(ang) * 180 });
}
const CANNED = [
    { class: 'Outline-trail', confidence: 0.95, points: outlinePoints },
    ...protectors
];

const rfServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ predictions: CANNED }));
    });
});

// ── 2) Фейковый footprintManager: модель с id ядра pt_<ts>_<i>_<k> ──
const coreId1 = 'pt_1700000000000_1_0';
const coreId2 = 'pt_1700000000000_2_1';
const coreId4 = 'pt_1700000000000_4_3';

const fakeModel = {
    id: 'm_test',
    graph: {
        nodes: new Map([
            [coreId1, { id: coreId1, x: 200, y: 200, confirmationCount: 3 }],
            [coreId2, { id: coreId2, x: 300, y: 220, confirmationCount: 1 }],
            [coreId4, { id: coreId4, x: 250, y: 320, confirmationCount: 5 }]
        ]),
        edges: new Set([coreId1 + '--' + coreId2, coreId2 + '--' + coreId4, coreId1 + '--' + coreId4])
    },
    metadata: { name: 'Тест-модель', photoCount: 2, outlineContours: [] },
    transform: { scale: 0.05, rotation: 0.01, translation: { x: 100, y: 50 } },
    structures: [
        {
            id: 's1',
            transform: { scale: 0.05, rotation: 0.01, translation: { x: 100, y: 50 } },
            triangles: new Map([
                ['tri_1', { id: 'tri_1', p1: { id: coreId1 }, p2: { id: coreId2 }, p3: { id: coreId4 } }],
                ['tri_2', { id: 'tri_2', p1: { id: coreId2 }, p2: { id: coreId4 }, p3: { id: coreId1 } }]
            ]),
            rays: [
                { fromPoint: { id: 'pt_1700000000002_2_1', x: 410, y: 88 }, toPoint: { id: 'pt_1700000000002_4_3', x: 486, y: 120 }, type: 'success', distance: 86.2 },
                { fromPoint: { id: 'pt_1700000000002_1_0', x: 100, y: 100 }, toPoint: { id: 'pt_1700000000002_5_4', x: 700, y: 500 }, type: 'failed', distance: 600.0 },
                // 🔥 конец луча — точка МОДЕЛИ (id есть в graph.nodes): должна быть приведена в координаты фото
                { fromPoint: { id: 'pt_1700000000002_3_2', x: 450, y: 240 }, toPoint: { id: coreId2, x: 300, y: 220 }, type: 'success', distance: 150.0 }
            ]
        }
    ],
    lastTriangleResult: {
        matchMap: new Map([
            ['pt_1700000000002_2_1', { modelId: coreId2, pairNumber: 1, status: 'anchor', confidence: 1 }],
            ['pt_1700000000002_4_3', { modelId: coreId4, pairNumber: 2, status: 'anchor', confidence: 1 }]
        ])
    }
};
const fakeTM = {
    accumulator: { getCurrentModel: () => fakeModel },
    getAccumulativeVisualizationData: () => ({
        outlineContour: { points: [{ x: 180, y: 180 }, { x: 320, y: 180 }, { x: 320, y: 340 }, { x: 180, y: 340 }] },
        triangles: [{ p1: { id: coreId1 }, p2: { id: coreId2 }, p3: { id: coreId4 } }],
        transform: fakeModel.transform,
        modelMatchMap: new Map()
    })
};
let clearCount = 0;
const fakeFootprintManager = {
    getTopologyManager: () => fakeTM,
    getActiveSandboxSession: () => null,
    getActiveSession: () => null,
    clearSession: (userId) => {
        clearCount++;
        console.log('  [fake] clearSession:', userId);
        return { success: true };
    },
    addPhotoToSession: async (userId, analysis) => {
        console.log('  [fake] addPhotoToSession:', userId, 'predictions:', (analysis.predictions || []).length);
        return {
            success: true, similarity: 0.87, decision: 'same_footprint_enhanced',
            nodesAdded: 5, topologicalResult: { status: 'enhanced_full' }
        };
    }
};

function postForm(port, pathName, fd) {
    return new Promise((resolve, reject) => {
        fd.submit(`http://127.0.0.1:${port}${pathName}`, (err, response) => {
            if (err) return reject(err);
            let body = '';
            response.on('data', c => (body += c));
            response.on('end', () => resolve({ status: response.statusCode, body }));
        });
    });
}

(async () => {
    await new Promise(r => rfServer.listen(0, '127.0.0.1', r));
    const rfPort = rfServer.address().port;
    console.log('1) Стаб Roboflow на порту', rfPort);

    const createDebugServer = require('../src/web/debug-server');
    const debugApp = createDebugServer({ footprintManager: fakeFootprintManager, animalFilter: null }, {
        ROBOFLOW: { API_URL: `http://127.0.0.1:${rfPort}/predict`, API_KEY: 'x', CONFIDENCE: 0.5, OVERLAP: 0.5 }
    });
    const dbgServer = debugApp.listen(0, '127.0.0.1');
    await new Promise(r => dbgServer.on('listening', r));
    const dbgPort = dbgServer.address().port;
    console.log('2) Debug-сервер на порту', dbgPort);

    const tmpPhoto = path.join(__dirname, 'e2e-photo.png');
    fs.writeFileSync(tmpPhoto, Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'));

    // ── 3) Пачка: analyze (2 фото) ──
    let fd = new FormData();
    fd.append('photos', fs.createReadStream(tmpPhoto), 'a.png');
    fd.append('photos', fs.createReadStream(tmpPhoto), 'b.png');
    fd.append('sessionId', 'web-debug-user');
    let res = await postForm(dbgPort, '/api/debug/analyze', fd);
    console.log('3) POST /api/debug/analyze →', res.status);
    let data = JSON.parse(res.body);
    if (res.status !== 200) { console.error(JSON.stringify(data, null, 2)); process.exit(1); }

    // ── 4) Дозагрузка: add-photo (одно фото, та же сессия) ──
    fd = new FormData();
    fd.append('photo', fs.createReadStream(tmpPhoto), 'c.png');
    fd.append('sessionId', 'web-debug-user');
    res = await postForm(dbgPort, '/api/debug/add-photo', fd);
    console.log('4) POST /api/debug/add-photo →', res.status);
    const addData = JSON.parse(res.body);
    if (res.status !== 200) { console.error(JSON.stringify(addData, null, 2)); process.exit(1); }

    const checks = [];
    checks.push(['analyze: steps (2)', data.steps.length === 2]);
    checks.push(['analyze: allResults (2)', data.allResults.length === 2 &&
        data.allResults[1].file === 'b.png']);

    const s1 = data.steps[0];
    checks.push(['step.photo.predictions — 6 полигонов', s1.photo.predictions.length === 6 &&
        s1.photo.predictions[1].points.length === 4]);
    checks.push(['step.photo.points — pt_1..pt_5', s1.photo.points.length === 5 &&
        s1.photo.points[0].id === 'pt_1' && s1.photo.points[4].id === 'pt_5']);
    checks.push(['step.photo.matchMap — remap', s1.photo.matchMap.length === 2 &&
        s1.photo.matchMap[0].photoId === 'pt_2' && s1.photo.matchMap[0].modelId === 'pt_2' &&
        s1.photo.matchMap[0].score === 1]);

    // События для панели лога: [Match] / [Triangle]
    checks.push(['step.events — match + triangle', Array.isArray(s1.events) && s1.events.length === 4 &&
        s1.events.some(e => e.type === 'match' && e.a === 'pt_2' && e.b === 'pt_2' && e.score === 1) &&
        s1.events.some(e => e.type === 'triangle' && JSON.stringify(e.ids) === '["pt_1","pt_2","pt_4"]')]);
    checks.push(['matchedTriangles — якорные (2 шт, pt-метки)', s1.photo.matchedTriangles.length === 2 &&
        JSON.stringify(s1.photo.matchedTriangles[0]) === '["pt_1","pt_2","pt_4"]' &&
        JSON.stringify(s1.photo.matchedTriangles[1]) === '["pt_2","pt_4","pt_1"]']);
    checks.push(['rays — пары id + координаты фото', s1.photo.rays.length === 3 &&
        s1.photo.rays[0].from === 'pt_2' && s1.photo.rays[0].to === 'pt_4' &&
        s1.photo.rays[0].type === 'success' && s1.photo.rays[0].x1 === 410 && s1.photo.rays[0].y2 === 120 &&
        s1.photo.rays[1].type === 'failed' && s1.photo.rays[1].from === 'pt_1' && s1.photo.rays[1].to === 'pt_5']);

    // 🔥 ФИКС ЛУЧЕЙ: конец в координатах МОДЕЛИ приводится в координаты фото (toIsModel=true)
    const ray3 = s1.photo.rays[2];
    const inv = (p, tr) => {
        const dx = p.x - tr.tx, dy = p.y - tr.ty;
        const cosR = Math.cos(tr.rotation), sinR = Math.sin(tr.rotation);
        return { x: (dx * cosR + dy * sinR) / tr.scale, y: (-dx * sinR + dy * cosR) / tr.scale };
    };
    const exp3 = inv({ x: 300, y: 220 }, s1.transform);
    checks.push(['rays[2] — toPoint из модели приведён в фото', ray3.toIsModel === true &&
        Math.abs(ray3.x2 - exp3.x) < 0.01 && Math.abs(ray3.y2 - exp3.y) < 0.01]);
    checks.push(['rays[0] — toPoint уже в фото (не тронут)', s1.photo.rays[0].toIsModel === false]);

    // 📋 Лог решений ядра
    checks.push(['step.logs — сводка и лог ядра', Array.isArray(s1.logs) && s1.logs.length > 0 &&
        s1.logs.some(l => l.includes('СВОДКА ШАГА')) &&
        s1.logs.some(l => l.includes('Якорных треугольников: 2')) &&
        s1.logs.some(l => l.includes('Лучей: success=2, failed=1'))]);
    checks.push(['step.result — similarity/decision/nodesAdded', s1.result.similarity === 0.87 &&
        s1.result.decision === 'same_footprint_enhanced' && s1.result.nodesAdded === 5]);
    checks.push(['step.model.graph — pt-узлы', s1.model.graph.nodes.length === 3 &&
        s1.model.graph.nodes[0].id === 'pt_1' && s1.model.graph.nodes[0].coreId === coreId1]);
    checks.push(['step.model.triangles [[pt_1,pt_2,pt_4]]', JSON.stringify(s1.model.triangles) === '[["pt_1","pt_2","pt_4"]]']);
    checks.push(['step.model.stats {totalNodes,edges,confirmed2plus}', s1.model.stats.totalNodes === 3 &&
        s1.model.stats.edges === 3 && s1.model.stats.confirmed2plus === 2]);
    checks.push(['step.transform', s1.transform && s1.transform.scale === 0.05 && s1.transform.tx === 100]);

    const s3 = addData.step;
    checks.push(['add-photo: step.file = c.png', s3.photo.file === 'c.png']);
    checks.push(['add-photo: step.photoUrl', typeof s3.photo.photoUrl === 'string' &&
        s3.photo.photoUrl.startsWith('/api/debug/photo/')]);
    checks.push(['add-photo: step.photo.matchMap', s3.photo.matchMap.length === 2]);
    checks.push(['add-photo: step.model.stats', s3.model.stats.totalNodes === 3]);

    // Раздача фото
    const photoRes = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${dbgPort}${s3.photo.photoUrl}`, r2 => {
            let body = '';
            r2.on('data', c => (body += c));
            r2.on('end', () => resolve({ status: r2.statusCode, len: Buffer.byteLength(body) }));
        }).on('error', reject);
    });
    checks.push(['GET photoUrl → 200, байты есть', photoRes.status === 200 && photoRes.len > 0]);

    // ── 5) remove-photo: вынуть b.png (stepIndex 1) — пересборка из кэша, без Roboflow ──
    const rmBody = JSON.stringify({ sessionId: 'web-debug-user', stepIndex: 1 });
    const rmRes = await new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port: dbgPort, path: '/api/debug/remove-photo',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rmBody) }
        }, r2 => {
            let body = '';
            r2.on('data', c => (body += c));
            r2.on('end', () => resolve({ status: r2.statusCode, body }));
        });
        req.on('error', reject);
        req.write(rmBody);
        req.end();
    });
    const rmData = JSON.parse(rmRes.body);
    checks.push(['remove-photo: убрано b.png, пересобрано [a,c] без Roboflow',
        rmRes.status === 200 &&
        rmData.removed === 'b.png' && rmData.steps.length === 2 &&
        rmData.steps[0].photo.file === 'a.png' && rmData.steps[1].photo.file === 'c.png' &&
        clearCount >= 1]);

    let fail = 0;
    for (const [name, ok] of checks) {
        console.log((ok ? '  ✅' : '  ❌'), name);
        if (!ok) fail++;
    }
    console.log(fail === 0 ? '\n🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\n💥 ПРОВАЛЕНО: ${fail}`);
    fs.unlinkSync(tmpPhoto);
    rfServer.close(); dbgServer.close();
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('💥 Тест упал:', e); process.exit(1); });

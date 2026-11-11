// web/app.js — фронтенд отладочного интерфейса.
// Вертикальный список сравнений: каждый ряд = [Фото N] | [Супер-модель после шага N] + метрики.
// Match-линии: чекбокс «все линии» (по умолчанию ВЫКЛ); наведение на точку показывает ОДНУ линию к паре.
// Каждый холст: колесо = зум (к курсору), ЛКМ = pan. Все слои — чекбоксами.
// Дозагрузка: «➕ Добавить ещё фото» в ту же сессию; «🔄 Сбросить сессию» — новая песочница.

const dropzone = document.getElementById('dropzone');
const input = document.getElementById('fileInput');
const btn = document.getElementById('analyzeBtn');
const skipAnimal = document.getElementById('skipAnimal');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const errorBox = document.getElementById('errorBox');
const errorText = document.getElementById('errorText');
const fileCount = document.getElementById('fileCount');
const rowsEl = document.getElementById('rows');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const addPhotoInput = document.getElementById('addPhotoInput');
const resetBtn = document.getElementById('resetBtn');
const sessionInfo = document.getElementById('sessionInfo');
const filesResults = document.getElementById('filesResults');
const graphContainer = document.getElementById('graphContainer');
const showAllLinesChk = document.getElementById('showAllLines');

const LAYER_DEFS = [
    { id: 'original',   label: 'Фото' },
    { id: 'detections', label: 'Полигоны' },
    { id: 'contour',    label: 'Контур следа' },
    { id: 'heel',       label: 'Пятка' },
    { id: 'toe',        label: 'Мысок' },
    { id: 'dragged',    label: 'Поволока-выволока' },
    { id: 'topology',   label: 'Топология' },
    { id: 'triangles',  label: 'Треугольники' },
    { id: 'rays',       label: 'Лучи (rays)' },
    { id: 'ids',        label: 'ID точек' },
    { id: 'tracing',    label: 'Калька' }
];

// Контурные классы Roboflow → отдельные слои (толстая прерывистая линия)
// Цвета: контур следа — фиолетовый, пятка — красный, мысок — жёлтый, поволока-выволока — голубой
const CONTOUR_CLASSES = [
    { key: 'outline-trail',        layer: 'contour', color: '#AA00FF' },
    { key: 'heel',                 layer: 'heel',    color: '#E53935' },
    { key: 'toe',                  layer: 'toe',     color: '#FDD835' },
    { key: 'dragged and dragged',  layer: 'dragged', color: '#29B6F6' },
    { key: 'dragged',              layer: 'dragged', color: '#29B6F6' }
];

// Находит слой-контур по class из Roboflow (регистр/пробелы не важны)
function contourLayerOf(cls) {
    const c = String(cls || '').toLowerCase().trim();
    for (const item of CONTOUR_CLASSES) {
        if (item.key === c) return item;
    }
    return null;
}

const MAX_CANVAS_W = 540;
const MAX_CANVAS_H = 500;

// ── Состояние сессии ──
let sessionId = 'web-debug-user';
let steps = [];           // каждый шаг: {photo, result, model, leftView, rightView, ...}
let firstImage = null;    // фото 1 — фон правого холста (модель в координатах фото 1)
let hover = null;         // {step, side, point, pair}
let lastFocusKey = null;
let dragState = null;     // pan: {step, side, startX, startY, startTx, startTy}
let rotHeld = null;       // вращение: {step, side} — ПКМ зажата + колесо
let activeCanvas = null;  // последний холст под мышью (для клавиш X/Y)
let suppressClick = false; // true, если последнее движение мыши было pan'ом (клик не считается)
let photoOpacity = 1;      // прозрачность слоя «Фото» (0..1), ползунок
let triSync = null;        // синхронизация якорных треугольников между холстами:
                           // {step, pairs: [{photoIds:[3], modelIds:[3]}]}
let lastLogFocusKey = null; // для toggle клика по строке лога
let network = null;

let selectedFiles = [];

// ============ Drag & drop + выбор файлов ============
dropzone.addEventListener('click', () => input.click());
input.addEventListener('change', e => {
    if (e.target.files && e.target.files.length > 0) {
        selectedFiles = Array.from(e.target.files);
        btn.disabled = false;
        fileCount.textContent = `📎 ${selectedFiles.length} файл(ов)`;
        showPreview(selectedFiles);
    }
});
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        selectedFiles = Array.from(e.dataTransfer.files);
        btn.disabled = false;
        fileCount.textContent = `📎 ${selectedFiles.length} файл(ов)`;
        showPreview(selectedFiles);
    }
});

function showPreview(files) {
    preview.innerHTML = '';
    for (const f of files) {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(f);
    }
}

function showError(message, stack) {
    errorText.textContent = message + (stack ? '\n\n' + stack : '');
    errorBox.classList.remove('hidden');
}

// ============ Запуск анализа (пачка) ============
btn.addEventListener('click', async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    btn.disabled = true;
    btn.textContent = '⏳ Анализирую...';
    errorBox.classList.add('hidden');

    const fd = new FormData();
    for (const f of selectedFiles) fd.append('photos', f);
    fd.append('sessionId', sessionId);
    const query = skipAnimal.checked ? '?skipAnimalFilter=1' : '';

    try {
        const resp = await fetch('/api/debug/analyze' + query, { method: 'POST', body: fd });
        const data = await resp.json();
        if (!resp.ok) {
            showError(data.error || ('HTTP ' + resp.status), data.stack);
            return;
        }
        result.classList.remove('hidden');

        for (const s of data.steps || []) appendStep(s);

        if (data.allResults && data.allResults.length > 0) {
            const skipped = data.allResults.filter(r => r.skipped);
            filesResults.innerHTML = skipped.length
                ? '<h3>⏭ Пропущены:</h3><ul>' + skipped.map(r =>
                    `<li>${r.file}: ${r.reason}</li>`).join('') + '</ul>'
                : '';
        }
    } catch (e) {
        showError(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '▶️ Запустить анализ';
    }
});

// ============ Дозагрузка одного фото ============
addPhotoBtn.addEventListener('click', () => addPhotoInput.click());
addPhotoInput.addEventListener('change', async () => {
    if (!addPhotoInput.files || addPhotoInput.files.length === 0) return;
    const file = addPhotoInput.files[0];

    addPhotoBtn.disabled = true;
    addPhotoBtn.textContent = '⏳ Обрабатываю...';

    const fd = new FormData();
    fd.append('photo', file);
    fd.append('sessionId', sessionId);

    try {
        const resp = await fetch('/api/debug/add-photo', { method: 'POST', body: fd });
        const data = await resp.json();
        if (!resp.ok) {
            showError(data.error || ('HTTP ' + resp.status), data.stack);
        } else {
            result.classList.remove('hidden');
            appendStep(data.step);
        }
    } catch (e) {
        showError(e.message);
    } finally {
        addPhotoBtn.disabled = false;
        addPhotoBtn.textContent = '➕ Добавить ещё фото';
        addPhotoInput.value = '';
    }
});

// ============ Сброс сессии ============
resetBtn.addEventListener('click', () => {
    sessionId = 'web-debug-user-' + Date.now();
    steps = [];
    firstImage = null;
    hover = null;
    lastFocusKey = null;
    dragState = null;
    rotHeld = null;
    activeCanvas = null;
    triSync = null;
    lastLogFocusKey = null;
    rowsEl.innerHTML = '';
    graphContainer.innerHTML = '';
    filesResults.innerHTML = '';
    logBody.innerHTML = '';
    addPhotoInput.value = '';
    photoOpacity = 1;
    if (photoOpacityInput) { photoOpacityInput.value = 100; photoOpacityVal.textContent = '100%'; }
    updateLogCount();
    updateSessionInfo();
});

// ============ Чекбоксы: слои и «все линии» ============
function getFlags() {
    const flags = {};
    for (const def of LAYER_DEFS) {
        const el = document.getElementById('layer-' + def.id);
        flags[def.id] = !el || el.checked;
    }
    return flags;
}
for (const def of LAYER_DEFS) {
    const el = document.getElementById('layer-' + def.id);
    if (el) el.addEventListener('change', () => renderAll());
}
showAllLinesChk.addEventListener('change', () => renderAll());

// Ползунок прозрачности фото
const photoOpacityInput = document.getElementById('photoOpacity');
const photoOpacityVal = document.getElementById('photoOpacityVal');
if (photoOpacityInput) {
    photoOpacityInput.addEventListener('input', () => {
        photoOpacity = photoOpacityInput.value / 100;
        photoOpacityVal.textContent = photoOpacityInput.value + '%';
        renderAll();
    });
}

function showAllLines() { return showAllLinesChk.checked; }

function updateSessionInfo() {
    sessionInfo.textContent = `Сессия: ${sessionId} · шагов: ${steps.length}`;
}

// ============================================================
// ДОБАВЛЕНИЕ ШАГА (ряд сравнения)
// ============================================================
function appendStep(stepPayload) {
    const step = {
        ...stepPayload,
        rowEl: null, svgEl: null, leftCanvas: null, rightCanvas: null,
        leftView: null, rightView: null, leftImage: null,
        byPhotoId: new Map(), byModelId: new Map(), _delaunay: null,
        logPre: null, logLines: stepPayload.logs || [], events: stepPayload.events || []
    };
    for (const m of (step.photo.matchMap || [])) {
        step.byPhotoId.set(m.photoId, m);
        step.byModelId.set(m.modelId, m);
    }

    steps.push(step);
    rowsEl.appendChild(createRowDOM(step, steps.length - 1));
    attachCanvasEvents(step);
    buildLogSection(step, steps.length - 1);

    // Кнопка «🗑 Убрать» — вынуть фото из сессии (пересборка из кэша, без Roboflow)
    const rmBtn = step.rowEl.querySelector('.row-remove');
    if (rmBtn) rmBtn.addEventListener('click', () => removeStep(step));

    loadPhotoImage(step.photo.photoUrl, img => {
        step.leftImage = img;
        if (steps.indexOf(step) === 0) {
            // фото 1 — фон правых холстов (модель в координатах фото 1);
            // пере-фит всех правых холстов, т.к. они могли создаться раньше загрузки
            firstImage = img;
            for (const st of steps) {
                st.rightView = fitCanvas(st.rightCanvas, firstImage, (st.model.graph || {}).nodes || []);
            }
        }
        initViews(step);
        renderStep(step);
        updateFinalGraph();
        updateSessionInfo();
    });
}

function loadPhotoImage(url, cb) {
    if (!url) { cb(null); return; }
    const img = new Image();
    img.onload = () => cb(img);
    img.onerror = () => cb(null);
    img.src = url;
}

// «🗑 Убрать фото из сессии»: сервер сбрасывает сессию ядра (clearSession) и
// пересобирает её из кэша предсказаний (Roboflow НЕ вызывается).
// Фронт заменяет все ряды свежими шагами; картинки берутся из браузерного кэша.
async function removeStep(step) {
    const idx = steps.indexOf(step);
    if (idx < 0) return;
    if (steps.length <= 1) {
        alert('Нельзя убрать единственное фото — сессия останется пустой.');
        return;
    }
    if (!confirm(`Убрать фото «${step.photo.file}» (шаг ${idx + 1}) из сессии?\n\nМодель будет пересобрана из кэша предсказаний — Roboflow вызываться НЕ будет.`)) {
        return;
    }
    const rmBtn = step.rowEl && step.rowEl.querySelector('.row-remove');
    if (rmBtn) { rmBtn.disabled = true; rmBtn.textContent = '⏳…'; }

    try {
        const resp = await fetch('/api/debug/remove-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, stepIndex: idx })
        });
        const data = await resp.json();
        if (!resp.ok) {
            showError(data.error || ('HTTP ' + resp.status), data.stack);
            return;
        }

        // Полностью пересобираем интерфейс из свежих шагов
        rowsEl.innerHTML = '';
        logBody.innerHTML = '';
        steps = [];
        images = [];
        firstImage = null;
        delaunayCache = {};
        hover = null; lastFocusKey = null;
        dragState = null; rotHeld = null; activeCanvas = null;
        triSync = null; lastLogFocusKey = null;

        for (const s of data.steps || []) appendStep(s);
        updateFinalGraph();
        updateLogCount();
        updateSessionInfo();
    } catch (e) {
        showError(e.message);
    }
}

// ============ DOM ряда ============
function pct(v) { return v ? (v * 100).toFixed(1) + '%' : '—'; }

function createRowDOM(step, index) {
    const row = document.createElement('div');
    row.className = 'row';
    const stats = step.model.stats || {};
    row.innerHTML =
        `<div class="row-inner">
            <div class="cell">
                <div class="cell-title">🖼 Фото ${index + 1}${index === 0 ? ' — создание модели' : ' — сравнение'}</div>
                <canvas class="cell-canvas left-canvas" width="${MAX_CANVAS_W}" height="${MAX_CANVAS_H}"></canvas>
            </div>
            <div class="cell">
                <div class="cell-title">🏗 Супер-модель (шаг ${index + 1}, фон = Фото 1)</div>
                <canvas class="cell-canvas right-canvas" width="${MAX_CANVAS_W}" height="${MAX_CANVAS_H}"></canvas>
            </div>
        </div>
        <svg class="row-lines"></svg>
        <div class="row-metrics">
            <span class="m">Сходство: <b>${pct(step.result.similarity)}</b></span>
            <span class="m">Решение: <b>${step.result.decision}</b></span>
            <span class="m">+точек: <b>${step.result.nodesAdded}</b></span>
            <span class="m">Узлов модели: <b>${stats.totalNodes || 0}</b></span>
            <span class="m">Подтв. 2+: <b>${stats.confirmed2plus || 0}</b></span>
            <button class="row-remove" title="Убрать это фото из сессии — модель пересоберётся из кэша (Roboflow не вызывается)">🗑 Убрать</button>
        </div>`;
    step.rowEl = row;
    step.svgEl = row.querySelector('.row-lines');
    step.leftCanvas = row.querySelector('.left-canvas');
    step.rightCanvas = row.querySelector('.right-canvas');
    return row;
}

// ============ Инициализация вида (fit под фото/точки) ============
function fitCanvas(canvas, img, boundPts) {
    let s, ox, oy;
    if (img && img.naturalWidth > 0) {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const fit = Math.min(MAX_CANVAS_W / iw, MAX_CANVAS_H / ih, 1);
        canvas.width = Math.round(iw * fit);
        canvas.height = Math.round(ih * fit);
        s = Math.min(canvas.width / iw, canvas.height / ih);
        ox = (canvas.width - iw * s) / 2;
        oy = (canvas.height - ih * s) / 2;
    } else if (boundPts && boundPts.length > 0) {
        const xs = boundPts.map(p => p.x), ys = boundPts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const pad = 30;
        const rX = Math.max(maxX - minX, 1), rY = Math.max(maxY - minY, 1);
        s = Math.min((canvas.width - pad * 2) / rX, (canvas.height - pad * 2) / rY);
        ox = (canvas.width - rX * s) / 2 - minX * s;
        oy = (canvas.height - rY * s) / 2 - minY * s;
    } else {
        s = 1; ox = 20; oy = 20;
    }
    return { s, rot: 0, fx: 1, fy: 1, tx: ox, ty: oy, cw: canvas.width, ch: canvas.height };
}

function initViews(step) {
    step.leftView = fitCanvas(step.leftCanvas, step.leftImage, step.photo.points || []);
    step.rightView = fitCanvas(step.rightCanvas, firstImage, (step.model.graph || {}).nodes || []);
}

// ── Трансформация вида: масштаб + вращение + зеркало + сдвиг ──
// данные → canvas-пиксель
function viewToCanvas(view, x, y) {
    const cos = Math.cos(view.rot), sin = Math.sin(view.rot);
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;
    let px = view.tx + view.s * xr;
    let py = view.ty + view.s * yr;
    if (view.fx < 0) px = view.cw - px;
    if (view.fy < 0) py = view.ch - py;
    return { x: px, y: py };
}

// canvas-пиксель → данные (для hover)
function canvasToView(view, px, py) {
    if (view.fx < 0) px = view.cw - px;
    if (view.fy < 0) py = view.ch - py;
    const cos = Math.cos(view.rot), sin = Math.sin(view.rot);
    const dx = (px - view.tx) / view.s;
    const dy = (py - view.ty) / view.s;
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

// применяет вид к контексту — дальше рисуем в координатах ДАННЫХ
function applyViewTransform(ctx, view) {
    const cos = Math.cos(view.rot), sin = Math.sin(view.rot);
    let a = view.s * cos, b = view.s * sin, c = -view.s * sin, d = view.s * cos, e = view.tx, f = view.ty;
    if (view.fx < 0) { a = -a; c = -c; e = view.cw - e; }
    if (view.fy < 0) { b = -b; d = -d; f = view.ch - f; }
    ctx.setTransform(a, b, c, d, e, f);
}

// меняет масштаб/вращение так, чтобы точка данных под курсором не сдвинулась
function anchorViewAroundCursor(view, cx, cy, sNew, rotNew) {
    const dp = canvasToView(view, cx, cy);
    const cos = Math.cos(rotNew), sin = Math.sin(rotNew);
    const xr = dp.x * cos - dp.y * sin;
    const yr = dp.x * sin + dp.y * cos;
    view.s = sNew;
    view.rot = rotNew;
    view.tx = (view.fx < 0 ? view.cw - cx : cx) - sNew * xr;
    view.ty = (view.fy < 0 ? view.ch - cy : cy) - sNew * yr;
}

// ============ Делоне (клиентский, для фото-холстов) ============
function delaunay(points) {
    const out = { triangles: [], edges: [] };
    const n = points.length;
    if (n < 3) {
        for (let i = 1; i < n; i++) out.edges.push([i - 1, i]);
        return out;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const d = Math.max(maxX - minX, maxY - minY, 1) * 2;
    const all = [
        ...points,
        { x: cx - 4 * d, y: cy - 4 * d },
        { x: cx + 4 * d, y: cy - 4 * d },
        { x: cx, y: cy + 4 * d }
    ];
    let tris = [[n, n + 1, n + 2]];
    const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const inCircum = (t, p) => {
        const a = all[t[0]], b = all[t[1]], c = all[t[2]];
        const adx = a.x - p.x, ady = a.y - p.y;
        const bdx = b.x - p.x, bdy = b.y - p.y;
        const cdx = c.x - p.x, cdy = c.y - p.y;
        return (adx * adx + ady * ady) * (bdx * cdy - bdy * cdx) +
               (bdx * bdx + bdy * bdy) * (cdx * ady - cdy * adx) +
               (cdx * cdx + cdy * cdy) * (adx * bdy - ady * bdx) > 1e-12;
    };
    for (let i = 0; i < n; i++) {
        const p = points[i];
        const bad = [];
        for (let ti = 0; ti < tris.length; ti++) if (inCircum(tris[ti], p)) bad.push(ti);
        if (bad.length === 0) continue;
        const edgeCount = new Map();
        for (const ti of bad) {
            const t = tris[ti];
            for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
                const k = a < b ? a + '--' + b : b + '--' + a;
                edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
            }
        }
        const boundary = [];
        for (const [k, cnt] of edgeCount) if (cnt === 1) boundary.push(k.split('--').map(Number));
        bad.sort((a, b) => b - a);
        for (const ti of bad) tris.splice(ti, 1);
        for (const [a, b] of boundary) {
            let t = [a, b, i];
            if (orient(all[t[0]], all[t[1]], all[t[2]]) < 0) t = [t[1], t[0], t[2]];
            tris.push(t);
        }
    }
    const real = tris.filter(t => t[0] < n && t[1] < n && t[2] < n);
    const es = new Set();
    for (const t of real) for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) es.add(a < b ? a + '--' + b : b + '--' + a);
    out.triangles = real;
    out.edges = [...es].map(k => k.split('--').map(Number));
    return out;
}

function getDelaunay(step) {
    if (!step._delaunay) {
        try {
            step._delaunay = delaunay((step.photo.points || []).map(p => ({ x: p.x, y: p.y })));
        } catch (e) {
            step._delaunay = { triangles: [], edges: [] };
        }
    }
    return step._delaunay;
}

// ============ Отрисовка слоёв ============
function modelPointColor(conf) {
    if (conf >= 2) return '#FFD700';
    if (conf >= 1) return '#4169E1';
    return '#808080';
}

// Полигон от Roboflow (координаты данных; трансформацию задаёт ctx)
function drawPolygon(ctx, pts, fill, stroke, lw) {
    if (!pts || pts.length < 3) return;
    ctx.beginPath();
    pts.forEach((p, i) => {
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

// Подпись id рядом с точкой (u — 1 canvas-пиксель в данных)
function drawIdLabel(ctx, x, y, text, u) {
    ctx.font = `${Math.max(6, 10 * u)}px Arial`;
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText(text, x + 5 * u, y - 5 * u);
    ctx.fillStyle = '#111111';
    ctx.fillText(text, x + 5 * u, y - 5 * u);
}

function renderSide(step, side, flags) {
    const canvas = side === 'left' ? step.leftCanvas : step.rightCanvas;
    const view = side === 'left' ? step.leftView : step.rightView;
    if (!view) return;
    const ctx = canvas.getContext('2d');
    const img = side === 'left' ? step.leftImage : firstImage;
    const u = 1 / view.s;   // 1 canvas-пиксель в данных (радиусы/толщины/шрифты)

    // ── фон (identity) ──
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!img || !img.naturalWidth) {
        ctx.fillStyle = '#666';
        ctx.font = '13px Arial';
        ctx.fillText('нет фото', 14, 22);
    }

    // ── фото (в данных: вращение/зеркало применяются к самому фото) ──
    // Прозрачность фото — ползунок «Прозрачность фото» (0..100%)
    if (flags.original && img && img.naturalWidth > 0) {
        applyViewTransform(ctx, view);
        ctx.globalAlpha = photoOpacity;
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        ctx.globalAlpha = 1;
    }

    // ── «Калька»: белый 50% поверх фото, под всеми линиями (identity) ──
    if (flags.tracing) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ── контент (в данных) ──
    applyViewTransform(ctx, view);

    if (side === 'left') {
        const photo = step.photo;
        if (!photo) return;
        const ptById = new Map((photo.points || []).map(p => [p.id, p]));

        if (flags.detections) {
            for (const pred of photo.predictions || []) {
                if (contourLayerOf(pred.class)) continue;   // контуры рисуются в своих слоях
                drawPolygon(ctx, pred.points, 'rgba(46, 204, 113, 0.15)', '#2ECC71', 1.5 * u);
            }
        }

        // Контуры Roboflow — отдельные слои: контур следа, пятка, мысок, поволока-выволока
        // (толстая прерывистая линия цветом слоя + лёгкая заливка)
        for (const item of CONTOUR_CLASSES) {
            if (!flags[item.layer]) continue;
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2.5 * u;
            ctx.setLineDash([8 * u, 6 * u]);
            for (const pred of photo.predictions || []) {
                if (contourLayerOf(pred.class) !== item) continue;
                if (!pred.points || pred.points.length < 3) continue;
                ctx.beginPath();
                pred.points.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
                ctx.closePath();
                ctx.fillStyle = item.color + '1a';   // ~10% заливка
                ctx.fill();
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        if (flags.topology && photo.points.length >= 2) {
            const dt = getDelaunay(step);
            const fs = focusStateFor(step, side);
            const edgeInvolved = (a, b) => fs && (fs.mode === 'hover'
                ? ((fs.neighbors.has(a.id) || a.id === fs.pointId) && (fs.neighbors.has(b.id) || b.id === fs.pointId))
                : (a.id === fs.pointId || b.id === fs.pointId));

            for (const [a, b] of dt.edges) {
                const pa = photo.points[a], pb = photo.points[b];
                if (fs && !edgeInvolved(pa, pb)) {
                    // тусклые (не в фокусе)
                    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
                    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)'; ctx.lineWidth = 1 * u; ctx.stroke();
                } else if (fs) {
                    // подсвеченные рёбра (Делоне-соседи)
                    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
                    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2 * u; ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; ctx.lineWidth = 3 * u; ctx.stroke();
                    ctx.strokeStyle = 'rgba(200, 200, 200, 0.65)'; ctx.lineWidth = 1 * u; ctx.stroke();
                }
            }

            for (const p of photo.points) {
                let fill = '#00ACC1', ring = '#FFF', rad = 4 * u, rw = 1 * u;
                if (fs && fs.mode === 'hover') {
                    if (p.id === fs.pointId) { fill = '#FFD700'; ring = '#E53935'; rad = 6 * u; rw = 2 * u; }
                    else if (fs.neighbors.has(p.id)) { fill = '#FFD700'; ring = '#FFD700'; rad = 5 * u; rw = 1.5 * u; }
                    else { fill = 'rgba(190, 190, 190, 0.35)'; ring = null; rad = 3 * u; }
                } else if (fs && fs.mode === 'pair') {
                    if (fs.pointId && p.id === fs.pointId) { fill = '#FFD700'; ring = '#E53935'; rad = 6 * u; rw = 2 * u; }
                    else { fill = 'rgba(190, 190, 190, 0.35)'; ring = null; rad = 3 * u; }
                }
                ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = fill; ctx.fill();
                if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = rw; ctx.stroke(); }
            }
        }

        // triangles — ЯКОРНЫЕ (совпавшие) треугольники из TriangleMatcher.
        // При синхронизации (hover точки/треугольника или [Triangle] из лога):
        // выбранный — жирный красный контур, остальные тускнеют. Синк работает
        // и на правом холсте (model.triangles по modelIds).
        if (flags.triangles && photo.matchedTriangles && photo.matchedTriangles.length) {
            const ts = triSync && triSync.step === step ? triSync.pairs : null;
            for (const t of photo.matchedTriangles) {
                if (t.length !== 3) continue;
                const a = ptById.get(t[0]), b = ptById.get(t[1]), c = ptById.get(t[2]);
                if (!a || !b || !c) continue;
                const isSync = ts && ts.some(p => sameIdSet(t, p.photoIds));
                if (ts) {
                    ctx.fillStyle = isSync ? 'rgba(255, 69, 0, 0.3)' : 'rgba(255, 69, 0, 0.05)';
                    ctx.strokeStyle = isSync ? '#FF0000' : 'rgba(255, 87, 34, 0.35)';
                    ctx.lineWidth = (isSync ? 3 : 1) * u;
                } else {
                    ctx.fillStyle = 'rgba(255, 69, 0, 0.22)';
                    ctx.strokeStyle = '#FF5722';
                    ctx.lineWidth = 1.5 * u;
                }
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }

        // rays — лучи от вершин якорных треугольников (success жёлтые, failed красные)
        if (flags.rays) {
            for (const ray of photo.rays || []) {
                if (ray.type === 'failed') {
                    ctx.strokeStyle = 'rgba(255, 80, 80, 0.75)';
                    ctx.setLineDash([4 * u, 4 * u]);
                } else {
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
                    ctx.setLineDash([]);
                }
                ctx.lineWidth = 2 * u;
                ctx.beginPath(); ctx.moveTo(ray.x1, ray.y1); ctx.lineTo(ray.x2, ray.y2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(ray.x2, ray.y2, 3 * u, 0, Math.PI * 2);
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();
            }
        }

        if (flags.ids) {
            for (const p of photo.points) drawIdLabel(ctx, p.x, p.y, p.id, u);
        }

    } else {
        const model = step.model;
        if (!model || !model.graph || model.graph.nodes.length === 0) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#666';
            ctx.font = '13px Arial';
            ctx.fillText('модель пуста', 14, 22);
            return;
        }
        const nodeById = new Map(model.graph.nodes.map(n => [n.id, n]));

        if (flags.topology) {
            const fs = focusStateFor(step, side);
            const edgeInvolved = (a, b) => fs && (fs.mode === 'hover'
                ? ((fs.neighbors.has(a.id) || a.id === fs.pointId) && (fs.neighbors.has(b.id) || b.id === fs.pointId))
                : (a.id === fs.pointId || b.id === fs.pointId));

            for (const e of model.graph.edges || []) {
                const a = nodeById.get(e.from), b = nodeById.get(e.to);
                if (!a || !b) continue;
                if (fs && !edgeInvolved(a, b)) {
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)'; ctx.lineWidth = 1 * u; ctx.stroke();
                } else if (fs) {
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2 * u; ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; ctx.lineWidth = 3 * u; ctx.stroke();
                    ctx.strokeStyle = 'rgba(200, 200, 200, 0.65)'; ctx.lineWidth = 1 * u; ctx.stroke();
                }
            }
            for (const n of model.graph.nodes) {
                const conf = n.confirmationCount || 0;
                let fill = modelPointColor(conf), ring = '#FFF', rad = (4 + (conf >= 2 ? 2 : 0)) * u, rw = 1 * u;
                if (fs && fs.mode === 'hover') {
                    if (n.id === fs.pointId) { fill = '#FFD700'; ring = '#E53935'; rad = 7 * u; rw = 2 * u; }
                    else if (fs.neighbors.has(n.id)) { fill = '#FFD700'; ring = '#FFD700'; rad = 6 * u; rw = 1.5 * u; }
                    else { fill = 'rgba(190, 190, 190, 0.35)'; ring = null; rad = 3 * u; }
                } else if (fs && fs.mode === 'pair') {
                    if (fs.pointId && n.id === fs.pointId) { fill = '#FFD700'; ring = '#E53935'; rad = 7 * u; rw = 2 * u; }
                    else { fill = 'rgba(190, 190, 190, 0.35)'; ring = null; rad = 3 * u; }
                }
                ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = fill; ctx.fill();
                if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = rw; ctx.stroke(); }
            }
        }

        if (flags.triangles && model.triangles) {
            // синхронизация с левым холстом: тот же якорный треугольник — жирный красный
            const ts = triSync && triSync.step === step ? triSync.pairs : null;
            for (const t of model.triangles) {
                if (t.length !== 3) continue;
                const a = nodeById.get(t[0]), b = nodeById.get(t[1]), c = nodeById.get(t[2]);
                if (!a || !b || !c) continue;
                const isSync = ts && ts.some(p => sameIdSet(t, p.modelIds));
                if (ts) {
                    ctx.fillStyle = isSync ? 'rgba(255, 69, 0, 0.3)' : 'rgba(255, 152, 0, 0.05)';
                    ctx.strokeStyle = isSync ? '#FF0000' : 'rgba(255, 152, 0, 0.35)';
                    ctx.lineWidth = (isSync ? 3 : 1) * u;
                } else {
                    ctx.fillStyle = 'rgba(255, 152, 0, 0.14)';
                    ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
                    ctx.lineWidth = 1 * u;
                }
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }

        if (flags.ids) {
            for (const n of model.graph.nodes) drawIdLabel(ctx, n.x, n.y, n.id, u);
        }
    }
}

function renderStep(step) {
    const flags = getFlags();
    renderSide(step, 'left', flags);
    renderSide(step, 'right', flags);
    drawRowLines(step);
}

function renderAll() {
    for (const step of steps) renderStep(step);
}

// ============================================================
// MATCH-ЛИНИИ (SVG внутри ряда)
// ============================================================
function dataToWrapper(step, side, pt) {
    const canvas = side === 'left' ? step.leftCanvas : step.rightCanvas;
    const view = side === 'left' ? step.leftView : step.rightView;
    if (!view) return null;
    const vp = viewToCanvas(view, pt.x, pt.y);   // с учётом вращения и зеркала
    const px = vp.x, py = vp.y;
    const r = canvas.getBoundingClientRect();
    const wrap = step.rowEl.getBoundingClientRect();
    const kx = r.width / canvas.width, ky = r.height / canvas.height;
    return { x: r.left - wrap.left + px * kx, y: r.top - wrap.top + py * ky };
}

function findLeftPoint(step, photoId) {
    return (step.photo.points || []).find(p => p.id === photoId) || null;
}
function findRightPoint(step, modelId) {
    return ((step.model.graph || {}).nodes || []).find(n => n.id === modelId) || null;
}

function svgLine(svg, wa, wb, color) {
    const NS = 'http://www.w3.org/2000/svg';
    const isFocus = color === '#FF2020';
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', wa.x); l.setAttribute('y1', wa.y);
    l.setAttribute('x2', wb.x); l.setAttribute('y2', wb.y);
    l.setAttribute('stroke', color || '#FFD700');
    l.setAttribute('stroke-width', isFocus ? '3' : '2');
    if (!isFocus) l.setAttribute('stroke-dasharray', '6 4');
    l.setAttribute('opacity', '0.95');
    svg.appendChild(l);
    for (const [cx, cy] of [[wa.x, wa.y], [wb.x, wb.y]]) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', isFocus ? '4' : '3');
        c.setAttribute('fill', color || '#FFD700');
        svg.appendChild(c);
    }
}

function drawRowLines(step) {
    const svg = step.svgEl;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const wrap = step.rowEl.getBoundingClientRect();
    if (wrap.width === 0) return;
    svg.setAttribute('width', wrap.width);
    svg.setAttribute('height', wrap.height);

    const pairs = [];
    if (hover && hover.step === step) {
        // 🔴 ФОКУС: одна ярко-красная линия до пары; все остальные скрыты
        const m = hover.pair;
        if (m) {
            const a = hover.side === 'left' ? hover.point : findLeftPoint(step, m.photoId);
            const b = hover.side === 'right' ? hover.point : findRightPoint(step, m.modelId);
            if (a && b) pairs.push([a, b, '#FF2020']);
        }
    } else if (showAllLines()) {
        for (const m of step.photo.matchMap || []) {
            const a = findLeftPoint(step, m.photoId);
            const b = findRightPoint(step, m.modelId);
            if (a && b) pairs.push([a, b, '#FFD700']);
        }
    }

    for (const [a, b, color] of pairs) {
        const wa = dataToWrapper(step, 'left', a);
        const wb = dataToWrapper(step, 'right', b);
        if (wa && wb) svgLine(svg, wa, wb, color);
    }
}

// ============================================================
// ИНТЕРАКТИВ: HOVER (одна линия), PAN, ZOOM, ВРАЩЕНИЕ, ЗЕРКАЛО
// ============================================================
function attachCanvasEvents(step) {
    for (const side of ['left', 'right']) {
        const canvas = side === 'left' ? step.leftCanvas : step.rightCanvas;
        canvas.style.cursor = 'grab';

        // Hover — только когда не тянем/не вращаем
        canvas.addEventListener('mousemove', e => {
            activeCanvas = { step, side };
            if (dragState && dragState.step === step && dragState.side === side) return;
            const view = side === 'left' ? step.leftView : step.rightView;
            if (!view) return;
            const r = canvas.getBoundingClientRect();
            const kx = r.width / canvas.width, ky = r.height / canvas.height;
            const cx = (e.clientX - r.left) / kx, cy = (e.clientY - r.top) / ky;
            const dpt = canvasToView(view, cx, cy);

            const pts = side === 'left'
                ? (step.photo.points || [])
                : ((step.model.graph || {}).nodes || []);
            let best = null, bestD = 12 / view.s;   // радиус ~12 canvas px
            for (const p of pts) {
                const d = Math.hypot(p.x - dpt.x, p.y - dpt.y);
                if (d < bestD) { bestD = d; best = p; }
            }

            if (best) {
                // точечный фокус + синхронизация треугольников, содержащих точку
                const m = side === 'left' ? step.byPhotoId.get(best.id) : step.byModelId.get(best.id);
                const neighbors = side === 'left'
                    ? delaunayNeighbors(step, best.id)
                    : graphNeighbors(step, best.id);
                const pairPoint = m
                    ? (side === 'left' ? findRightPoint(step, m.modelId) : findLeftPoint(step, m.photoId))
                    : null;
                setHover(step, { side, point: best, pair: m || null, neighbors, pairPoint },
                    trianglesContainingPoint(step, side, best.id));
                return;
            }

            // нет точки рядом — пробуем попадание в якорный треугольник
            const tri = hitTestTriangle(step, side, dpt, 10 / view.s);
            if (tri) {
                setHover(step, null, [tri]);
            } else {
                setHover(step, null, null);
            }
        });

        canvas.addEventListener('mouseleave', () => {
            if ((hover && hover.step === step) || (triSync && triSync.step === step)) {
                setHover(step, null, null);
            }
        });

        // Мыши: ЛКМ = pan, ПКМ (зажата) = режим вращения
        canvas.addEventListener('mousedown', e => {
            const view = side === 'left' ? step.leftView : step.rightView;
            if (!view) return;
            activeCanvas = { step, side };
            suppressClick = false;               // новый жест — не клик
            if (e.button === 0) {
                dragState = { step, side, startX: e.clientX, startY: e.clientY, startTx: view.tx, startTy: view.ty };
                canvas.style.cursor = 'grabbing';
                e.preventDefault();
            } else if (e.button === 2) {
                rotHeld = { step, side };
                canvas.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Клик по левому холсту: выбрать луч/треугольник → подсветить строки лога
        if (side === 'left') {
            canvas.addEventListener('click', e => {
                if (suppressClick) { suppressClick = false; return; }
                if (e.detail > 1) return;        // двойной клик = сброс вида
                onCanvasPick(step, e);
            });
        }

        // Колесо: без ПКМ — зум, с зажатой ПКМ — вращение (оба к курсору)
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const view = side === 'left' ? step.leftView : step.rightView;
            if (!view) return;
            const r = canvas.getBoundingClientRect();
            const kx = r.width / canvas.width, ky = r.height / canvas.height;
            const cx = (e.clientX - r.left) / kx, cy = (e.clientY - r.top) / ky;

            if (rotHeld && rotHeld.step === step && rotHeld.side === side) {
                const rotNew = view.rot + e.deltaY * 0.003;       // вращение
                anchorViewAroundCursor(view, cx, cy, view.s, rotNew);
            } else {
                const factor = Math.exp(-e.deltaY * 0.0015);
                const sNew = Math.min(30, Math.max(0.05, view.s * factor));
                anchorViewAroundCursor(view, cx, cy, sNew, view.rot);
            }
            renderSide(step, side, getFlags());
            drawRowLines(step);
        }, { passive: false });

        // Двойной клик — сброс вида этого холста (пере-фит)
        canvas.addEventListener('dblclick', () => resetSideView(step, side));
    }
}

// Сброс вида одного холста (пере-фит по фото/точкам)
function resetSideView(step, side) {
    const view = side === 'left' ? step.leftView : step.rightView;
    const canvas = side === 'left' ? step.leftCanvas : step.rightCanvas;
    const img = side === 'left' ? step.leftImage : firstImage;
    const bound = side === 'left' ? (step.photo.points || []) : ((step.model.graph || {}).nodes || []);
    const v = fitCanvas(canvas, img, bound);
    view.s = v.s; view.rot = v.rot; view.fx = v.fx; view.fy = v.fy;
    view.tx = v.tx; view.ty = v.ty; view.cw = v.cw; view.ch = v.ch;
    renderSide(step, side, getFlags());
    drawRowLines(step);
}

// Pan: движение и отпускание — глобально (работает за пределами холста)
window.addEventListener('mousemove', e => {
    if (!dragState) return;
    const { step, side } = dragState;
    const view = side === 'left' ? step.leftView : step.rightView;
    const canvas = side === 'left' ? step.leftCanvas : step.rightCanvas;
    const r = canvas.getBoundingClientRect();
    const kx = r.width / canvas.width, ky = r.height / canvas.height;
    const dx = (e.clientX - dragState.startX) / kx;
    const dy = (e.clientY - dragState.startY) / ky;
    if (Math.abs(e.clientX - dragState.startX) + Math.abs(e.clientY - dragState.startY) > 3) {
        suppressClick = true;   // было перетаскивание — click не обрабатываем
    }
    // при зеркале направление перетаскивания инвертируется
    view.tx = dragState.startTx + dx * (view.fx > 0 ? 1 : -1);
    view.ty = dragState.startTy + dy * (view.fy > 0 ? 1 : -1);
    renderSide(step, side, getFlags());
    drawRowLines(step);
});
window.addEventListener('mouseup', () => {
    const restoreCursor = (st, sd) => {
        const canvas = sd === 'left' ? st.leftCanvas : st.rightCanvas;
        canvas.style.cursor = 'grab';
    };
    if (dragState) { restoreCursor(dragState.step, dragState.side); dragState = null; }
    if (rotHeld) { restoreCursor(rotHeld.step, rotHeld.side); rotHeld = null; }
});

// Зеркало активного холста: X — по оси X, Y — по оси Y (вокруг центра холста)
window.addEventListener('keydown', e => {
    if (!activeCanvas) return;
    const t = e.target;
    if (t && t.tagName && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const { step, side } = activeCanvas;
    const view = side === 'left' ? step.leftView : step.rightView;
    if (!view) return;
    const k = e.key.toLowerCase();
    if (k === 'x') view.fx *= -1;
    else if (k === 'y') view.fy *= -1;
    else return;
    renderSide(step, side, getFlags());
    drawRowLines(step);
});

function setHover(step, h, triPairs) {
    const key = h ? `${steps.indexOf(step)}:${h.side}:${h.point.id}` : 'none';
    const triKey = triPairs && triPairs.length
        ? triPairs.map(p => p.photoIds.slice().sort().join('+')).join(';')
        : '';
    const full = key + '#' + triKey;
    if (full === lastFocusKey) return;
    lastFocusKey = full;
    hover = h
        ? { step, side: h.side, point: h.point, pair: h.pair, neighbors: h.neighbors, pairPoint: h.pairPoint }
        : null;
    triSync = triPairs && triPairs.length ? { step, pairs: triPairs } : null;
    renderStep(step);
}

// Сравнение треугольников как множеств (порядок вершин не важен)
function sameIdSet(t, ids) {
    if (!t || t.length !== ids.length) return false;
    const set = new Set(ids);
    return t.every(id => set.has(id));
}

// ── Соответствие треугольников между холстами (через matchMap, обе стороны) ──
// Треугольник фото [pt_a, pt_b, pt_c] → треугольник модели [modelId_a, modelId_b, modelId_c]
function photoTriToModelIds(step, tri) {
    return tri.map(id => {
        const m = step.byPhotoId.get(id);
        return m ? m.modelId : id;          // нет пары — оставляем id как есть
    });
}
// Треугольник модели → треугольник фото (обратная сторона matchMap)
function modelTriToPhotoIds(step, tri) {
    return tri.map(id => {
        const m = step.byModelId.get(id);
        return m ? m.photoId : id;
    });
}

// Все якорные треугольники на этой стороне, содержащие точку pointId
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

// Хит-тест якорного треугольника (внутри или у стороны) на стороне холста
function hitTestTriangle(step, side, dp, tol) {
    const pts = side === 'left'
        ? new Map((step.photo.points || []).map(p => [p.id, p]))
        : new Map(((step.model.graph || {}).nodes || []).map(n => [n.id, n]));
    const tris = side === 'left' ? (step.photo.matchedTriangles || []) : (step.model.triangles || []);

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

// Фокус-режим для рендера: null — обычный вид, 'hover' — холст под мышью, 'pair' — парный холст
function focusStateFor(step, side) {
    if (!hover || hover.step !== step) return null;
    if (hover.side === side) {
        return { mode: 'hover', pointId: hover.point.id, neighbors: hover.neighbors || new Set() };
    }
    return { mode: 'pair', pointId: hover.pairPoint ? hover.pairPoint.id : null };
}

// Соседи по Делоне на левом холсте (id точек, связанных ребром с данной)
function delaunayNeighbors(step, id) {
    const pts = step.photo.points || [];
    const idx = pts.findIndex(p => p.id === id);
    const set = new Set();
    if (idx < 0) return set;
    for (const [a, b] of getDelaunay(step).edges) {
        if (a === idx) set.add(pts[b].id);
        else if (b === idx) set.add(pts[a].id);
    }
    return set;
}

// Соседи по рёбрам графа на правом холсте (супер-модель)
function graphNeighbors(step, id) {
    const set = new Set();
    for (const e of ((step.model.graph || {}).edges || [])) {
        if (e.from === id) set.add(e.to);
        else if (e.to === id) set.add(e.from);
    }
    return set;
}

// ============================================================
// 📋 ЛОГ РЕШЕНИЙ ЯДРА (панель внизу)
// ============================================================
const logPanel = document.getElementById('logPanel');
const logBody = document.getElementById('logBody');
const logCount = document.getElementById('logCount');

function updateLogCount() {
    logCount.textContent = steps.length ? `(${steps.length} шаг.)` : '';
}

function buildLogSection(step, index) {
    const wrap = document.createElement('details');
    wrap.className = 'log-step';
    const sum = document.createElement('summary');
    sum.textContent = `Шаг ${index + 1} — ${step.photo.file || 'фото'} · ${pct(step.result.similarity)} · ${step.result.decision}`;
    wrap.appendChild(sum);

    // ── Форматированные события: [Match] / [Triangle] ──
    const evBox = document.createElement('div');
    evBox.className = 'log-events';
    if (step.events && step.events.length) {
        for (const ev of step.events) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'log-event ' + (ev.type === 'match' ? 'ev-match' : 'ev-tri');
            btn.textContent = ev.type === 'match'
                ? `[Match] ${ev.a} ↔ ${ev.b} (score: ${(ev.score || 0).toFixed(2)}, ${ev.status || 'anchor'})`
                : `[Triangle] ${ev.ids.join(' - ')} (anchor)`;
            btn.addEventListener('click', () => {
                if (ev.type === 'match') focusMatch(step, ev.a, ev.b);
                else focusTriangle(step, ev.ids);
            });
            evBox.appendChild(btn);
        }
    } else {
        evBox.innerHTML = '<div class="log-none">(событий нет — первое фото / нет совпадений)</div>';
    }
    wrap.appendChild(evBox);

    // ── Сырой консольный лог ядра (свёрнут) ──
    const raw = document.createElement('details');
    raw.className = 'log-raw';
    const rawSum = document.createElement('summary');
    rawSum.textContent = `Консоль ядра (${step.logLines.length} строк)`;
    const pre = document.createElement('pre');
    pre.className = 'log-lines';
    pre.textContent = step.logLines.length
        ? step.logLines.join('\n')
        : '(лог пуст — запусти с DEBUG_MODE=true для подробной диагностики ядра)';
    raw.appendChild(rawSum);
    raw.appendChild(pre);
    wrap.appendChild(raw);

    logBody.appendChild(wrap);
    step.logPre = pre;
    updateLogCount();
}

// Фокус на паре [Match]: подсветить точку на левом холсте, пару на правом + красную линию.
// Заодно синхронизируем якорные треугольники, содержащие точку (обе стороны).
function focusMatch(step, aId, bId) {
    const key = `match:${steps.indexOf(step)}:${aId}↔${bId}`;
    if (key === lastLogFocusKey) { lastLogFocusKey = null; setHover(step, null, null); return; }
    lastLogFocusKey = key;
    const a = findLeftPoint(step, aId);
    const b = findRightPoint(step, bId);
    if (!a) { setHover(step, null, null); return; }
    const pair = { photoId: aId, modelId: bId };
    setHover(step, {
        side: 'left',
        point: a,
        pair,
        neighbors: delaunayNeighbors(step, aId),
        pairPoint: b || null
    }, trianglesContainingPoint(step, 'left', aId));
}

// Фокус на треугольнике [Triangle] из лога: жирный красный контур на ОБОИХ холстах
function focusTriangle(step, ids) {
    const key = `tri:${steps.indexOf(step)}:${ids.join(',')}`;
    if (key === lastLogFocusKey) { lastLogFocusKey = null; setHover(step, null, null); return; }
    lastLogFocusKey = key;
    setHover(step, null, [{ photoIds: ids, modelIds: photoTriToModelIds(step, ids) }]);
}

// ── Подсветка строк лога по клику на треугольник/луч ──
function onCanvasPick(step, e) {
    const view = step.leftView;
    if (!view) return;
    setHover(step, null, null);  // работа с холстом отменяет фокус из лога
    lastLogFocusKey = null;
    const canvas = step.leftCanvas;
    const r = canvas.getBoundingClientRect();
    const kx = r.width / canvas.width, ky = r.height / canvas.height;
    const cx = (e.clientX - r.left) / kx, cy = (e.clientY - r.top) / ky;
    const dp = canvasToView(view, cx, cy);
    const tol = 12 / view.s;

    // 1) ближайший луч (расстояние до отрезка)
    let rayHit = null, rayBest = tol;
    for (const ray of step.photo.rays || []) {
        const d = distToSegment(dp, { x: ray.x1, y: ray.y1 }, { x: ray.x2, y: ray.y2 });
        if (d < rayBest) { rayBest = d; rayHit = ray; }
    }
    // 2) ближайший якорный треугольник (внутри или у стороны)
    const ptById = new Map((step.photo.points || []).map(p => [p.id, p]));
    let triHit = null, triBest = tol;
    for (const t of step.photo.matchedTriangles || []) {
        if (t.length !== 3) continue;
        const a = ptById.get(t[0]), b = ptById.get(t[1]), c = ptById.get(t[2]);
        if (!a || !b || !c) continue;
        const dEdge = Math.min(
            distToSegment(dp, a, b), distToSegment(dp, b, c), distToSegment(dp, c, a)
        );
        if (pointInTriangle(dp, a, b, c) || dEdge < triBest) { triBest = dEdge; triHit = t; }
    }

    highlightLog(step, rayHit ? [rayHit.from, rayHit.to] : (triHit || null));
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

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Регексы по коротким id: форма pt_<индекс> и форма ядра pt_<ts>_<индекс>_<k>
function idPatterns(ids) {
    const pats = [];
    for (const sid of ids || []) {
        if (!sid) continue;
        const m = /^pt_(\d+)$/.exec(sid);
        if (m) {
            const idx = m[1];
            pats.push(new RegExp(`(^|[^\\d])pt_${idx}([^\\d]|$)`));   // короткая форма
            pats.push(new RegExp(`pt_\\d+_${idx}_\\d+`));             // форма ядра
        } else {
            pats.push(new RegExp(sid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
    }
    return pats;
}

function highlightLog(step, ids) {
    if (!step.logPre) return;
    const lines = step.logLines || [];
    if (!ids || ids.length === 0) {
        step.logPre.textContent = lines.length ? lines.join('\n') : '';
        return;
    }
    const pats = idPatterns(ids);
    const html = [];
    let firstHit = -1;
    lines.forEach((line, i) => {
        const hit = pats.some(re => re.test(line));
        if (hit && firstHit === -1) firstHit = i;
        html.push(hit ? `<span class="log-hit">${escapeHtml(line)}</span>` : escapeHtml(line));
    });
    step.logPre.innerHTML = html.join('\n');
    if (firstHit >= 0) {
        const hitEl = step.logPre.querySelector('.log-hit');
        if (hitEl) hitEl.scrollIntoView({ block: 'nearest' });
    }
}

// ============================================================
// 📥 ЭКСПОРТ ТЕКУЩЕГО ВИДА В PNG
// Ручная сборка offscreen-canvas: drawImage каждого холста +
// текстовые метрики через fillText + заголовок/водяной знак.
// Без html2canvas — контролируем качество и размер.
// ============================================================
const exportBtn = document.getElementById('exportBtn');
const exportMode = document.getElementById('exportMode');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (!steps.length) { alert('Нет данных для экспорта — сначала проанализируйте фото'); return; }
        exportToPNG(exportMode ? exportMode.value : 'all');
    });
}

// «Текущее сравнение» = последний активный холст (hover/клик); иначе последний шаг
function currentStep() {
    if (activeCanvas && activeCanvas.step && steps.includes(activeCanvas.step)) {
        return activeCanvas.step;
    }
    return steps[steps.length - 1];
}

function exportToPNG(mode) {
    const list = mode === 'current' ? [currentStep()] : steps.slice();
    if (!list.length) return;

    const PAD = 20, GAP = 16, HEADER_H = 64, METRICS_H = 46, ROW_GAP = 14;

    // Ширина колонки — максимум из всех левых/правых холстов (минимум 420)
    let colW = 420;
    for (const st of list) {
        colW = Math.max(colW, st.leftCanvas.width, st.rightCanvas.width);
    }
    const W = colW * 2 + GAP + PAD * 2;

    // Высоты рядов: холст (макс. из пары) + блок метрик
    const rowH = list.map(st => Math.max(st.leftCanvas.height, st.rightCanvas.height) + METRICS_H);
    const H = HEADER_H + ROW_GAP + rowH.reduce((a, b) => a + b + ROW_GAP, 0) + PAD;

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');

    // Фон
    ctx.fillStyle = '#16181d';
    ctx.fillRect(0, 0, W, H);

    // Заголовок + дата/сессия + водяной знак
    drawExportHeader(ctx, W, HEADER_H);

    let y = HEADER_H + ROW_GAP;
    list.forEach((st, idx) => {
        const lw = st.leftCanvas.width, lh = st.leftCanvas.height;
        const rw = st.rightCanvas.width, rh = st.rightCanvas.height;
        // центрируем холсты в своих колонках
        const lx = PAD + (colW - lw) / 2;
        const rx = PAD + colW + GAP + (colW - rw) / 2;

        ctx.drawImage(st.leftCanvas, lx, y);
        drawExportMetrics(ctx, st, 'left', PAD, y + lh, colW, idx);

        ctx.drawImage(st.rightCanvas, rx, y);
        drawExportMetrics(ctx, st, 'right', PAD + colW + GAP, y + rh, colW, idx);

        y += rowH[idx] + ROW_GAP;
    });

    // Скачивание
    const url = out.toDataURL('image/png');
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${sessionId}_${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function drawExportHeader(ctx, W, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('👣 СРАВНЕНИЕ СЛЕДОВ ОБУВИ — ОТЧЁТ', 20, 26);

    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`Сессия: ${sessionId} · ${new Date().toLocaleString('ru-RU')}`, 20, 46);

    // Водяной знак
    ctx.save();
    ctx.translate(W - 40, h - 12);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.font = '22px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('shoe-print-bot', 0, 0);
    ctx.restore();
}

function drawExportMetrics(ctx, st, side, x, y, colW, idx) {
    const res = st.result || {};
    const stats = (st.model && st.model.stats) || {};
    const sim = res.similarity ? (res.similarity * 100).toFixed(1) + '%' : '—';

    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(
        side === 'left' ? `Фото ${idx + 1}: ${st.photo.file}` : `Супер-модель (шаг ${idx + 1})`,
        x, y + 16
    );

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(
        side === 'left'
            ? `Similarity: ${sim} · Decision: ${res.decision || '—'} · Совпадений: ${(st.photo.matchMap || []).length} · +точек: ${res.nodesAdded || 0}`
            : `Узлов модели: ${stats.totalNodes || 0} · Подтверждённых 2+: ${stats.confirmed2plus || 0}`,
        x, y + 32
    );
}
// ============================================================
// ФИНАЛЬНЫЙ ГРАФ (vis.js)
// ============================================================
function updateFinalGraph() {
    if (!steps.length) return;
    const graph = steps[steps.length - 1].model.graph;
    graphContainer.innerHTML = '';
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        graphContainer.innerHTML = '<p class="hint">Граф пуст — точек в модели нет.</p>';
        return;
    }
    const nodes = graph.nodes.map(n => ({
        id: n.id,
        label: n.id.replace(/^node_/, '').slice(0, 8),
        x: n.x * 3,
        y: n.y * 3,
        physics: false,
        size: 6 + (n.confirmationCount || 1),
        color: (n.confirmationCount || 1) >= 2
            ? { background: '#FFD700', border: '#B8860B' }
            : { background: '#4169E1', border: '#1E3A8A' }
    }));
    const edges = (graph.edges || []).map(e => ({ from: e.from, to: e.to }));
    try {
        network = new vis.Network(graphContainer, {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(edges)
        }, {
            physics: false,
            interaction: { dragNodes: false, zoomView: true },
            nodes: { shape: 'dot', font: { size: 8 } },
            edges: { color: '#888', width: 1 }
        });
    } catch (e) {
        graphContainer.innerHTML = '<p class="hint">Ошибка vis.js: ' + e.message + '</p>';
    }
}

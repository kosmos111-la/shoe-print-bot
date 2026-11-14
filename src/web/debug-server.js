// src/web/debug-server.js
// Локальный веб-интерфейс для отладки ядра (без Telegram).
// Запускается на порту 3001 только при DEBUG_WEB=1.
// НЕ трогает бота (порт 10000) и НЕ трогает modules/footprint/ — только вызывает их функции.
//
// Эндпоинты:
//   POST /api/debug/analyze    — пачка фото (FormData: photos[], sessionId) → {steps[], allResults}
//   POST /api/debug/add-photo  — одно фото (FormData: photo, sessionId) → {step}
//   GET  /api/debug/photo/:file — раздача фото для canvas
//   GET  /api/debug/health
//
// sessionId — пользователь песочницы ('web-debug-user' по умолчанию). Сброс =
// новый sessionId на клиенте (старая песочница остаётся в памяти, ядро не трогаем).
//
// Каждый «шаг» (step) — результат обработки ОДНОГО фото:
//   step.photo  — {file, photoUrl, predictions (ПОЛИГОНЫ), points, contour, matchMap}
//   step.result — {similarity, decision, nodesAdded}
//   step.model  — супер-модель после шага: {graph{nodes,edges}, triangles, modelContour, stats, transform}
//
// Единая схема id на клиенте: "pt_<индекс предсказания>". Сервер переводит длинные
// id ядра (pt_<ts>_<i>_<k>) в короткие, чтобы matchMap был согласован с points и graph.nodes.
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const { smartPostProcessing } = require('../utils/predictions');

const DEFAULT_USER = 'web-debug-user';
const MAX_BATCH = 20;

// 🔥 Кэш обработанных фото сессии — для «вынуть фото из сессии»:
// пересборка модели из кэша предсказаний БЕЗ повторного вызова Roboflow.
const sessionCache = new Map(); // userId → { photos: [{filename, originalname, predictions}] }

function cacheSessionPhoto(userId, photo) {
    if (!sessionCache.has(userId)) sessionCache.set(userId, { photos: [] });
    sessionCache.get(userId).photos.push(photo);
    // Предохранитель памяти: не больше 8 сессий в кэше (самые старые вытесняются)
    if (sessionCache.size > 8) {
        const oldest = sessionCache.keys().next().value;
        sessionCache.delete(oldest);
    }
}

module.exports = function createDebugServer(ctx, config) {
    const app = express();

    // Статика: web/ (index.html, app.js, style.css)
    app.use(express.static(path.join(__dirname, '../../web')));

    // Временная папка для загруженных фото
    const uploadDir = path.join(__dirname, '../../temp/web/');
    fs.mkdirSync(uploadDir, { recursive: true });
    const upload = multer({ dest: uploadDir });

    // Раздача загруженных фото (для canvas-фона): GET /api/debug/photo/<filename>
    app.use('/api/debug/photo', express.static(uploadDir));

    // JSON-тела (для /api/debug/remove-photo)
    app.use(express.json());

    // ============================================================
    // POST /api/debug/remove-photo — «вынуть фото из сессии».
    // Сбрасывает сессию ядра (clearSession) и ПЕРЕСОБИРАЕТ её из кэша предсказаний
    // (Roboflow НЕ вызывается). Возвращает свежие steps — фронт заменяет ряды.
    // Body: { sessionId, stepIndex } (0-based индекс фото в текущей последовательности)
    // ============================================================

    // ============================================================
    // POST /api/debug/analyze — пачка фото одной сессией.
    // Возвращает массив steps (по одному на каждое успешное фото).
    // ============================================================
    app.post('/api/debug/analyze', upload.array('photos', MAX_BATCH), async (req, res) => {
        const userId = (req.body && req.body.sessionId) || DEFAULT_USER;

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'Нет файлов photos' });
            }

            const steps = [];
            const allResults = [];

            for (const file of req.files) {
                try {
                    const out = await processPhotoFile(ctx, config, file, req.query, userId);
                    if (!out.ok) {
                        allResults.push({ file: file.originalname, skipped: true, reason: out.reason });
                        continue;
                    }
                    allResults.push({
                        file: file.originalname,
                        similarity: out.step.result.similarity,
                        decision: out.step.result.decision,
                        nodesAdded: out.step.result.nodesAdded
                    });
                    steps.push(out.step);
                } catch (e) {
                    console.log('❌ Ошибка файла ' + file.originalname + ':', e.message);
                    allResults.push({ file: file.originalname, skipped: true, reason: 'ошибка: ' + e.message });
                }
            }

            if (steps.length === 0) {
                return res.status(422).json({
                    error: 'Ни один файл не дал достаточно протекторов',
                    allResults
                });
            }

            const last = steps[steps.length - 1];
            res.json({
                success: true,
                similarity: last.result.similarity,
                decision: last.result.decision,
                steps,
                allResults
            });

        } catch (error) {
            console.error('❌ Ошибка /api/debug/analyze:', error.message);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    });

    // ============================================================
    // POST /api/debug/add-photo — одно фото в ТУ ЖЕ сессию (кнопка «➕ Добавить ещё фото»).
    // ============================================================
    app.post('/api/debug/add-photo', upload.single('photo'), async (req, res) => {
        const userId = (req.body && req.body.sessionId) || DEFAULT_USER;

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Нет файла photo' });
            }

            const out = await processPhotoFile(ctx, config, req.file, req.query, userId);
            if (!out.ok) {
                return res.status(422).json({
                    success: false,
                    error: out.reason,
                    file: req.file.originalname
                });
            }

            res.json({ success: true, step: out.step });

        } catch (error) {
            console.error('❌ Ошибка /api/debug/add-photo:', error.message);
            res.status(500).json({
                error: error.message,
                stack: error.stack,
                hint: 'Если ошибка про bot.sendMessage — это ожидаемо (бота нет в отладке).'
            });
        }
    });

    // Простой health-check
    app.get('/api/debug/health', (req, res) => {
        res.json({ status: 'ok', time: new Date().toISOString() });
    });

    // ============================================================
    // POST /api/debug/remove-photo — «вынуть фото из сессии».
    // Сбрасывает сессию ядра (clearSession) и ПЕРЕСОБИРАЕТ её из кэша предсказаний
    // (Roboflow НЕ вызывается). Возвращает свежие steps — фронт заменяет ряды.
    // Body: { sessionId, stepIndex } (0-based индекс фото в текущей последовательности)
    // ============================================================
    app.post('/api/debug/remove-photo', async (req, res) => {
        const userId = (req.body && req.body.sessionId) || DEFAULT_USER;
        const stepIndex = req.body && req.body.stepIndex;

        try {
            const cached = sessionCache.get(userId);
            if (!cached || !Array.isArray(cached.photos) || cached.photos.length === 0) {
                return res.status(404).json({
                    error: 'Сессия не в кэше — пересобрать нельзя (перезагрузите фото заново)'
                });
            }
            if (typeof stepIndex !== 'number' || stepIndex < 0 || stepIndex >= cached.photos.length) {
                return res.status(400).json({
                    error: `stepIndex вне диапазона (0..${cached.photos.length - 1})`
                });
            }

            const removed = cached.photos.splice(stepIndex, 1)[0];
            console.log(`🗑️ Убираю фото #${stepIndex} (${removed.originalname}); осталось ${cached.photos.length}`);

            // 1) Полный сброс сессии ядра (публичный метод SimpleFootprintManager)
            if (!ctx.footprintManager || !ctx.footprintManager.clearSession) {
                return res.status(500).json({ error: 'clearSession недоступен у footprintManager' });
            }
            ctx.footprintManager.clearSession(userId);

            // 2) Пересборка из кэша (без Roboflow)
            const steps = [];
            const allResults = [];
            for (let i = 0; i < cached.photos.length; i++) {
                const ph = cached.photos[i];
                try {
                    const out = await processPredictions(
                        ctx, userId,
                        { filename: ph.filename, originalname: ph.originalname },
                        ph.predictions
                    );
                    if (!out.ok) {
                        allResults.push({ file: ph.originalname, skipped: true, reason: out.reason });
                        continue;
                    }
                    allResults.push({
                        file: ph.originalname,
                        similarity: out.step.result.similarity,
                        decision: out.step.result.decision,
                        nodesAdded: out.step.result.nodesAdded
                    });
                    steps.push(out.step);
                } catch (e) {
                    allResults.push({ file: ph.originalname, skipped: true, reason: 'ошибка: ' + e.message });
                }
            }

            if (steps.length === 0) {
                return res.status(422).json({
                    error: 'После удаления не осталось обрабатываемых фото',
                    allResults
                });
            }

            const last = steps[steps.length - 1];
            res.json({
                success: true,
                similarity: last.result.similarity,
                decision: last.result.decision,
                steps,
                allResults,
                removed: removed.originalname
            });

        } catch (error) {
            console.error('❌ Ошибка /api/debug/remove-photo:', error.message);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    });

    return app;
};

// ============================================================
// 🔥 ОБРАБОТКА ОДНОГО ФОТО: Roboflow → addPhotoToSession → данные шага
// ============================================================
const MAX_LOG_LINES = 600;

function fmtLogArg(a) {
    if (typeof a === 'string') return a;
    if (typeof a === 'number' || typeof a === 'boolean') return String(a);
    if (a instanceof Error) return a.stack || a.message;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
}

async function processPhotoFile(ctx, config, file, query, userId) {
    console.log(`\n📸 Обработка файла: ${file.originalname} (сессия ${userId})`);

    // 1) Roboflow (как в photo.handler.js)
    const form = new FormData();
    form.append('file', fs.createReadStream(file.path));

    const rf = await axios({
        method: 'POST',
        url: config.ROBOFLOW.API_URL,
        params: {
            api_key: config.ROBOFLOW.API_KEY,
            confidence: config.ROBOFLOW.CONFIDENCE,
            overlap: config.ROBOFLOW.OVERLAP,
            format: 'json'
        },
        data: form,
        headers: { ...form.getHeaders(), 'User-Agent': 'axios/1.0', 'Accept': 'application/json' },
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });

    const predictions = rf.data.predictions || [];

    // 2) Постобработка (как бот)
    const processed = smartPostProcessing(predictions);

    // 3) Фильтр протекторов (как бот), animalFilter опционален (?skipAnimalFilter=1)
    let predictionsForAnalysis = processed;
    if (query && query.skipAnimalFilter !== '1' && ctx.animalFilter) {
        try {
            const animalFilterResult = ctx.animalFilter.filterAnimalPaws(processed);
            predictionsForAnalysis = animalFilterResult.filtered;
        } catch (e) {
            console.log('⚠️ animalFilter пропущен:', e.message);
        }
    }

    const shoeProtectors = predictionsForAnalysis.filter(p =>
        p.class === 'shoe-protector' || (p.confidence || 0) > 0.3
    );

    if (shoeProtectors.length < 3) {
        console.log(`⚠️ ${file.originalname}: мало протекторов (${shoeProtectors.length}), пропускаю`);
        return { ok: false, reason: `мало протекторов: ${shoeProtectors.length}` };
    }

    // 4+) Ядро + сбор данных шага (с перехватом консоли ядра)
    const out = await processPredictions(ctx, userId, { filename: file.filename, originalname: file.originalname }, shoeProtectors);

    // 🔥 Кэшируем успешно обработанное фото — нужно для «вынуть фото из сессии»
    // (пересборка модели из кэша, БЕЗ повторного вызова Roboflow)
    if (out.ok) {
        cacheSessionPhoto(userId, {
            filename: file.filename,
            originalname: file.originalname,
            predictions: shoeProtectors
        });
    }

    return out;
}

// Общая часть ПОСЛЕ Roboflow: addPhotoToSession + сбор данных шага.
// Используется и при пересборке сессии из кэша (remove-photo) — Roboflow НЕ вызывается.
// Вокруг вызова ядра ЗАХВАТЫВАЕМ console.log/warn/error — диагностика ядра
// (transform, medianError, якоря и т.п.) попадает в step.logs. Математику ядра не трогаем.
async function processPredictions(ctx, userId, fileRef, shoeProtectors) {
    const logs = [];
    const origLog = console.log, origWarn = console.warn, origError = console.error;
    console.log = (...args) => { logs.push(args.map(fmtLogArg).join(' ')); origLog(...args); };
    console.warn = (...args) => { logs.push('⚠️ ' + args.map(fmtLogArg).join(' ')); origWarn(...args); };
    console.error = (...args) => { logs.push('❌ ' + args.map(fmtLogArg).join(' ')); origError(...args); };

    try {
        if (shoeProtectors.length < 3) {
            console.log(`⚠️ ${fileRef.originalname}: мало протекторов (${shoeProtectors.length}), пропускаю`);
            return { ok: false, reason: `мало протекторов: ${shoeProtectors.length}` };
        }

        // 4) addPhotoToSession — bot = null, Telegram не нужен
        const result = await ctx.footprintManager.addPhotoToSession(
            userId,
            { predictions: shoeProtectors },
            {
                photoId: fileRef.filename,
                localPath: null,
                timestamp: new Date(),
                isBatch: false
            },
            null, // bot
            null  // chatId
        );

        // 🛡️ F2: шаг, на котором слияние ОТКЛОНЕНО (transform_guard / validation_failed /
        // transform_failed). Модель НЕ менялась, а structures в ней — УСТАРЕВШИЕ с прошлого
        // успешного шага: их координаты относятся к ДРУГОМУ фото, рисовать их на холстах
        // текущего фото нельзя (каша, лучи в угол).
        const mergeRejected = logs.some(l =>
            /ПРЕДОХРАНИТЕЛЬ: слияние ОТМЕНЕНО|transform_guard|validation_failed|transform_failed|Улучшение модели не удалось/.test(l)
        );

        // 5) Данные фото + matchMap (снимаем СРАЗУ после обработки — соответствие именно этого шага)
        const photo = buildPhotoPayload(ctx, userId, fileRef, shoeProtectors, { mergeRejected });

        // 6) Супер-модель после шага
        const model = collectModelData(ctx, userId);

        // 7) Сводка «почему» — вычисляется из уже собранных данных (математику не трогаем)
        const raySuccess = photo.rays.filter(r => r.type === 'success').length;
        const rayFailed = photo.rays.filter(r => r.type === 'failed').length;
        logs.push('\n📊 СВОДКА ШАГА (собрано debug-server\'ом):');
        if (mergeRejected) {
            logs.push('   ⚠️ Слияние ОТКЛОНЕНО — matchMap/треугольники/лучи не показаны (данные устаревшие с прошлого шага)');
        }
        logs.push(`   • Якорных треугольников: ${photo.matchedTriangles.length}`);
        logs.push(`   • Лучей: success=${raySuccess}, failed=${rayFailed} (${rayFailed > 0 ? 'есть отклонённые кандидаты' : 'все согласованы'})`);
        if (model.transform) {
            logs.push(`   • Transform (фото→модель): scale=${model.transform.scale.toFixed(3)}, ` +
                      `rot=${(model.transform.rotation * 180 / Math.PI).toFixed(1)}°, ` +
                      `tx=${model.transform.tx.toFixed(1)}, ty=${model.transform.ty.toFixed(1)}`);
        }
        logs.push(`   • Совпадений в matchMap: ${photo.matchMap.length}`);
        logs.push(`   • Узлов модели: ${model.stats.totalNodes}, подтверждённых 2+: ${model.stats.confirmed2plus}`);
        // 🔍 Диагностика: сколько структур реально лежит на модели (не путать с matchedTriangles)
        const rawModel = getTopologyModel(ctx, userId);
        const structCount = (rawModel && rawModel.structures) ? rawModel.structures.length : 0;
        const structTris = structCount > 0
            ? rawModel.structures.reduce((n, s) => n + (Array.isArray(s.triangles) ? s.triangles.length : (s.triangles instanceof Map ? s.triangles.size : 0)), 0)
            : 0;
        logs.push(`   • Структур на модели: ${structCount}, треугольников в них: ${structTris}`);
        logs.push(`   • Решение: ${result.decision || 'unknown'}, сходство: ${((result.similarity || 0) * 100).toFixed(1)}%`);

        // 8) Структурированные события для панели лога:
        //    [Match] pt_a ↔ pt_b (score) и [Triangle] pt_a - pt_b - pt_c (anchor)
        const events = [];
        for (const m of photo.matchMap || []) {
            events.push({
                type: 'match',
                a: m.photoId,
                b: m.modelId,
                score: m.score || 0,
                status: m.status || 'anchor'
            });
        }
        for (const t of photo.matchedTriangles || []) {
            if (t.length === 3) events.push({ type: 'triangle', ids: t });
        }

        return {
            ok: true,
            step: {
                photo,
                result: {
                    similarity: result.similarity || 0,
                    decision: result.decision || 'unknown',
                    nodesAdded: result.nodesAdded || 0
                },
                model,
                transform: model.transform,
                logs: logs.slice(-MAX_LOG_LINES),
                events
            }
        };
    } finally {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;
    }
}

// ============================================================
// 🔥 ДАННЫЕ ОДНОГО ФОТО ДЛЯ ХОЛСТА
// ============================================================
function buildPhotoPayload(ctx, userId, file, predictions, opts = {}) {
    const extracted = extractPhotoData(predictions); // точки с id pt_<индекс>

    const payload = {
        file: file.originalname,
        photoUrl: `/api/debug/photo/${file.filename}`,
        // ПОЛИГОНЫ от Roboflow (не bbox!) — слой detections
        predictions: (predictions || [])
            .filter(p => p && p.points && Array.isArray(p.points) && p.points.length > 0)
            .map(p => ({
                class: p.class,
                confidence: p.confidence,
                points: p.points.map(pt => ({ x: pt.x, y: pt.y }))
            })),
        // Центры протекторов — слой topology (координаты этого фото)
        points: extracted.points.map(p => ({ id: p.id, x: p.x, y: p.y, sourceIndex: p.sourceIndex })),
        // Контур следа (для справки)
        contour: extracted.outlineContour ? extracted.outlineContour.points.map(p => ({ x: p.x, y: p.y })) : [],
        // Соответствия: точки этого фото ↔ узлы модели
        matchMap: [],
        // Якорные треугольники (на которых сошлись модель и фото) + опорные лучи.
        // Источник — structures аккумулятора: вершины p1/p2/p3 и externalPoint —
        // точки графа ТЕКУЩЕГО фото → координаты в пикселях этого фото.
        matchedTriangles: [],
        rays: []
    };

    try {
        payload.matchMap = remapCurrentMatchMap(ctx, userId);
        const model = getTopologyModel(ctx, userId);
        payload.matchedTriangles = serializeMatchedTriangles(model);
        payload.rays = serializeRays(model);
    } catch (e) {
        console.log('⚠️ данные TriangleMatcher для ' + file.originalname + ' не извлечены:', e.message);
    }

    // 🛡️ F2: если слияние этого шага ОТКЛОНЕНО — данные модели устаревшие
    // (с прошлого успешного шага): structures, лучи И matchMap (lastTriangleResult
    // не обновляется при отказе). Их НЕ показываем на холстах текущего фото —
    // иначе hover/match-линии указывали бы на «неправильные места» в модели.
    if (opts.mergeRejected) {
        payload.matchMap = [];
        payload.matchedTriangles = [];
        payload.rays = [];
        payload.mergeRejected = true;   // справка для фронта/лога
    }

    return payload;
}

// ============================================================
// 🔥 СУПЕР-МОДЕЛЬ: ГРАФ + ТРЕУГОЛЬНИКИ + КОНТУР + СТАТИСТИКА
// ============================================================
function collectModelData(ctx, userId) {
    const out = {
        graph: { nodes: [], edges: [] },
        triangles: [],
        modelContour: [],
        transform: null,
        stats: { totalNodes: 0, edges: 0, confirmed2plus: 0 }
    };

    try {
        let model = getTopologyModel(ctx, userId);
        let vizData = null;
        const tm = ctx.footprintManager && ctx.footprintManager.getTopologyManager
            ? ctx.footprintManager.getTopologyManager(userId) : null;
        if (tm && tm.getAccumulativeVisualizationData) {
            vizData = tm.getAccumulativeVisualizationData();
        }

        if (!model) {
            const session = ctx.footprintManager.getActiveSandboxSession
                ? ctx.footprintManager.getActiveSandboxSession(userId)
                : (ctx.footprintManager.getActiveSession
                    ? ctx.footprintManager.getActiveSession(userId) : null);
            model = findModelDeep(session) || findModelDeep(ctx.footprintManager);
        }

        if (model && model.graph) {
            // Единая карта меток (уникальность) для графа, треугольников и matchMap
            const coreLabels = buildModelLabelMap(model);
            // Граф: длинные id ядра → короткие pt_<индекс> (единая схема на клиенте)
            out.graph = relabelGraph(serializeGraph(model.graph), coreLabels);
            // Треугольники (тройки id, координаты модели)
            out.triangles = serializeTriangles(vizData && vizData.triangles)
                .map(tri => tri.map(id => coreLabels.get(id) || shortPointId(id)));

            out.stats = {
                totalNodes: out.graph.nodes.length,
                edges: out.graph.edges.length,
                confirmed2plus: out.graph.nodes.filter(n => (n.confirmationCount || 0) >= 2).length
            };
        }

        // Трансформация (фото → модель) — справка
        const rawTransform = (vizData && vizData.transform) || (model && model.transform) || null;
        out.transform = serializeTransform(rawTransform);

        // Контур модели — скорректированный по якорю (как в боте: vizData.outlineContour)
        const mc = (vizData && vizData.outlineContour) ||
                   (model && model.metadata &&
                       (model.metadata.outlineContour ||
                        (model.metadata.outlineContours && model.metadata.outlineContours.slice(-1)[0])));
        if (mc && mc.points) {
            out.modelContour = mc.points.map(p => ({ x: p.x, y: p.y }));
        }
    } catch (err) {
        console.log('⚠️ Не удалось извлечь супер-модель:', err.message);
    }

    return out;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

// Извлечение точек и контура из предсказаний.
// Точки: id = pt_<индекс предсказания>, sourceIndex = индекс в массиве predictions
// (тот же, что у ядра в extractPointsAndContours).
function extractPhotoData(predictions) {
    const points = [];
    const contours = [];
    let outlineContour = null;

    for (let i = 0; i < (predictions || []).length; i++) {
        const pred = predictions[i];
        if (!pred || typeof pred !== 'object') continue;

        // Контур следа — не точка, а отдельный контур
        if (pred.class === 'Outline-trail' && pred.points && Array.isArray(pred.points) && pred.points.length > 0) {
            outlineContour = {
                id: `outline_${i}`,
                points: pred.points,
                class: pred.class,
                confidence: pred.confidence || 0.5,
                type: 'footprint_outline'
            };
            continue;
        }

        // 🛡️ ШАГ 1 (F3a): контурные классы (Heel/Toe/Dragged) — НЕ точки!
        // Центры блобов (пятка/носок/выволока) ломали бы топологию фото —
        // Делоне тянул бы рёбра через весь след. Полигоны остаются в predictions.
        const _pc = String(pred.class || '').toLowerCase().trim();
        if (_pc === 'heel' || _pc === 'toe' || _pc === 'dragged' || _pc === 'dragged and dragged') continue;

        if (pred.points && Array.isArray(pred.points) && pred.points.length > 0) {
            const xs = pred.points.map(p => p.x);
            const ys = pred.points.map(p => p.y);

            const id = `pt_${i}`;
            contours.push({
                id: `contour_${i}`,
                pointId: id,
                points: pred.points,
                class: pred.class,
                confidence: pred.confidence || 0.5
            });

            points.push({
                id,
                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                y: (Math.min(...ys) + Math.max(...ys)) / 2,
                confidence: pred.confidence || 0.5,
                class: pred.class,
                sourceIndex: i
            });
        }
    }

    if (outlineContour) contours.push(outlineContour);

    return { points, contours, outlineContour };
}

// Текущая модель через ПУБЛИЧНЫЙ API менеджера (ядро не трогаем)
function getTopologyModel(ctx, userId) {
    const tm = ctx.footprintManager && ctx.footprintManager.getTopologyManager
        ? ctx.footprintManager.getTopologyManager(userId) : null;
    return tm && tm.accumulator && tm.accumulator.getCurrentModel
        ? tm.accumulator.getCurrentModel() : null;
}

// Соответствия ядра → единая схема id.
// Ядро: photoId = pt_<ts>_<i>_<k> (i — индекс предсказания), modelId — id узла модели.
function remapCurrentMatchMap(ctx, userId) {
    const model = getTopologyModel(ctx, userId);
    const raw = model && model.lastTriangleResult && model.lastTriangleResult.matchMap;
    if (!raw) return [];

    const coreLabels = buildModelLabelMap(model);   // та же карта, что у графа/треугольников
    const out = [];
    const entries = raw instanceof Map ? raw.entries() : Object.entries(raw);
    for (const [photoId, match] of entries) {
        if (!match || !match.modelId) continue;
        const idx = parsePredIndex(photoId);
        if (idx === null) continue;              // формат id ядра изменился — пропускаем пару
        out.push({
            photoId: `pt_${idx}`,
            modelId: coreLabels.get(match.modelId) || shortPointId(match.modelId),
            pairNumber: match.pairNumber,
            status: match.status,
            score: match.confidence ?? match.score ?? 0   // для строк [Match]
        });
    }
    return out;
}

// Якорные треугольники: вершины совпавших треугольников структуры (граф ТЕКУЩЕГО фото).
// → [[id1, id2, id3], ...] (единая схема pt_<индекс>)
function serializeMatchedTriangles(model) {
    const out = [];
    for (const s of (model && model.structures) || []) {
        const tris = s.triangles instanceof Map ? Array.from(s.triangles.values())
                   : (Array.isArray(s.triangles) ? s.triangles : []);
        for (const t of tris) {
            if (!t || !t.p1 || !t.p2 || !t.p3) continue;
            out.push([shortPointId(t.p1.id), shortPointId(t.p2.id), shortPointId(t.p3.id)]);
        }
    }
    return out;
}

// Лучи структур: линии от вершин якорных треугольников к соседним точкам.
// 🔥 ФИКС БАГА КООРДИНАТ: вершины треугольников — точки ТЕКУЩЕГО фото (координаты фото),
// а edge.externalPoint в TriangleMatcher может быть точкой МОДЕЛИ (противоположная вершина
// сопоставленного треугольника графа модели — см. matching/TriangleMatcher.js, edge.externalPoint).
// Если id toPoint есть в графе МОДЕЛИ — приводим его в координаты фото обратной
// трансформацией структуры (structure.transform: фото → модель).
// Оба конца луча теперь всегда в координатах фото.
function serializeRays(model) {
    const out = [];
    const graphNodes = model && model.graph && model.graph.nodes;
    for (const s of (model && model.structures) || []) {
        const t = s.transform || null;
        // 🛡️ F1: валиден ли transform структуры для обратной трансформации модельного конца.
        // Мусорный transform (scale вне разумных пределов / нет поворота) кидал бы модельные
        // концы лучей в угол/кучку — такой луч НЕ инверсируем и помечаем для фронта.
        const tValid = !!(t && t.scale > 0 && t.scale >= 0.5 && t.scale <= 2 &&
                         Number.isFinite(t.rotation));
        for (const r of (s.rays || [])) {
            const from = r.fromPoint;
            const to = r.toPoint;
            if (!from || !to) continue;

            let toX = to.x, toY = to.y, toIsModel = false, transformInvalid = false;
            if (graphNodes && to.id !== undefined && to.id !== null &&
                (graphNodes instanceof Map ? graphNodes.has(to.id)
                                           : Object.prototype.hasOwnProperty.call(graphNodes, to.id))) {
                // toPoint — узел графа МОДЕЛИ → приводим в координаты фото
                if (tValid) {
                    const inv = inverseApplyTransform({ x: to.x, y: to.y }, t);
                    toX = inv.x; toY = inv.y;
                    toIsModel = true;
                } else {
                    // transform структуры мусорный/отсутствует — координаты недостоверны.
                    // НЕ инверсируем (иначе луч улетает в угол); фронт пропустит такой луч.
                    toX = to.x; toY = to.y;
                    toIsModel = true;
                    transformInvalid = true;
                }
            }

            out.push({
                from: shortPointId(from.id),
                to: shortPointId(to.id),
                type: r.type || 'unknown',           // 'success' | 'failed'
                x1: from.x, y1: from.y,              // координаты фото (вершина треугольника)
                x2: toX, y2: toY,                    // координаты фото (внешняя точка, при необходимости приведена)
                toIsModel: toIsModel,                // справка: конец был в координатах модели
                transformInvalid: transformInvalid,  // 🛡️ F1: конец модельный, transform мусорный — не рисовать
                distance: r.distance || 0,
                transform: serializeTransform(t)     // справка: фото → модель
            });
        }
    }
    return out;
}

// Обратная трансформация: координаты модели → координаты фото
// (инверсия applyTransform из modules/visualization/model-viz.js)
function inverseApplyTransform(point, transform) {
    if (!transform || !(transform.scale > 0)) return { x: point.x, y: point.y };
    const { scale, rotation } = transform;
    const tx = transform.tx ?? (transform.translation ? transform.translation.x : 0);
    const ty = transform.ty ?? (transform.translation ? transform.translation.y : 0);
    const dx = point.x - tx;
    const dy = point.y - ty;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    return {
        x: (dx * cosR + dy * sinR) / scale,
        y: (-dx * sinR + dy * cosR) / scale
    };
}

// Индекс предсказания из id ядра pt_<ts>_<i>_<k>
function parsePredIndex(id) {
    if (!id) return null;
    const parts = id.split('_');
    if (parts[0] !== 'pt' || parts.length < 4) return null;
    const idx = parseInt(parts[parts.length - 2], 10);
    return Number.isFinite(idx) ? idx : null;
}

// Длинный id ядра → короткий pt_<индекс> (fallback: хвост id)
function shortPointId(id) {
    if (!id) return id;
    const parts = id.split('_');
    if (parts[0] === 'pt' && parts.length >= 4) return `pt_${parts[parts.length - 2]}`;
    return id.slice(-12);
}

// Единая карта коротких id для узлов МОДЕЛИ с гарантией УНИКАЛЬНОСТИ.
// Регулярные узлы: pt_<индекс>; новые (node_...): метка по originalPhotoId;
// при коллизии — суффикс от исходного id (например pt_31_ab12).
// Одна и та же карта используется для графа, треугольников и matchMap —
// иначе id в ответе расходились бы (vis.js: «item with id pt_39 already exists»).
function buildModelLabelMap(model) {
    const map = new Map();
    const used = new Set();
    const nodes = model && model.graph && model.graph.nodes;
    if (!nodes) return map;
    const iter = nodes instanceof Map ? nodes.values()
        : (Array.isArray(nodes) ? nodes : Object.values(nodes || {}));
    for (const n of iter) {
        if (!n || !n.id) continue;
        let lab = shortPointId(n.id);
        if (!lab.startsWith('pt_') && n.originalPhotoId) {
            const src = shortPointId(n.originalPhotoId);
            if (src && src.startsWith('pt_')) lab = src;
        }
        if (used.has(lab)) {
            lab = `${lab}_${String(n.id).slice(-4)}`;   // коллизия — уникальный суффикс
        }
        used.add(lab);
        map.set(n.id, lab);
    }
    return map;
}

// Переводит сериализованный граф (id ядра) на короткие id
function relabelGraph(ser, coreLabels) {
    const labelMap = coreLabels || new Map();
    for (const n of ser.nodes) {
        const lab = labelMap.get(n.id) || shortPointId(n.id);
        labelMap.set(n.id, lab);
        n.coreId = n.id;
        n.id = lab;
    }
    for (const e of ser.edges) {
        e.from = labelMap.get(e.from) || shortPointId(e.from);
        e.to = labelMap.get(e.to) || shortPointId(e.to);
    }
    ser.triangles = (ser.triangles || []).map(tri => tri.map(id => labelMap.get(id) || shortPointId(id)));
    return ser;
}

// Трансформация фото → модель (плоский вид для клиента)
function serializeTransform(transform) {
    if (!transform) return null;
    return {
        scale: transform.scale,
        rotation: transform.rotation,
        tx: transform.tx ?? (transform.translation ? transform.translation.x : 0),
        ty: transform.ty ?? (transform.translation ? transform.translation.y : 0)
    };
}

// Треугольники → тройки id: [{p1,p2,p3}] или [['a','b','c']] → [['a','b','c']]
function serializeTriangles(triangles) {
    const out = [];
    for (const t of triangles || []) {
        if (Array.isArray(t) && t.length === 3) {
            out.push([t[0], t[1], t[2]]);
        } else if (t && t.p1 && t.p2 && t.p3) {
            out.push([t.p1.id, t.p2.id, t.p3.id]);
        }
    }
    return out;
}

// 🔥 Сериализация графа (устойчива к любому формату хранения)
function serializeGraph(graphObj) {
    const out = { nodes: [], edges: [], triangles: [] };
    if (!graphObj) return out;

    if (graphObj.nodes) {
        const nodesMap = graphObj.nodes;
        const pushNode = (n) => {
            if (n && n.id) {
                out.nodes.push({
                    id: n.id,
                    x: n.x,
                    y: n.y,
                    confirmationCount: n.confirmationCount || 1,
                    // 🔥 источник: новые узлы модели (node_...) несут id исходной точки фото
                    originalPhotoId: n.originalPhotoId
                });
            }
        };
        if (nodesMap instanceof Map) {
            nodesMap.forEach(pushNode);
        } else if (Array.isArray(nodesMap)) {
            nodesMap.forEach(pushNode);
        } else if (typeof nodesMap === 'object') {
            Object.values(nodesMap).forEach(pushNode);
        }
    }

    const rawEdges = graphObj.edges;
    if (rawEdges) {
        const pushEdge = (edge) => {
            if (typeof edge === 'string') {
                const parts = edge.split('--');
                if (parts.length === 2) out.edges.push({ from: parts[0], to: parts[1] });
            } else if (edge && edge.from && edge.to) {
                out.edges.push({ from: edge.from, to: edge.to });
            }
        };
        if (rawEdges instanceof Set || Array.isArray(rawEdges)) {
            rawEdges.forEach(pushEdge);
        } else if (rawEdges instanceof Map) {
            rawEdges.forEach(e => pushEdge(e));
        } else if (typeof rawEdges === 'object') {
            Object.values(rawEdges).forEach(pushEdge);
        }
    }

    if (graphObj.triangles) {
        out.triangles = Array.isArray(graphObj.triangles)
            ? graphObj.triangles.map(t => Array.isArray(t) ? t : (t.p1 && t.p2 && t.p3 ? [t.p1.id, t.p2.id, t.p3.id] : []))
            : [];
    } else if (graphObj.structures) {
        const structuresArr = graphObj.structures instanceof Map
            ? Array.from(graphObj.structures.values())
            : (Array.isArray(graphObj.structures) ? graphObj.structures : []);
        out.triangles = structuresArr
            .flatMap(s => Array.from(s.triangleIds || s.triangles || []))
            .map(t => Array.isArray(t) ? t : (t.p1 && t.p2 && t.p3 ? [t.p1.id, t.p2.id, t.p3.id] : []))
            .filter(t => t.length === 3);
    }
    return out;
}

// 🔥 Рекурсивный поиск модели (объекта с graph.nodes) в дереве объектов,
// с защитой от циклов.
function findModelDeep(root, depth = 0, visited) {
    if (depth > 6 || !root || typeof root !== 'object') return null;
    if (!visited) visited = new Set();
    if (visited.has(root)) return null;
    visited.add(root);

    if (root.graph && root.graph.nodes &&
        (root.graph.nodes instanceof Map || Array.isArray(root.graph.nodes))) {
        return root;
    }

    const keys = [
        'currentModel', 'model', 'models', 'currentFootprint', 'footprint',
        'topologyManager', 'accumulator', 'modelManager',
        'sessionManager', 'topologyManagers', 'sandbox'
    ];
    for (const key of keys) {
        const val = root[key];
        if (val === undefined || val === null) continue;
        if (Array.isArray(val)) {
            for (const item of val) {
                const m = findModelDeep(item, depth + 1, visited);
                if (m) return m;
            }
        } else if (typeof val === 'object') {
            if (val instanceof Map) {
                for (const v of val.values()) {
                    const m = findModelDeep(v, depth + 1, visited);
                    if (m) return m;
                }
            } else {
                const m = findModelDeep(val, depth + 1, visited);
                if (m) return m;
            }
        }
    }
    return null;
}

// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                                                                                 🔵
// 🔵                           АНАЛИЗАТОР СЛЕДОВ ОБУВИ                              🔵
// 🔵                         с улучшенной системой сравнения                        🔵
// 🔵                                                                                 🔵
// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const EXIF = require('exif');

// 🎯 НАСТРОЙКИ СРЕДЫ
const IS_PRODUCTION = process.env.NODE_ENV === 'production';



// 🎯 ТОКЕНЫ БОТОВ
const TELEGRAM_TOKEN = IS_PRODUCTION
    ? '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI' // твой основной бот
    : '8071471492:AAE6-qLAeimqu39JD_Ux-6kSy7CSUP2bMck'; // ⬅️ ЗАМЕНИ ЭТО на токен тестового бота!

const ROBOWFLOW_API_KEY = 'NeHOB854EyHkDbGGLE6G';

// 🎯 ИНИЦИАЛИЗАЦИЯ БОТА
const bot = new TelegramBot(TELEGRAM_TOKEN, {
    polling: {
        interval: 300,
        timeout: 10,
        limit: 100,
        retryTimeout: 1000,
        params: {
            timeout: 10
        }
    }
});

// 🛠️ ФИКС КОНФЛИКТА POLLING
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.log('⚠️ Обнаружен конфликт polling - перезапуск...');
        setTimeout(() => {
            bot.stopPolling().then(() => {
                setTimeout(() => bot.startPolling(), 2000);
            });
        }, 5000);
    } else {
        console.log('📡 Polling error:', error.message);
    }
});

console.log('🤖 Бот запущен в режиме Webhook');

// 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
// 🟢                 СИСТЕМА СЕССИЙ И ХРАНИЛИЩА DATA                   🟢
// 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢

let photoSessions = new Map();
const referencePrints = new Map();

function getSession(chatId) {
    if (!photoSessions.has(chatId)) {
        photoSessions.set(chatId, {
            active: false,
            photos: [],
            startTime: null,
            pendingLocation: null,
            waitingForReference: null,
            waitingForComparison: null
        });
    }
    return photoSessions.get(chatId);
}
// 🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡
// 🟡               УПРОЩЕНИЕ ПОЛИГОНОВ - ОПТИМИЗАЦИЯ                   🟡
// 🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡

function simplifyPolygon(points, epsilon = 1.0) {
    if (points.length <= 4) return points;

    function douglasPecker(points, epsilon) {
        if (points.length <= 2) return points;
       
        let maxDistance = 0;
        let index = 0;
        const start = points[0];
        const end = points[points.length - 1];
       
        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }
       
        if (maxDistance > epsilon) {
            const left = douglasPecker(points.slice(0, index + 1), epsilon);
            const right = douglasPecker(points.slice(index), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [start, end];
        }
    }
   
    function perpendicularDistance(point, lineStart, lineEnd) {
        const area = Math.abs(
            (lineEnd.x - lineStart.x) * (lineStart.y - point.y) -
            (lineStart.x - point.x) * (lineEnd.y - lineStart.y)
        );
        const lineLength = Math.sqrt(
            Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2)
        );
        return area / lineLength;
    }
   
    return douglasPecker(points, epsilon);
}

function optimizePolygonByClass(points, className, confidence) {
    if (!points || points.length < 3) return points;
   
    let epsilon;
    switch(className) {
        case 'shoe-protector':
            epsilon = 1.5;
            break;
        case 'Outline-trail':
            epsilon = 0.8;
            break;
        case 'Heel':
        case 'Toe':
            epsilon = 1.0;
            break;
        default:
            epsilon = 1.2;
    }
   
    const optimizedPoints = simplifyPolygon(points, epsilon);
   
    if (points.length !== optimizedPoints.length && points.length - optimizedPoints.length > 5) {
        console.log(`🔧 ${className}: ${points.length} → ${optimizedPoints.length} точек`);
    }
   
    return optimizedPoints;
}

// 🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️
// 🛠️               УМНАЯ ПОСТОБРАБОТКА - SMART POSTPROCESSING          🛠️
// 🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️🛠️

function smartPostProcessing(predictions) {
    if (!predictions || predictions.length === 0) return [];
   
    console.log(`🔧 Умная постобработка: ${predictions.length} объектов`);
   
    // 1. Фильтрация дубликатов и пересечений
    const filtered = removeOverlappingPolygons(predictions);
   
    // 2. Сохранение углов и острых краев
    const preserved = preserveSharpEdges(filtered);
   
    // 3. Улучшение геометрии без овализации
    const optimized = optimizeWithoutOvalization(preserved);
   
    console.log(`✅ После постобработки: ${optimized.length} объектов`);
   
    return optimized;
}

// 🎯 УДАЛЕНИЕ ПЕРЕКРЫВАЮЩИХСЯ ПОЛИГОНОВ
function removeOverlappingPolygons(predictions) {
    const filtered = [];
    const usedAreas = new Set();
   
    // Сортируем по confidence (сначала самые уверенные)
    const sorted = [...predictions].sort((a, b) => b.confidence - a.confidence);
   
    for (const pred of sorted) {
        if (!pred.points || pred.points.length < 3) continue;
       
        const bbox = calculateBoundingBox(pred.points);
        const areaKey = `${Math.round(bbox.minX/10)}_${Math.round(bbox.minY/10)}_${Math.round(bbox.maxX/10)}_${Math.round(bbox.maxY/10)}`;
       
        // Проверяем пересечение с уже добавленными
        let hasSignificantOverlap = false;
        for (const existing of filtered) {
            const overlap = calculateOverlap(pred, existing);
            if (overlap > 0.4) { // 40% перекрытие - слишком много
                hasSignificantOverlap = true;
                break;
            }
        }
       
        if (!hasSignificantOverlap && !usedAreas.has(areaKey)) {
            filtered.push(pred);
            usedAreas.add(areaKey);
        }
    }
   
    return filtered;
}

// 🎯 СОХРАНЕНИЕ ОСТРЫХ КРАЕВ
function preserveSharpEdges(predictions) {
    return predictions.map(pred => {
        if (!pred.points || pred.points.length < 4) return pred;
       
        const originalPoints = pred.points;
       
        // Анализируем углы полигона
        const angles = calculateAngles(originalPoints);
        const sharpAngles = angles.filter(angle => angle < 60 || angle > 120); // Острые и тупые углы
       
        if (sharpAngles.length > 0) {
            // Сохраняем оригинальную форму если есть острые углы
            console.log(`🔺 Сохранены острые углы для ${pred.class}: ${sharpAngles.length} углов`);
            return {
                ...pred,
                points: originalPoints,
                hasSharpEdges: true
            };
        }
       
        // Для округлых форм применяем щадящее упрощение
        const optimizedPoints = gentleSimplify(originalPoints, pred.class);
        return {
            ...pred,
            points: optimizedPoints,
            hasSharpEdges: false
        };
    });
}

// 🎯 ЩАДЯЩЕЕ УПРОЩЕНИЕ БЕЗ ОВАЛИЗАЦИИ
function gentleSimplify(points, className) {
    if (points.length <= 6) return points; // Не упрощаем маленькие полигоны
   
    const minPoints = {
        'shoe-protector': 8,
        'Outline-trail': 12,
        'Heel': 6,
        'Toe': 6,
        'default': 8
    };
   
    const targetPoints = minPoints[className] || minPoints.default;
   
    if (points.length <= targetPoints) return points;
   
    // Используем алгоритм Дугласа-Пекера с меньшим epsilon для сохранения деталей
    const epsilon = {
        'shoe-protector': 0.5,  // Меньше epsilon = больше деталей
        'Outline-trail': 0.8,
        'Heel': 0.6,
        'Toe': 0.6,
        'default': 0.5
    }[className] || 0.5;
   
    const simplified = simplifyPolygon(points, epsilon);
   
    // Гарантируем минимальное количество точек
    if (simplified.length < targetPoints) {
        // Добавляем ключевые точки обратно
        return addKeyPointsBack(points, simplified, targetPoints);
    }
   
    return simplified;
}

// 🎯 ДОБАВЛЕНИЕ КЛЮЧЕВЫХ ТОЧЕК ОБРАТНО
function addKeyPointsBack(original, simplified, targetCount) {
    if (simplified.length >= targetCount) return simplified;
   
    const allPoints = [...original];
    const result = [...simplified];
   
    // Находим точки с максимальным отклонением от упрощенного полигона
    while (result.length < targetCount && allPoints.length > 0) {
        let maxDistance = 0;
        let maxIndex = -1;
        let insertIndex = -1;
       
        for (let i = 0; i < allPoints.length; i++) {
            const point = allPoints[i];
            const distance = findMinDistanceToPolygon(point, result);
           
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
               
                // Находим куда вставить (между ближайшими точками)
                insertIndex = findInsertionIndex(point, result);
            }
        }
       
        if (maxIndex !== -1) {
            result.splice(insertIndex, 0, allPoints[maxIndex]);
            allPoints.splice(maxIndex, 1);
        } else {
            break;
        }
    }
   
    return result;
}

// 🎯 ОПТИМИЗАЦИЯ БЕЗ ОВАЛИЗАЦИИ
function optimizeWithoutOvalization(predictions) {
    return predictions.map(pred => {
        if (pred.hasSharpEdges) {
            return pred; // Уже обработано
        }
       
        const optimizedPoints = pred.points.map(point => ({
            x: Math.round(point.x),
            y: Math.round(point.y)
        }));
       
        // Убираем последовательные дубликаты
        const deduplicated = removeDuplicatePoints(optimizedPoints);
       
        return {
            ...pred,
            points: deduplicated,
            originalPointCount: pred.points.length,
            optimizedPointCount: deduplicated.length
        };
    });
}

// 🛠️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОСТОБРАБОТКИ

function calculateOverlap(poly1, poly2) {
    const bbox1 = calculateBoundingBox(poly1.points);
    const bbox2 = calculateBoundingBox(poly2.points);
   
    // Простая проверка пересечения bounding boxes
    const intersection = {
        x1: Math.max(bbox1.minX, bbox2.minX),
        y1: Math.max(bbox1.minY, bbox2.minY),
        x2: Math.min(bbox1.maxX, bbox2.maxX),
        y2: Math.min(bbox1.maxY, bbox2.maxY)
    };
   
    if (intersection.x1 >= intersection.x2 || intersection.y1 >= intersection.y2) {
        return 0; // Нет пересечения
    }
   
    const intersectionArea = (intersection.x2 - intersection.x1) * (intersection.y2 - intersection.y1);
    const area1 = bbox1.width * bbox1.height;
    const area2 = bbox2.width * bbox2.height;
   
    return intersectionArea / Math.min(area1, area2);
}

function calculateAngles(points) {
    const angles = [];
    const n = points.length;
   
    for (let i = 0; i < n; i++) {
        const p1 = points[(i - 1 + n) % n];
        const p2 = points[i];
        const p3 = points[(i + 1) % n];
       
        const angle = calculateAngle(p1, p2, p3);
        angles.push(angle);
    }
   
    return angles;
}

function calculateAngle(p1, p2, p3) {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
   
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
   
    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
   
    return angle;
}

function findMinDistanceToPolygon(point, polygon) {
    let minDistance = Infinity;
   
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
       
        const distance = pointToLineDistance(point, p1, p2);
        minDistance = Math.min(minDistance, distance);
    }
   
    return minDistance;
}

function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
   
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
   
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
   
    let xx, yy;
   
    if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
    } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
    } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
    }
   
    const dx = point.x - xx;
    const dy = point.y - yy;
   
    return Math.sqrt(dx * dx + dy * dy);
}

function findInsertionIndex(point, polygon) {
    let minDistance = Infinity;
    let insertIndex = 0;
   
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const distance = Math.sqrt(
            Math.pow(point.x - p1.x, 2) + Math.pow(point.y - p1.y, 2)
        );
       
        if (distance < minDistance) {
            minDistance = distance;
            insertIndex = i;
        }
    }
   
    return (insertIndex + 1) % polygon.length;
}

function removeDuplicatePoints(points) {
    const result = [];
    const tolerance = 1.0; // Пиксельная точность
   
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
       
        const distance = Math.sqrt(
            Math.pow(current.x - next.x, 2) + Math.pow(current.y - next.y, 2)
        );
       
        if (distance > tolerance) {
            result.push(current);
        }
    }
   
    // Гарантируем замкнутость полигона
    if (result.length > 2) {
        const first = result[0];
        const last = result[result.length - 1];
        const distance = Math.sqrt(
            Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
        );
       
        if (distance > tolerance) {
            result.push({ x: first.x, y: first.y });
        }
    }
   
    return result;
}

// 🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷
// 🔷               ИЗВЛЕЧЕНИЕ ПРИЗНАКОВ - FEATURES EXTRACT              🔷
// 🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷

function extractFeatures(predictions) {
    const features = {
        outline: null,
        details: [],
        heel: null,
        toe: null,
        boundingBox: null,
        totalArea: 0,
        detailCount: 0
    };

    predictions.forEach(pred => {
        switch(pred.class) {
            case 'Outline-trail':
                features.outline = {
                    points: pred.points,
                    area: calculatePolygonArea(pred.points),
                    center: { x: pred.x, y: pred.y }
                };
                break;
            case 'shoe-protector':
                features.details.push({
                    points: pred.points,
                    area: calculatePolygonArea(pred.points),
                    center: { x: pred.x, y: pred.y },
                    confidence: pred.confidence
                });
                break;
            case 'Heel':
                features.heel = {
                    points: pred.points,
                    area: calculatePolygonArea(pred.points),
                    center: { x: pred.x, y: pred.y }
                };
                break;
            case 'Toe':
                features.toe = {
                    points: pred.points,
                    area: calculatePolygonArea(pred.points),
                    center: { x: pred.x, y: pred.y }
                };
                break;
        }
    });

    if (features.outline) {
        features.totalArea = features.outline.area;
        features.boundingBox = calculateBoundingBox(features.outline.points);
    }
   
    features.detailCount = features.details.length;
   
    return features;
}

function calculatePolygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}

function calculateBoundingBox(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
}

function calculatePerimeter(points) {
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        perimeter += Math.sqrt(
            Math.pow(points[j].x - points[i].x, 2) +
            Math.pow(points[j].y - points[i].y, 2)
        );
    }
    return perimeter;
}

function calculateCompactness(points) {
    const area = calculatePolygonArea(points);
    const perimeter = calculatePerimeter(points);
    return (4 * Math.PI * area) / (perimeter * perimeter);
}

function calculateOverallBoundingBox(details) {
    const allPoints = details.flatMap(d => d.points);
    return calculateBoundingBox(allPoints);
}

function normalizePoint(point, bbox) {
    return {
        x: (point.x - bbox.minX) / bbox.width,
        y: (point.y - bbox.minY) / bbox.height
    };
}

function getDetailStatistics(details) {
    const areas = details.map(d => d.area);
    return {
        areas: areas,
        meanArea: areas.reduce((sum, area) => sum + area, 0) / areas.length,
        minArea: Math.min(...areas),
        maxArea: Math.max(...areas),
        count: details.length
    };
}

// ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
// ⭐                                                                               ⭐
// ⭐              УЛУЧШЕННОЕ СРАВНЕНИЕ ДЛЯ СЛЕДОВ - IMPROVED COMPARISON           ⭐
// ⭐                                                                               ⭐
// ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐

function compareFootprintWithReference(referenceFeatures, footprintFeatures) {
    console.log('🔍 УЛУЧШЕННОЕ СРАВНЕНИЕ: эталон vs след');
    console.log('Эталон:', {
        details: referenceFeatures.detailCount,
        area: referenceFeatures.totalArea
    });
    console.log('След:', {
        details: footprintFeatures.detailCount,
        area: footprintFeatures.totalArea
    });

    const scores = {
        macroPattern: 0,
        spatialLayout: 0,
        shapeCharacteristics: 0,
        sizeConsistency: 0,
        overallScore: 0
    };

    // 1. МАКРОУЗОР - сравниваем только крупные элементы (40%)
    if (referenceFeatures.details.length > 0 && footprintFeatures.details.length > 0) {
        const macroScore = compareMacroPattern(referenceFeatures.details, footprintFeatures.details);
        scores.macroPattern = macroScore * 100;
        console.log('🔷 Макроузоры:', scores.macroPattern.toFixed(1));
    }

    // 2. ПРОСТРАНСТВЕННОЕ РАСПОЛОЖЕНИЕ (30%)
    if (referenceFeatures.details.length > 1 && footprintFeatures.details.length > 1) {
        const layoutScore = compareSpatialLayout(referenceFeatures.details, footprintFeatures.details);
        scores.spatialLayout = layoutScore * 100;
        console.log('📐 Расположение:', scores.spatialLayout.toFixed(1));
    }

    // 3. ХАРАКТЕРНЫЕ ФОРМЫ (20%)
    if (referenceFeatures.details.length > 0 && footprintFeatures.details.length > 0) {
        const shapeScore = compareCharacteristicShapes(referenceFeatures.details, footprintFeatures.details);
        scores.shapeCharacteristics = shapeScore * 100;
        console.log('⭐ Характерные формы:', scores.shapeCharacteristics.toFixed(1));
    }

    // 4. СООТНОШЕНИЕ РАЗМЕРОВ (10%)
    if (referenceFeatures.outline && footprintFeatures.outline) {
        const sizeScore = compareSizeRatio(referenceFeatures, footprintFeatures);
        scores.sizeConsistency = sizeScore * 100;
        console.log('📏 Соотношение размеров:', scores.sizeConsistency.toFixed(1));
    } else {
        scores.sizeConsistency = 50;
    }

    // ОБЩИЙ СЧЕТ с учетом особенностей следов
    scores.overallScore =
        scores.macroPattern * 0.4 +
        scores.spatialLayout * 0.3 +
        scores.shapeCharacteristics * 0.2 +
        scores.sizeConsistency * 0.1;

    console.log('🎯 ИТОГОВЫЙ СЧЕТ (след):', scores.overallScore.toFixed(1));

    return scores;
}

function compareMacroPattern(refDetails, footprintDetails) {
    const largeRefDetails = refDetails.filter(d => d.area > 500);
    const largeFootprintDetails = footprintDetails.filter(d => d.area > 300);
   
    if (largeRefDetails.length === 0 || largeFootprintDetails.length === 0) {
        return 0.3;
    }

    const refStats = getDetailStatistics(largeRefDetails);
    const footprintStats = getDetailStatistics(largeFootprintDetails);

    const countSimilarity = Math.min(largeRefDetails.length, largeFootprintDetails.length) /
                          Math.max(largeRefDetails.length, largeFootprintDetails.length);

    const sizeTolerance = 0.6;
    const sizeDiff = Math.abs(refStats.meanArea - footprintStats.meanArea);
    const maxArea = Math.max(refStats.meanArea, footprintStats.meanArea);
    const sizeSimilarity = Math.max(0, 1 - (sizeDiff / (maxArea * sizeTolerance)));

    return (countSimilarity * 0.6 + sizeSimilarity * 0.4);
}

function compareSpatialLayout(refDetails, footprintDetails) {
    const refBBox = calculateOverallBoundingBox(refDetails);
    const footprintBBox = calculateOverallBoundingBox(footprintDetails);
   
    const topRef = refDetails
        .sort((a, b) => b.area - a.area)
        .slice(0, 8);
       
    const topFootprint = footprintDetails
        .sort((a, b) => b.area - a.area)
        .slice(0, 8);

    const refCenters = topRef.map(d => normalizePoint(d.center, refBBox));
    const footprintCenters = topFootprint.map(d => normalizePoint(d.center, footprintBBox));

    let totalSimilarity = 0;
    const comparisons = Math.min(refCenters.length, footprintCenters.length);
   
    if (comparisons === 0) return 0.3;

    for (let i = 0; i < comparisons; i++) {
        for (let j = i + 1; j < comparisons; j++) {
            const refDistance = calculateDistance(refCenters[i], refCenters[j]);
            const footprintDistance = calculateDistance(footprintCenters[i], footprintCenters[j]);
           
            const distanceSimilarity = 1 - Math.abs(refDistance - footprintDistance) /
                                     Math.max(refDistance, footprintDistance);
            const tolerantSimilarity = Math.max(0, distanceSimilarity - 0.4) / 0.6;
           
            totalSimilarity += Math.max(0, tolerantSimilarity);
        }
    }

    const maxComparisons = (comparisons * (comparisons - 1)) / 2;
    return maxComparisons > 0 ? totalSimilarity / maxComparisons : 0.3;
}

function compareCharacteristicShapes(refDetails, footprintDetails) {
    const refShapes = refDetails.map(describeShape);
    const footprintShapes = footprintDetails.map(describeShape);
   
    const topRef = refShapes.sort((a, b) => b.characteristic - a.characteristic).slice(0, 5);
    const topFootprint = footprintShapes.sort((a, b) => b.characteristic - a.characteristic).slice(0, 5);
   
    let totalSimilarity = 0;
    const comparisons = Math.min(topRef.length, topFootprint.length);
   
    if (comparisons === 0) return 0.2;

    for (let i = 0; i < comparisons; i++) {
        const shapeSimilarity = compareShapeDescriptors(topRef[i], topFootprint[i]);
        totalSimilarity += shapeSimilarity;
    }

    return totalSimilarity / comparisons;
}

function describeShape(detail) {
    const bbox = calculateBoundingBox(detail.points);
    const aspectRatio = bbox.width / bbox.height;
    const compactness = calculateCompactness(detail.points);
   
    let shapeType = 'unknown';
    let characteristic = 0;
   
    if (compactness > 0.8 && Math.abs(aspectRatio - 1) < 0.3) {
        shapeType = 'circle';
        characteristic = compactness;
    } else if (compactness > 0.7 && (aspectRatio > 1.5 || aspectRatio < 0.67)) {
        shapeType = 'rectangle';
        characteristic = Math.min(aspectRatio, 1/aspectRatio);
    } else if (compactness < 0.6) {
        shapeType = 'irregular';
        characteristic = 1 - compactness;
    }
   
    return {
        type: shapeType,
        aspectRatio,
        compactness,
        characteristic,
        area: detail.area
    };
}

function compareShapeDescriptors(shape1, shape2) {
    let similarity = 0;
   
    if (shape1.type === shape2.type) {
        similarity += 0.4;
    }
   
    const aspectSimilarity = 1 - Math.abs(shape1.aspectRatio - shape2.aspectRatio) /
                           Math.max(shape1.aspectRatio, shape2.aspectRatio);
    similarity += aspectSimilarity * 0.3;
   
    const compactnessSimilarity = 1 - Math.abs(shape1.compactness - shape2.compactness);
    similarity += compactnessSimilarity * 0.3;
   
    return similarity;
}

function compareSizeRatio(refFeatures, footprintFeatures) {
    if (!refFeatures.outline || !footprintFeatures.outline) return 0.5;
   
    const refArea = refFeatures.outline.area;
    const footprintArea = footprintFeatures.outline.area;
   
    const areaRatio = Math.min(refArea, footprintArea) / Math.max(refArea, footprintArea);
    return Math.max(0, (areaRatio - 0.4) / 0.6);
}

function calculateDistance(point1, point2) {
    return Math.sqrt(
        Math.pow(point1.x - point2.x, 2) +
        Math.pow(point1.y - point2.y, 2)
    );
}

function compareFeatures(features1, features2, isFootprintComparison = false) {
    if (isFootprintComparison) {
        return compareFootprintWithReference(features1, features2);
    }
   
    console.log('🔍 Сравнение эталонов...');
    const scores = compareFootprintWithReference(features1, features2);
   
    scores.overallScore = Math.min(100, scores.overallScore * 1.2);
   
    return scores;
}

// 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟
// 🌟                                                                               🌟
// 🌟              АДАПТИВНЫЕ ПОРОГИ ДОВЕРИЯ - ADAPTIVE CONFIDENCE                 🌟
// 🌟                                                                               🌟
// 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟

class ShootingConditionsDetector {
    static analyzeImage(imageData) {
        const conditions = {
            lighting: this.detectLighting(imageData),
            surface: 'unknown',
            complexity: 0.5
        };
       
        return conditions;
    }
   
    static detectLighting(imageData) {
        const avgBrightness = this.getAverageBrightness(imageData);
       
        if (avgBrightness < 60) return 'night';
        if (avgBrightness > 180) return 'bright';
        if (avgBrightness > 120) return 'normal';
        return 'overcast';
    }
   
    static getAverageBrightness(imageData) {
        let total = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
            total += (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        }
        return total / (imageData.data.length / 4);
    }
}

function getDynamicConfidence(conditions) {
    const confidenceMatrix = {
        night: 20,
        overcast: 25,
        normal: 30,
        bright: 28
    };
   
    return confidenceMatrix[conditions.lighting] || 25;
}

// 🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨
// 🎨               ВОДЯНОЙ ЗНАК - WATERMARK SYSTEM                    🎨
// 🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨

function addWatermark(ctx, imageWidth, imageHeight, userData) {
    const {
        username = 'Неизвестно',
        dateTime = null,
        coordinates = null,
        accuracy = null,
        locationSource = 'ручная'
    } = userData;

    const displayDate = dateTime || new Date();
   
    const formattedDate = displayDate.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let coordsText = '';
    if (coordinates) {
        const { latitude, longitude } = coordinates;
        coordsText = `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        if (accuracy) {
            coordsText += ` ±${accuracy}m`;
        }
        coordsText += ` (${locationSource})`;
    }

    const lines = [
        `👤 ${username}`,
        `📅 ${formattedDate}${!dateTime ? ' (обработки)' : ' (съемки)'}`,
        ...(coordsText ? [coordsText] : [])
    ];

    const padding = 15;
    const fontSize = 14;
    const lineHeight = 20;
    const backgroundColor = 'rgba(0, 0, 0, 0.7)';
    const textColor = 'rgba(255, 255, 255, 0.9)';

    ctx.font = `bold ${fontSize}px Arial`;
   
    const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const blockHeight = lines.length * lineHeight + padding;
    const blockWidth = textWidth + padding * 2;

    const x = imageWidth - blockWidth - 20;
    const y = imageHeight - blockHeight - 20;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(x, y, blockWidth, blockHeight);

    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
   
    lines.forEach((line, index) => {
        ctx.fillText(line, x + padding, y + padding + index * lineHeight);
    });
}

// 📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸
// 📸               ОСНОВНЫЕ ФУНКЦИИ - CORE FUNCTIONS                  📸
// 📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸

async function analyzeSinglePhoto(imageUrl) {
    try {
        console.log('🔄 Отправляю запрос к Roboflow...');
       
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, image.width, image.height);
       
        const conditions = ShootingConditionsDetector.analyzeImage(imageData);
        const dynamicConfidence = getDynamicConfidence(conditions);
       
        console.log(`🎯 Адаптивные настройки: ${conditions.lighting}, confidence: ${dynamicConfidence}`);
       
        const response = await axios({
            method: "POST",
            url: 'https://detect.roboflow.com/-zqyih/12',
            params: {
                api_key: 'NeHOB854EyHkDbGGLE6G',
                image: imageUrl,
                confidence: dynamicConfidence,
                overlap: 30,
                format: 'json'
            }
        });
       
        console.log('🔍 Roboflow вернул:', response.data.predictions.length, 'объектов');
       
        const filtered = response.data.predictions.filter(pred =>
            pred.confidence > (dynamicConfidence / 100) &&
            pred.points &&
            pred.points.length >= 3
        );
       
        console.log('✅ После фильтрации:', filtered.length, 'объектов');
       
        // ⭐⭐ ВАЖНО: ЗАМЕНЯЕМ старую оптимизацию на умную постобработку ⭐⭐
        // БЫЛО: const optimized = filtered.map(pred => { ... optimizePolygonByClass ... });
        // СТАЛО:
        const optimized = smartPostProcessing(filtered);
       
        console.log(`🎯 После умной обработки: ${optimized.length} объектов`);
       
        return optimized;
       
    } catch (error) {
        console.log('Analysis error:', error.message);
        return [];
    }
}

// 🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️
// 🖼️               ВИЗУАЛИЗАЦИЯ - VISUALIZATION SYSTEM               🖼️
// 🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️🖼️

function getColorForClass(className, confidence, isCombined = false) {
    const baseColors = {
        'Outline-trail': {
            stroke: 'rgba(148, 0, 211, 1)',
            fill: 'rgba(148, 0, 211, 0.2)',
            name: 'КОНТУР'
        },
        'shoe-protector': {
            stroke: 'rgba(64, 224, 208, 1)',
            fill: null,
            name: 'ДЕТАЛЬ'
        },
        'Heel': {
            stroke: 'rgba(0, 0, 255, 1)',
            fill: null,
            name: 'КАБЛУК'
        },
        'Toe': {
            stroke: 'rgba(30, 144, 255, 1)',
            fill: null,
            name: 'МЫСОК'
        }
    };
   
    const defaultColor = {
        stroke: 'rgba(255, 255, 255, 1)',
        fill: null,
        name: 'ДРУГОЙ'
    };
   
    const color = baseColors[className] || defaultColor;
   
    if (isCombined) {
        const alpha = 0.4 + (confidence * 0.6);
        return {
            ...color,
            stroke: color.stroke.replace('1)', `${alpha.toFixed(2)})`),
            fill: color.fill ? color.fill.replace('0.2)', `${(alpha * 0.3).toFixed(2)})`) : null
        };
    }
   
    return color;
}

async function createPolygonVisualization(imageUrl, predictions, isCombined = false, userData = {}) {
    try {
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
       
        ctx.drawImage(image, 0, 0);
       
        const sortedPredictions = [...predictions].sort((a, b) => {
            const order = { 'Outline-trail': 0, 'shoe-protector': 1, 'Heel': 2, 'Toe': 3 };
            return (order[a.class] || 4) - (order[b.class] || 4);
        });
       
        sortedPredictions.forEach((pred, index) => {
            if (pred.points && pred.points.length > 2) {
                const color = getColorForClass(pred.class, pred.confidence, isCombined);
               
                if (pred.class === 'Outline-trail' && color.fill) {
                    ctx.fillStyle = color.fill;
                    ctx.beginPath();
                    ctx.moveTo(pred.points[0].x, pred.points[0].y);
                    for (let i = 1; i < pred.points.length; i++) {
                        ctx.lineTo(pred.points[i].x, pred.points[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
               
                let lineWidth;
                switch(pred.class) {
                    case 'Outline-trail':
                        lineWidth = isCombined ? 5 : 6;
                        break;
                    case 'shoe-protector':
                        lineWidth = isCombined ? 2 : 3;
                        break;
                    case 'Heel':
                    case 'Toe':
                        lineWidth = isCombined ? 1 : 2;
                        break;
                    default:
                        lineWidth = isCombined ? 2 : 3;
                }
               
                ctx.strokeStyle = color.stroke;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(pred.points[0].x, pred.points[0].y);
                for (let i = 1; i < pred.points.length; i++) {
                    ctx.lineTo(pred.points[i].x, pred.points[i].y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        });

        addWatermark(ctx, image.width, image.height, userData);
       
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
        const vizPath = `${isCombined ? 'consensus' : 'single'}_viz_${Date.now()}.jpg`;
        fs.writeFileSync(vizPath, buffer);
       
        return vizPath;
       
    } catch (error) {
        console.log('Visualization error:', error.message);
        return null;
    }
}

// 🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖
// 🤖               ТЕЛЕГРАМ БОТ - TELEGRAM BOT CORE                  🤖
// 🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖

console.log('🤖 Бот запущен! Улучшенный алгоритм сравнения с адаптивными порогами');

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const session = getSession(chatId);
    
    try {
        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
        
        console.log('📥 Получено фото для:',
            session.waitingForReference ? 'сохранения эталона' :
            session.waitingForComparison ? 'сравнения' : 'обычного анализа');

        const predictions = await analyzeSinglePhoto(fileUrl);
        
        // 🎯 ТЕСТ СБОРА ДАННЫХ (ДОБАВЬ ЗДЕСЬ)
        console.log('📊 СТАТИСТИКА ДЛЯ СБОРА:');
        console.log('- Фото от пользователя:', msg.from.username || 'anonymous');
        console.log('- Найдено объектов:', predictions.length);
        console.log('- Классы:', [...new Set(predictions.map(p => p.class))]);
        if (predictions.length > 0) {
            console.log('- Уверенность средняя:', (predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length).toFixed(2));
        }
        // 🎯 КОНЕЦ ТЕСТА
        
        if (predictions.length === 0) {
            await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
            return;
        }

        const features = extractFeatures(predictions);
        console.log('🔍 Извлечены признаки:', {
            outline: !!features.outline,
            details: features.detailCount,
            totalArea: features.totalArea
        });

        // 1. Если сохраняем эталон
        if (session.waitingForReference) {
            const modelName = session.waitingForReference;
            referencePrints.set(modelName, {
                features: features,
                imageUrl: fileUrl,
                timestamp: new Date(),
                predictions: predictions
            });
           
            await bot.sendMessage(chatId,
                `✅ Эталон сохранен: "${modelName}"\n` +
                `📊 Детали: ${features.detailCount} элементов, площадь: ${features.totalArea.toFixed(0)}px²\n\n` +
                'Используйте /compare для сравнения со следами'
            );
           
            session.waitingForReference = null;
            return;
        }

        // 2. Если сравниваем со следом
        if (session.waitingForComparison && session.waitingForComparison.isFootprint) {
            const modelName = session.waitingForComparison.modelName;
            const reference = referencePrints.get(modelName);
           
            if (!reference) {
                await bot.sendMessage(chatId, `❌ Эталон "${modelName}" не найден`);
                session.waitingForComparison = null;
                return;
            }

            console.log(`🔍 Сравнение СЛЕДА с эталоном: "${modelName}"`);
            console.log('Эталон деталей:', reference.features.detailCount);
            console.log('След деталей:', features.detailCount);

            const comparison = compareFeatures(reference.features, features, true);
           
            let report = `🔍 **СРАВНЕНИЕ СЛЕДА С "${modelName}"**\n\n`;
            report += `🎯 Вероятность совпадения: **${comparison.overallScore.toFixed(1)}%**\n\n`;
            report += `📊 Анализ следов:\n`;
            report += `• 🔷 Крупный узор: ${comparison.macroPattern.toFixed(1)}%\n`;
            report += `• 📐 Расположение: ${comparison.spatialLayout.toFixed(1)}%\n`;
            report += `• ⭐ Характерные формы: ${comparison.shapeCharacteristics.toFixed(1)}%\n`;
            report += `• 📏 Соотношение: ${comparison.sizeConsistency.toFixed(1)}%\n\n`;

            if (comparison.overallScore > 65) {
                report += `✅ **ВЫСОКАЯ ВЕРОЯТНОСТЬ** - след соответствует модели`;
            } else if (comparison.overallScore > 45) {
                report += `🟡 **СРЕДНЯЯ ВЕРОЯТНОСТЬ** - возможное соответствие`;
            } else if (comparison.overallScore > 25) {
                report += `🟠 **НИЗКАЯ ВЕРОЯТНОСТЬ** - слабое соответствие`;
            } else {
                report += `❌ **ВЕРОЯТНО НЕСООТВЕТСТВИЕ** - разные модели`;
            }

            report += `\n\n💡 *Учет деформации грунта и потери мелких деталей*`;

            await bot.sendMessage(chatId, report);

            const userData = {
                username: msg.from.username ? `@${msg.from.username}` :
                         `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
                dateTime: new Date(),
                coordinates: null,
                accuracy: null
            };

            const vizPath = await createPolygonVisualization(fileUrl, predictions, false, userData);
            if (vizPath) {
                await bot.sendPhoto(chatId, vizPath);
                fs.unlinkSync(vizPath);
            }

            session.waitingForComparison = null;
            return;
        }

        // 3. Обычный анализ
        if (session.active) {
            session.photos.push(fileUrl);
            const count = session.photos.length;
           
            if (count >= 5) {
                await finishSession(msg.chat.id, session);
            } else {
                await bot.sendMessage(chatId,
                    `📸 Фото ${count} добавлено!\n` +
                    `✅ Собрано: ${count}/5 фото\n` +
                    `💧 Обычный анализ`
                );
            }
        } else {
            await bot.sendMessage(chatId, '✅ Фото получено! Анализирую...');
           
            const classStats = {};
            predictions.forEach(pred => {
                classStats[pred.class] = (classStats[pred.class] || 0) + 1;
            });
           
            let statsText = '📊 **Семантический анализ:**\n';
            Object.entries(classStats).forEach(([className, count]) => {
                const name = {
                    'Outline-trail': '🔮 Контуры',
                    'shoe-protector': '🔵 Детали',
                    'Heel': '🔷 Каблуки',
                    'Toe': '🔹 Мыски'
                }[className] || className;
                statsText += `${name}: ${count}\n`;
            });
           
            await bot.sendMessage(chatId, statsText);
           
            const userData = {
                username: msg.from.username ? `@${msg.from.username}` :
                         `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
                dateTime: new Date(),
                coordinates: null,
                accuracy: null
            };

            const vizPath = await createPolygonVisualization(fileUrl, predictions, false, userData);
            if (vizPath) {
                await bot.sendPhoto(chatId, vizPath);
                fs.unlinkSync(vizPath);
            }
        }

    } catch (error) {
        await bot.sendMessage(chatId, '⚠️ Ошибка обработки фото');
        console.log('Photo error:', error.message);
    }
});

// 📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋
// 📋               КОМАНДЫ БОТА - BOT COMMANDS                        📋
// 📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋

bot.onText(/\/start/, (msg) => {
    const session = getSession(msg.chat.id);
    session.active = false;
   
    bot.sendMessage(msg.chat.id,
        '👟 **АНАЛИЗАТОР СЛЕДОВ ОБУВИ** 🚀\n\n' +
       
        '🔍 **СИСТЕМА СРАВНЕНИЯ:**\n' +
        '• /save_reference <модель> - сохранить эталон подошвы\n' +
        '• /compare <модель> - сравнить след с эталоном\n' +
        '• /list_references - список сохраненных эталонов\n\n' +
       
        '📸 **РЕЖИМЫ АНАЛИЗА:**\n' +
        '• Просто отправьте фото - быстрый анализ\n' +
        '• /start_session - серийная съемка (до 5 фото)\n' +
        '• /finish - завершить сессию и получить результат\n' +
        '• /cancel - отменить текущую сессию\n\n' +
       
        '🎯 **НОВЫЕ ВОЗМОЖНОСТИ:**\n' +
        '• 🧠 Умное сравнение для следов на грунте\n' +
        '• 🌙 Адаптивные пороги для дня/ночи\n' +
        '• 🔺 Сохранение острых углов и деталей\n' +
        '• 📍 Водяной знак с метаданными\n\n' +
       
        '💡 **СОВЕТЫ:**\n' +
        '• Для эталонов: фото чистой подошвы сверху\n' +
        '• Для следов: фото под прямым углом, без теней\n' +
        '• Ночные снимки: используйте вспышку\n' +
        '• Серийная съемка: 3-5 фото с разных ракурсов'
    );
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        '🆘 **ПОМОЩЬ ПО КОМАНДАМ**\n\n' +
       
        '📸 **ОСНОВНЫЕ КОМАНДЫ:**\n' +
        '`/start` - показать справку\n' +
        '`/help` - эта помощь\n' +
        '`/status` - статус текущей сессии\n\n' +
       
        '🔍 **СРАВНЕНИЕ ЭТАЛОНОВ:**\n' +
        '`/save_reference Nike_Air_Max` - сохранить эталон\n' +
        '`/compare Nike_Air_Max` - сравнить со следом\n' +
        '`/list_references` - показать эталоны\n\n' +
       
        '🎯 **СЕССИОННЫЙ РЕЖИМ:**\n' +
        '`/start_session` - начать серийную съемку\n' +
        '`/finish` - завершить и обработать\n' +
        '`/cancel` - отменить сессию\n\n' +
       
        '📊 **ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:**\n' +
        '1. Сохранить эталон:\n' +
        '   `/save_reference My_Sneakers` + фото подошвы\n\n' +
        '2. Сравнить след:\n' +
        '   `/compare My_Sneakers` + фото следа\n\n' +
        '3. Быстрый анализ:\n' +
        '   Просто отправьте фото\n\n' +
        '4. Детальный анализ:\n' +
        '   `/start_session` → 3-5 фото → `/finish`'
    );
});

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const session = getSession(chatId);
   
    let status = '📊 **СТАТУС СИСТЕМЫ:**\n\n';
   
    if (session.active) {
        status += `🎯 Режим: СЕССИОННАЯ СЪЕМКА\n`;
        status += `📸 Собрано фото: ${session.photos.length}/5\n`;
        status += `⏰ Используйте /finish для анализа\n`;
    } else if (session.waitingForReference) {
        status += `🎯 Ожидание: СОХРАНЕНИЕ ЭТАЛОНА\n`;
        status += `📝 Модель: "${session.waitingForReference}"\n`;
        status += `📸 Отправьте фото подошвы\n`;
    } else if (session.waitingForComparison) {
        status += `🎯 Ожидание: СРАВНЕНИЕ\n`;
        status += `🔍 Модель: "${session.waitingForComparison.modelName}"\n`;
        status += `📸 Отправьте фото следа\n`;
    } else {
        status += `🎯 Режим: ГОТОВ К РАБОТЕ\n`;
        status += `💡 Отправьте фото или используйте команды\n`;
    }
   
    status += `\n📈 Сохранено эталонов: ${referencePrints.size}`;
   
    bot.sendMessage(chatId, status);
});

bot.onText(/\/save_reference$/, async (msg) => {
    const chatId = msg.chat.id;
   
    await bot.sendMessage(chatId,
        '💾 **СОХРАНЕНИЕ ЭТАЛОННОГО ОТПЕЧАТКА**\n\n' +
        'Отправьте фото подошвы обуви для сохранения как эталон.\n\n' +
        '📝 **Укажите название модели через пробел:**\n' +
        'Пример: `/save_reference Nike_Air_Max_90`\n\n' +
        '💡 **Рекомендации:**\n' +
        '• Фото чистой подошвы сверху\n' +
        '• Хорошее освещение без теней\n' +
        '• Четкий фокус на протекторе\n' +
        '• Название без пробелов (используйте _)'
    );
});

bot.onText(/\/save_reference (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
   
    if (modelName.length < 2) {
        await bot.sendMessage(chatId, '❌ Название модели слишком короткое');
        return;
    }
   
    if (referencePrints.has(modelName)) {
        await bot.sendMessage(chatId,
            `⚠️ Эталон "${modelName}" уже существует\n\n` +
            'Хотите перезаписать? Отправьте:\n' +
            '`/confirm_override ${modelName}`\n' +
            'или используйте другое название'
        );
        return;
    }
   
    await bot.sendMessage(chatId,
        `💾 Сохраняю эталон для: "${modelName}"\n\n` +
        '📸 **Отправьте фото подошвы:**\n' +
        '• Чистая подошва, вид сверху\n' +
        '• Хорошее освещение\n' +
        '• Максимальная детализация протектора\n\n' +
        '❌ Для отмены: /cancel'
    );
   
    const session = getSession(chatId);
    session.waitingForReference = modelName;
});

bot.onText(/\/compare$/, async (msg) => {
    const chatId = msg.chat.id;
   
    if (referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 Список эталонов пуст\n\n' +
            'Сначала сохраните эталонные подошвы:\n' +
            '`/save_reference Название_Модели`\n\n' +
            'Или просто отправьте фото для быстрого анализа'
        );
        return;
    }
   
    await bot.sendMessage(chatId,
        '🔍 **СРАВНЕНИЕ С ЭТАЛОНОМ**\n\n' +
        'Отправьте фото следа для сравнения с сохраненными эталонами.\n\n' +
        '📝 **Укажите модель для сравнения:**\n' +
        'Пример: `/compare Nike_Air_Max_90`\n\n' +
        '📋 **Или посмотрите список эталонов:**\n' +
        '`/list_references`\n\n' +
        '💡 **Для лучших результатов:**\n' +
        '• След на ровной поверхности\n' +
        '• Фото под прямым углом\n' +
        '• Хорошее освещение\n' +
        '• Минимум теней и помех'
    );
});

bot.onText(/\/compare (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
   
    const reference = referencePrints.get(modelName);
    if (!reference) {
        let message = `❌ Эталон "${modelName}" не найден\n\n`;
        message += '📋 **Доступные эталоны:**\n';
       
        if (referencePrints.size > 0) {
            referencePrints.forEach((ref, name) => {
                message += `• ${name} (${ref.features.detailCount} дет.)\n`;
            });
        } else {
            message += 'Список пуст\n';
        }
       
        message += '\n💡 Используйте `/save_reference` для добавления';
       
        await bot.sendMessage(chatId, message);
        return;
    }
   
    await bot.sendMessage(chatId,
        `🔍 Сравниваю со следом: "${modelName}"\n\n` +
        '📸 **Отправьте фото следа:**\n' +
        '• След на грунте/песке/снегу\n' +
        '• Прямой угол съемки\n' +
        '• Максимальная четкость\n' +
        '• Без сильных теней\n\n' +
        '🎯 **Алгоритм учитывает:**\n' +
        '• Крупные элементы узора\n' +
        '• Расположение деталей\n' +
        '• Характерные формы\n' +
        '• Деформацию грунта\n\n' +
        '❌ Для отмены: /cancel'
    );
   
    const session = getSession(chatId);
    session.waitingForComparison = {
        modelName: modelName,
        isFootprint: true
    };
});

bot.onText(/\/list_references/, async (msg) => {
    const chatId = msg.chat.id;
   
    if (referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Для добавления эталонов используйте:\n' +
            '`/save_reference Название_Модели`\n\n' +
            'Пример:\n' +
            '`/save_reference Nike_Air_Force`\n' +
            '`/save_reference Adidas_Ultraboost`\n' +
            '`/save_reference Timberland_Boots`'
        );
        return;
    }
   
    let list = '📝 **СОХРАНЕННЫЕ ЭТАЛОНЫ:**\n\n';
    let counter = 1;
   
    referencePrints.forEach((ref, modelName) => {
        const date = ref.timestamp.toLocaleDateString('ru-RU');
        const details = ref.features.detailCount;
        list += `${counter}. **${modelName}**\n`;
        list += `   📅 ${date} | 🔵 ${details} дет.\n\n`;
        counter++;
    });
   
    list += '🔍 **Для сравнения:**\n';
    list += '`/compare Название_Модели`\n\n';
    list += '🗑️ **Для удаления:**\n';
    list += '`/delete_reference Название_Модели`';
   
    await bot.sendMessage(chatId, list);
});

bot.onText(/\/start_session/, (msg) => {
    const session = getSession(msg.chat.id);
    session.active = true;
    session.photos = [];
    session.startTime = new Date();
   
    bot.sendMessage(msg.chat.id,
        '📸 **СЕССИОННАЯ СЪЕМКА АКТИВИРОВАНА**\n\n' +
        '🎯 **Цель:** Собрать 3-5 фото для детального анализа\n\n' +
        '📋 **ИНСТРУКЦИЯ:**\n' +
        '1. Отправляйте фото одного и того же следа\n' +
        '2. Снимайте с немного разных ракурсов\n' +
        '3. Используйте разное освещение\n' +
        '4. Старайтесь избегать теней\n\n' +
        '✅ **Собрано:** 0/5 фото\n\n' +
        '⏰ **Команды управления:**\n' +
        '`/finish` - завершить и проанализировать\n' +
        '`/cancel` - отменить сессию\n' +
        '`/status` - текущий статус'
    );
});

bot.onText(/\/finish/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getSession(chatId);
   
    if (!session.active || session.photos.length === 0) {
        await bot.sendMessage(chatId,
            '❌ Нет активной сессии или фото\n\n' +
            'Начните сессию:\n' +
            '`/start_session`\n\n' +
            'Или отправьте одно фото для быстрого анализа'
        );
        return;
    }
   
    await bot.sendMessage(chatId,
        `🔄 Обрабатываю ${session.photos.length} фото...\n\n` +
        '⏳ Это займет несколько секунд\n' +
        '📊 Создаю объединенную визуализацию\n' +
        '🎯 Применяю улучшенный алгоритм'
    );
   
    await finishSession(chatId, session);
});

bot.onText(/\/cancel/, (msg) => {
    const chatId = msg.chat.id;
    const session = getSession(chatId);
    const count = session.photos.length;
   
    session.active = false;
    session.photos = [];
    session.pendingLocation = null;
    session.waitingForReference = null;
    session.waitingForComparison = null;
   
    let message = '❌ **СЕССИЯ ОТМЕНЕНА**\n\n';
   
    if (count > 0) {
        message += `📸 Удалено фото: ${count}\n`;
    }
   
    if (session.waitingForReference) {
        message += `🗑️ Отменено сохранение: "${session.waitingForReference}"\n`;
    }
   
    if (session.waitingForComparison) {
        message += `🔍 Отменено сравнение: "${session.waitingForComparison.modelName}"\n`;
    }
   
    message += '\n💡 Система готова к новым задачам';
   
    bot.sendMessage(chatId, message);
});

// Команда для удаления эталонов
bot.onText(/\/delete_reference (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
   
    if (referencePrints.has(modelName)) {
        referencePrints.delete(modelName);
        await bot.sendMessage(chatId, `✅ Эталон "${modelName}" удален`);
    } else {
        await bot.sendMessage(chatId, `❌ Эталон "${modelName}" не найден`);
    }
});

// 📊 КОМАНДА ДЛЯ ПРОВЕРКИ СБОРА ДАННЫХ
bot.onText(/\/data_status/, async (msg) => {
    const stats = `📊 Статус сбора данных:
• Google Drive: ${fs.existsSync('credentials.json') ? '✅ подключен' : '❌ отключен'}
• Режим: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}
• Сбор данных: ${typeof TRAINING_CONFIG !== 'undefined' ? '✅ включен' : '❌ выключен'}`;
    
    await bot.sendMessage(msg.chat.id, stats);
});

console.log('🚀 Бот полностью готов к работе!');
console.log('⭐ Улучшенное сравнение для следов');
console.log('🎯 Адаптивные пороги доверия');
console.log('🔺 Сохранение острых углов');
console.log('📋 Полная система команд');

// 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
// 🟢               HTTP СЕРВЕР ДЛЯ RENDER                             🟢
// 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Shoe Analyzer Bot is running!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    bot: 'running',
    timestamp: new Date().toISOString(),
    mode: IS_PRODUCTION ? 'production' : 'development'
  });
});

app.listen(PORT, () => {
  console.log(`🟢 HTTP server running on port ${PORT}`);
});

console.log('🚀 Бот полностью готов к работе!');
console.log('⭐ Улучшенное сравнение для следов');
console.log('🎯 Адаптивные пороги доверия');
console.log('🔺 Сохранение острых углов');
console.log('📋 Полная система команд');
console.log('🌐 HTTP сервер активирован для Render');

// 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
// 🟢               АНТИ-СОН СИСТЕМА ДЛЯ RENDER                        🟢
// 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢

function startKeepAlive() {
    // Используем уже существующий HTTP сервер из express
    // Не создаем новый сервер!
   
    // Просто пингуем каждые 5 минут
    setInterval(() => {
        console.log('🔄 Keep-alive ping:', new Date().toISOString());
    }, 5 * 60 * 1000);
   
    console.log('🔔 Анти-сен система активирована');
}

// Запускаем после основного сервера
setTimeout(startKeepAlive, 3000);

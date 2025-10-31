// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                       АНАЛИЗАТОР СЛЕДОВ ОБУВИ (WEBHOOK ВЕРСИЯ)               🔵
// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// =============================================================================
// 📤 YANDEX DISK SERVICE - ЗАГРУЗКА ФОТО НА ЯНДЕКС.ДИСК
// =============================================================================
let YandexDiskService;
let yandexDisk;

try {
    YandexDiskService = require('./yandex-disk-service');
    yandexDisk = new YandexDiskService(process.env.YANDEX_DISK_TOKEN);
    console.log('✅ Яндекс.Диск service инициализирован');
} catch (error) {
    console.log('❌ Яндекс.Диск service не доступен:', error.message);
    yandexDisk = null;
}

// =============================================================================
// 📊 КОНФИГ МОДЕЛИ ДЛЯ ОТЧЕТОВ - ПРОЗРАЧНОСТЬ СИСТЕМЫ
// =============================================================================
const MODEL_METADATA = {
    name: "Shoe Print Detective",
    version: "dynamic",
    status: "ACTIVE_DEVELOPMENT",
    accuracy: "Обновляется при переобучении",
    dataset: "База расширяется",
    trained: "Периодически обновляется",
    confidence: "ЗАВИСИТ ОТ КАЧЕСТВА СЛЕДА",
    limitations: [
        "Модель в активной разработке",
        "Точность варьируется от 30% до 50%",
        "Требует очень четкие следы для надежности",
        "Регулярно улучшается на новых данных",
        "Может пропускать мелкие детали"
    ],
    recommendations: [
        "Фотографируйте под прямым углом",
        "Идеальное освещение без теней",
        "Максимальная четкость снимка",
        "Крупный план следа",
        "Контрастный фон"
    ]
};

// 🔧 Функция для добавления информации о модели
function addModelTransparency(caption, predictionsCount = 0) {
    const confidenceLevel = predictionsCount > 15 ? "СРЕДНЯЯ" : "НИЗКАЯ";
   
    return `${caption}\n\n` +
           `🔍 **ИНФОРМАЦИЯ О СИСТЕМЕ:**\n` +
           `• Модель: ${MODEL_METADATA.name} (${MODEL_METADATA.status})\n` +
           `• Версия: ${MODEL_METADATA.version}\n` +
           `• Уверенность анализа: ${confidenceLevel}\n` +
           `• Состояние: Активная разработка\n\n` +
           `💡 **Рекомендации по съемке:**\n` +
           `- ${MODEL_METADATA.recommendations.join('\n- ')}\n\n` +
           `⚠️ **Важные ограничения:**\n` +
           `- ${MODEL_METADATA.limitations.join('\n- ')}`;
}

// =============================================================================
// 🎯 НАСТРОЙКИ И ИНИЦИАЛИЗАЦИЯ
// =============================================================================

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = `https://shoe-print-bot.onrender.com/bot${TELEGRAM_TOKEN}`;

console.log('🚀 Запуск бота с Webhook...');
console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);

// =============================================================================
// 📊 СИСТЕМА СТАТИСТИКИ И ДАННЫХ
// =============================================================================

const userStats = new Map();
const globalStats = {
    totalUsers: 0,
    totalPhotos: 0,
    totalAnalyses: 0,
    comparisonsMade: 0
};

const referencePrints = new Map();
const photoSessions = new Map();

// =============================================================================
// 🕵️‍♂️ СИСТЕМА СЕССИЙ ЭКСПЕРТА-КРИМИНАЛИСТА
// =============================================================================

const expertSessions = new Map();

/**
* Сессия экспертизы для отслеживания последовательных отпечатков
*/
class ExpertSession {
    constructor(chatId, username) {
        this.chatId = chatId;
        this.expert = username;
        this.sessionId = `session_${chatId}_${Date.now()}`;
        this.startTime = new Date();
        this.footprints = []; // Все отпечатки в сессии
        this.comparisons = []; // Результаты сравнений
        this.status = 'active';
        this.notes = '';
    }

    addFootprint(analysisData) {
        const footprintRecord = {
            id: `footprint_${this.footprints.length + 1}`,
            timestamp: new Date(),
            imageUrl: analysisData.imageUrl,
            predictions: analysisData.predictions,
            features: analysisData.features,
            perspectiveAnalysis: analysisData.perspectiveAnalysis,
            orientation: analysisData.orientation
        };
       
        this.footprints.push(footprintRecord);
        console.log(`🕵️‍♂️ Добавлен отпечаток в сессию ${this.sessionId}: ${footprintRecord.id}`);
       
        // Автоматическое сравнение с предыдущими отпечатками
        if (this.footprints.length > 1) {
            this.autoCompareWithPrevious(footprintRecord);
        }
       
        return footprintRecord;
    }

    autoCompareWithPrevious(newFootprint) {
        console.log(`🕵️‍♂️ Автосравнение нового отпечатка с предыдущими...`);
       
        const previousFootprints = this.footprints.slice(0, -1); // Все кроме последнего
       
        previousFootprints.forEach((previous, index) => {
            const comparison = compareFootprints(
                previous.features,
                newFootprint.features
            );
           
            const comparisonRecord = {
                id: `comparison_${this.comparisons.length + 1}`,
                timestamp: new Date(),
                footprintA: previous.id,
                footprintB: newFootprint.id,
                result: comparison,
                similarity: comparison.overallScore,
                notes: this.generateComparisonNotes(comparison, previous, newFootprint)
            };
           
            this.comparisons.push(comparisonRecord);
            console.log(`🔍 Сравнение ${previous.id} vs ${newFootprint.id}: ${comparison.overallScore}%`);
        });
    }

    generateComparisonNotes(comparison, footprintA, footprintB) {
        const notes = [];
       
        if (comparison.overallScore > 70) {
            notes.push('ВЫСОКАЯ СХОДИМОСТЬ - вероятно один источник');
        } else if (comparison.overallScore > 50) {
            notes.push('СРЕДНЯЯ СХОДИМОСТЬ - требуется дополнительный анализ');
        } else {
            notes.push('НИЗКАЯ СХОДИМОСТЬ - разные источники');
        }

        if (comparison.mirrorUsed) {
            notes.push('Учтена зеркальная симметрия (левый/правый)');
        }

        return notes.join('; ');
    }

    getSessionSummary() {
        return {
            sessionId: this.sessionId,
            expert: this.expert,
            duration: new Date() - this.startTime,
            footprintsCount: this.footprints.length,
            comparisonsCount: this.comparisons.length,
            averageSimilarity: this.comparisons.length > 0 ?
                this.comparisons.reduce((sum, comp) => sum + comp.similarity, 0) / this.comparisons.length : 0,
            status: this.status
        };
    }

    generateExpertReport() {
        const summary = this.getSessionSummary();
       
        let report = `🕵️‍♂️ **ЭКСПЕРТНОЕ ЗАКЛЮЧЕНИЕ**\n\n`;
        report += `**Сессия:** ${summary.sessionId}\n`;
        report += `**Эксперт:** ${summary.expert}\n`;
        report += `**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n`;
        report += `**Проанализировано отпечатков:** ${summary.footprintsCount}\n`;
        report += `**Выполнено сравнений:** ${summary.comparisonsCount}\n`;
        report += `**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n\n`;

        if (this.comparisons.length > 0) {
            report += `**КЛЮЧЕВЫЕ ВЫВОДЫ:**\n`;
           
            const highSimilarity = this.comparisons.filter(c => c.similarity > 70);
            if (highSimilarity.length > 0) {
                report += `• Обнаружено ${highSimilarity.length} пар с высокой сходимостью\n`;
            }

            const uniqueGroups = this.identifyUniqueGroups();
            report += `• Выявлено ${uniqueGroups.length} уникальных морфологических групп\n`;
        }

        report += `\n**СТАТУС:** ${this.status === 'active' ? 'АКТИВНА' : 'ЗАВЕРШЕНА'}`;
       
        return report;
    }

    identifyUniqueGroups() {
        // Простой алгоритм группировки по сходимости
        const groups = [];
       
        this.footprints.forEach(footprint => {
            let assigned = false;
           
            for (let group of groups) {
                const avgSimilarity = group.members.reduce((sum, member) => {
                    const comparison = this.comparisons.find(c =>
                        (c.footprintA === footprint.id && c.footprintB === member) ||
                        (c.footprintB === footprint.id && c.footprintA === member)
                    );
                    return sum + (comparison ? comparison.similarity : 0);
                }, 0) / group.members.length;
               
                if (avgSimilarity > 60) {
                    group.members.push(footprint.id);
                    assigned = true;
                    break;
                }
            }
           
            if (!assigned) {
                groups.push({ id: `group_${groups.length + 1}`, members: [footprint.id] });
            }
        });
       
        return groups;
    }
}

/**
* Получает или создает сессию экспертизы
*/
function getExpertSession(chatId, username) {
    if (!expertSessions.has(chatId)) {
        expertSessions.set(chatId, new ExpertSession(chatId, username));
        console.log(`🕵️‍♂️ Создана новая сессия экспертизы для ${username}`);
    }
    return expertSessions.get(chatId);
}

// 📍 ОБНОВЛЯЕМ ФУНКЦИЮ updateUserStats - находим ее и изменяем:

function updateUserStats(userId, username, action = 'photo') {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            username: username || `user_${userId}`,
            photosCount: 0,
            analysesCount: 0,
            // ❌ УДАЛЯЕМ: sessionsCount: 0,  // Больше не отслеживаем сессии
            comparisonsCount: 0,
            firstSeen: new Date(),
            lastSeen: new Date(),
            lastAnalysis: null
        });
        globalStats.totalUsers++;
    }
   
    const user = userStats.get(userId);
    user.lastSeen = new Date();
   
    switch(action) {
        case 'photo':
            user.photosCount++;
            globalStats.totalPhotos++;
            break;
        case 'analysis':
            user.analysesCount++;
            globalStats.totalAnalyses++;
            user.lastAnalysis = new Date();
            globalStats.lastAnalysis = new Date();
            break;
        case 'comparison':
            user.comparisonsCount++;
            globalStats.comparisonsMade++;
            break;
        // ❌ УДАЛЯЕМ case 'session': - больше не используем
    }
   
    if (globalStats.totalPhotos % 10 === 0) {
        saveStats();
    }
}

// const referencePrints = new Map();
// const photoSessions = new Map();

// =============================================================================
// 🤖 ИНИЦИАЛИЗАЦИЯ БОТА И WEBHOOK
// =============================================================================

const bot = new TelegramBot(TELEGRAM_TOKEN);

app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Анализатор следов обуви</title></head>
            <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                    <h1 style="text-align: center; margin-bottom: 30px;">🤖 Анализатор следов обуви</h1>
                    <div style="text-align: center; margin-bottom: 30px;">
                        <p style="font-size: 18px; margin-bottom: 20px;">Бот работает! Используйте Telegram:</p>
                        <a href="https://t.me/Sled_la_bot" style="display: inline-block; background: #0088cc; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            📲 @Sled_la_bot
                        </a>
                    </div>
                    <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin-top: 20px;">
                        <h3 style="text-align: center; margin-bottom: 15px;">📊 Статистика системы</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
                            <div>
                                <div style="font-size: 24px; font-weight: bold;">${globalStats.totalUsers}</div>
                                <div>👥 Пользователей</div>
                            </div>
                            <div>
                                <div style="font-size: 24px; font-weight: bold;">${globalStats.totalPhotos}</div>
                                <div>📸 Фото обработано</div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        statistics: {
            users: globalStats.totalUsers,
            photos: globalStats.totalPhotos,
            analyses: globalStats.totalAnalyses
        }
    });
});

// =============================================================================
// 🧠 УМНАЯ ПОСТОБРАБОТКА + НОРМАЛИЗАЦИЯ
// =============================================================================

function smartPostProcessing(predictions) {
    if (!predictions || predictions.length === 0) return [];
    console.log(`🔧 Умная постобработка: ${predictions.length} объектов`);
   
    // ❌ УБИРАЕМ нормализацию ориентации из постобработки
    // const normalizedPredictions = normalizeOrientation(predictions); // УДАЛИТЬ ЭТУ СТРОКУ
   
    const filtered = predictions.filter(pred => {  // ← МЕНЯЕМ normalizedPredictions на predictions
        if (!pred.points || pred.points.length < 3) return false;
        const bbox = calculateBoundingBox(pred.points);
        const area = bbox.width * bbox.height;
        return area > 100;
    });

    const optimized = filtered.map(pred => {
        if (pred.points.length <= 6) return pred;
        const optimizedPoints = simplifyPolygon(pred.points, getEpsilonForClass(pred.class));
        return {
            ...pred,
            points: optimizedPoints
        };
    });

    // 📊 АНАЛИЗИРУЕМ ОРИЕНТАЦИЮ ДЛЯ ОТЧЕТА (но не меняем координаты)
    const orientationType = analyzeOrientationType(optimized);
    console.log(`🧭 Тип ориентации: ${orientationType}`);
   
    console.log(`✅ После постобработки: ${optimized.length} объектов`);
    return optimized;
}

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

// =============================================================================
// 🧭 НОРМАЛИЗАЦИЯ ОРИЕНТАЦИИ СЛЕДОВ
// =============================================================================

/**
* Вычисляет угол поворота следа относительно горизонта
*/
function calculateOrientationAngle(points) {
    console.log('🧭 Вычисляю угол ориентации следа...');
   
    if (!points || points.length < 3) {
        console.log('⚠️ Недостаточно точек для вычисления ориентации');
        return 0;
    }

    try {
        // 1. ВЫЧИСЛЯЕМ ЦЕНТР МАСС
        const center = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
       
        center.x /= points.length;
        center.y /= points.length;

        // 2. ВЫЧИСЛЯЕМ УГОЛ ЧЕРЕЗ МЕТОД ГЛАВНЫХ КОМПОНЕНТ
        let xx = 0, yy = 0, xy = 0;
       
        points.forEach(point => {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            xx += dx * dx;
            yy += dy * dy;
            xy += dx * dy;
        });

        // 3. ВЫЧИСЛЯЕМ УГОЛ НАКЛОНА
        const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
        const degrees = angle * (180 / Math.PI);
       
        console.log(`📐 Вычисленный угол поворота: ${degrees.toFixed(2)}°`);
        return degrees;

    } catch (error) {
        console.log('❌ Ошибка вычисления ориентации:', error.message);
        return 0;
    }
}

/**
* Нормализует ориентацию предсказаний (поворачивает к горизонтали)
*/
function normalizeOrientation(predictions) {
    console.log('🔄 Нормализую ориентацию следов...');
   
    if (!predictions || predictions.length === 0) {
        return predictions;
    }

    try {
        // ИЩЕМ КОНТУР СЛЕДА ДЛЯ ОПРЕДЕЛЕНИЯ ОРИЕНТАЦИИ
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline || !outline.points) {
            console.log('⚠️ Контур не найден, ориентация не изменена');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ УГОЛ ПОВОРОТА
        const angle = calculateOrientationAngle(outline.points);
       
        // ЕСЛИ УГОЛ МАЛЕНЬКИЙ - НЕ ПОВОРАЧИВАЕМ
        if (Math.abs(angle) < 5) {
            console.log('✅ След уже ориентирован нормально (<5°)');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ ЦЕНТР КОНТУРА
        const bbox = calculateBoundingBox(outline.points);
        const center = {
            x: bbox.minX + bbox.width / 2,
            y: bbox.minY + bbox.height / 2
        };

        // ПОВОРАЧИВАЕМ ВСЕ ТОЧКИ ВСЕХ ПРЕДСКАЗАНИЙ
        const rad = -angle * (Math.PI / 180); // минус для компенсации
       
        const normalizedPredictions = predictions.map(pred => {
            if (!pred.points) return pred;
           
            return {
                ...pred,
                points: pred.points.map(point => {
                    // ПЕРЕНОСИМ В ЦЕНТР КООРДИНАТ
                    const dx = point.x - center.x;
                    const dy = point.y - center.y;
                   
                    // ПОВОРАЧИВАЕМ
                    const newX = dx * Math.cos(rad) - dy * Math.sin(rad);
                    const newY = dx * Math.sin(rad) + dy * Math.cos(rad);
                   
                    // ВОЗВРАЩАЕМ НА МЕСТО
                    return {
                        x: newX + center.x,
                        y: newY + center.y
                    };
                })
            };
        });

        console.log(`✅ Ориентация нормализована: поворот на ${angle.toFixed(1)}°`);
        return normalizedPredictions;

    } catch (error) {
        console.log('❌ Ошибка нормализации ориентации:', error.message);
        return predictions;
    }
}

/**
* Определяет тип ориентации (левый/правый/прямой) с порогами
*/
function analyzeOrientationType(predictions) {
    if (!predictions || predictions.length === 0) {
        return 'unknown';
    }

    try {
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline) return 'unknown';

        const angle = calculateOrientationAngle(outline.points);
       
        // 🔧 НАСТРАИВАЕМ ПОРОГИ ДЛЯ БОЛЕЕ ТОЧНОЙ КЛАССИФИКАЦИИ
        if (Math.abs(angle) < 8) return 'aligned';          // ±8° - нормально
        if (angle > 8 && angle <= 45) return 'rotated_clockwise';
        if (angle < -8 && angle >= -45) return 'rotated_counterclockwise';
        if (Math.abs(angle) > 45) return 'strongly_rotated'; // Сильный поворот
       
        return 'aligned';
       
    } catch (error) {
        return 'unknown';
    }
}

function getEpsilonForClass(className) {
    switch(className) {
        case 'shoe-protector': return 1.5;
        case 'Outline-trail': return 0.8;
        case 'Heel': return 1.0;
        case 'Toe': return 1.0;
        default: return 1.2;
    }
}

// =============================================================================
// 🎯 ИСПРАВЛЕННЫЙ АЛГОРИТМ СРАВНЕНИЯ СЛЕДОВ
// =============================================================================

// =============================================================================
// 🎯 ИСПРАВЛЕННЫЙ АЛГОРИТМ СРАВНЕНИЯ (БЕЗ NaN)
// =============================================================================

function compareFootprints(referenceFeatures, footprintFeatures) {
    console.log('🔍 УЛУЧШЕННОЕ СРАВНЕНИЕ: эталон vs след');
   
    // ЗАЩИТА ОТ NaN - гарантируем числовые значения
    const refDetails = Math.max(referenceFeatures.detailCount || 0, 1);
    const footprintDetails = Math.max(footprintFeatures.detailCount || 0, 1);

    const scores = {
        patternSimilarity: 0,    // Схожесть узора (40%)
        spatialDistribution: 0,  // Пространственное распределение (30%)
        detailMatching: 0,       // Совпадение деталей (20%)
        shapeConsistency: 0,     // Соответствие форм (10%)
        overallScore: 0
    };

    // 1. Схожесть узора (40%) - сравниваем распределение деталей
    const countRatio = Math.min(refDetails, footprintDetails) / Math.max(refDetails, footprintDetails);
    scores.patternSimilarity = Math.round(countRatio * 25);
   
    // Бонус за достаточное количество деталей
    if (refDetails > 10 && footprintDetails > 10) {
        scores.patternSimilarity += 15;
    }
    scores.patternSimilarity = Math.min(scores.patternSimilarity, 40);

    // 2. Пространственное распределение (30%)
    const refDensity = referenceFeatures.density || 1;
    const footprintDensity = footprintFeatures.density || 1;
    const densitySimilarity = 1 - Math.abs(refDensity - footprintDensity) / Math.max(refDensity, footprintDensity);
    scores.spatialDistribution = Math.round(densitySimilarity * 30);

    // 3. Совпадение деталей (20%)
    const commonDetails = Math.min(refDetails, footprintDetails);
    const maxDetails = Math.max(refDetails, footprintDetails);
    scores.detailMatching = Math.round((commonDetails / maxDetails) * 20);

    // 4. Соответствие форм (10%) - базовый score
    scores.shapeConsistency = 8;
    if (referenceFeatures.hasOutline && footprintFeatures.hasOutline) {
        scores.shapeConsistency += 2;
    }

    // ОБЩИЙ СЧЕТ (гарантируем число)
    scores.overallScore = Math.min(
        scores.patternSimilarity + scores.spatialDistribution + scores.detailMatching + scores.shapeConsistency,
        100
    );

    console.log('📊 Улучшенные результаты:', scores);
    return scores;
}

// =============================================================================
// 🔄 ЗЕРКАЛЬНОЕ СРАВНЕНИЕ (ЛЕВЫЙ/ПРАВЫЙ БОТИНОК)
// =============================================================================

function mirrorFootprint(footprintFeatures) {
    // Простое зеркалирование - инвертируем spatial характеристики
    return {
        ...footprintFeatures,
        density: footprintFeatures.density,
        spatialSpread: -footprintFeatures.spatialSpread // упрощенное зеркалирование
    };
}

function compareWithMirror(referenceFeatures, footprintFeatures, footprintPredictions = []) {
    // Обычное сравнение
    const normalScore = compareFootprints(referenceFeatures, footprintFeatures);
   
    // Зеркальное сравнение (для левый/правый)
    const mirroredScore = compareFootprints(referenceFeatures, mirrorFootprint(footprintFeatures));
   
    // 🔥 ДОБАВЛЯЕМ УЧЕТ ОРИЕНТАЦИИ ПРИ СРАВНЕНИИ
    let orientationAdjustedScore = normalScore.overallScore;
   
    try {
        const orientationType = analyzeOrientationType(footprintPredictions);
        const orientationAngle = calculateOrientationAngle(
            footprintPredictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            )?.points || []
        );
       
        // 🔧 КОРРЕКТИРУЕМ SCORE В ЗАВИСИМОСТИ ОТ УГЛА ПОВОРОТА
        if (Math.abs(orientationAngle) > 15) {
            // Сильный поворот - снижаем точность
            const rotationPenalty = Math.min(Math.abs(orientationAngle) * 0.5, 25);
            orientationAdjustedScore = Math.max(0, normalScore.overallScore - rotationPenalty);
            console.log(`📐 Учет ориентации: угол ${orientationAngle.toFixed(1)}°, штраф ${rotationPenalty.toFixed(1)}%`);
        }
    } catch (error) {
        console.log('⚠️ Не удалось учесть ориентацию при сравнении:', error.message);
    }
   
    // Возвращаем лучший результат с учетом ориентации
    const bestScore = Math.max(orientationAdjustedScore, mirroredScore.overallScore);
   
    console.log(`🔄 Сравнение: обычный=${normalScore.overallScore}%, ориентация=${orientationAdjustedScore}%, зеркальный=${mirroredScore.overallScore}%`);
   
    return {
        ...normalScore,
        overallScore: bestScore,
        mirrorUsed: bestScore !== orientationAdjustedScore,
        orientationAdjusted: orientationAdjustedScore !== normalScore.overallScore,
        orientationAngle: calculateOrientationAngle(
            footprintPredictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            )?.points || []
        )
    };
}


// 🎯 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ:

function calculatePatternMatch(ref, footprint) {
    // Сравнение количества и типа деталей
    const baseScore = Math.min(
        (footprint.detailCount / Math.max(ref.detailCount, 1)) * 80,
        80
    );
    // Бонус за наличие контура
    const outlineBonus = (footprint.hasOutline && ref.hasOutline) ? 20 : 0;
    return Math.min(baseScore + outlineBonus, 100);
}

function calculateSpatialMatch(ref, footprint) {
    // Для пространственного анализа нужно минимум 3 детали
    if (ref.detailCount < 3 || footprint.detailCount < 3) return 40;
   
    // Сравнение плотности деталей
    const densitySimilarity = Math.min(
        footprint.detailCount / Math.max(ref.detailCount, 1),
        1
    ) * 60;
   
    return 40 + densitySimilarity; // Базовый 40% + плотность
}

function calculateDetailMatch(ref, footprint) {
    // Сравнение крупных деталей
    const largeDetailsScore = footprint.largeDetails > 0 ?
        Math.min((footprint.largeDetails / Math.max(ref.largeDetails, 1)) * 70, 70) : 0;
   
    // Бонус за сложность узора (много мелких деталей)
    const complexityBonus = (footprint.detailCount > 8) ? 30 : 0;
   
    return Math.min(largeDetailsScore + complexityBonus, 100);
}

function calculateShapeMatch(ref, footprint) {
    let score = 50; // Базовый счет
   
    // Бонусы за характерные особенности
    if (footprint.hasOutline) score += 30;
    if (footprint.largeDetails > 2) score += 20;
   
    return Math.min(score, 100);
}

// =============================================================================
// 📊 УЛУЧШЕННОЕ ИЗВЛЕЧЕНИЕ FEATURES (С ПЛОТНОСТЬЮ)
// =============================================================================

function extractFeatures(predictions) {
    console.log(`📊 Извлекаем улучшенные features из ${predictions.length} предсказаний`);
   
    const features = {
        detailCount: predictions.length,
        hasOutline: false,
        largeDetails: 0,
        density: 1,  // гарантируем значение по умолчанию
        spatialSpread: 0
    };

    // ЗАЩИТА ОТ ПУСТЫХ ДАННЫХ
    if (!predictions || predictions.length === 0) {
        return features;
    }

    let totalArea = 0;
    const centers = [];

    predictions.forEach(pred => {
        if (pred.class && pred.class.includes('Outline')) {
            features.hasOutline = true;
        }

        // Считаем площадь и центры для анализа распределения
        if (pred.points && pred.points.length > 3) {
            const bbox = calculateBoundingBox(pred.points);
            const area = bbox.width * bbox.height;
            totalArea += area;
           
            if (area > 1000) {
                features.largeDetails++;
            }

            // Сохраняем центры для анализа распределения
            centers.push({
                x: bbox.x + bbox.width / 2,
                y: bbox.y + bbox.height / 2
            });
        }
    });

    // Рассчитываем плотность деталей (защита от деления на ноль)
    if (centers.length > 0 && totalArea > 0) {
        features.density = centers.length / (totalArea / 1000); // деталей на 1000px²
    }

    console.log('📊 Улучшенные features:', features);
    return features;
}


// =============================================================================
// 🎨 ВИЗУАЛИЗАЦИЯ (БЕЗ ПОДПИСЕЙ)
// =============================================================================

async function createAnalysisVisualization(imageUrl, predictions, userData = {}) {
    if (!imageUrl || !predictions) {
        console.log('❌ Ошибка: нет imageUrl или predictions');
        return null;
    }

    if (predictions.length > 50) {
        console.log(`⚠️ Слишком много объектов (${predictions.length}), ограничиваем визуализацию`);
        predictions = predictions.slice(0, 50);
    }

    try {
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Рисуем оригинальное фото
        ctx.drawImage(image, 0, 0);

        // Цвета для разных классов
        const colors = {
            'Outline-trail': 'rgba(148, 0, 211, 0.8)',
            'shoe-protector': 'rgba(64, 224, 208, 0.7)',
            'Heel': 'rgba(0, 0, 255, 0.6)',
            'Toe': 'rgba(30, 144, 255, 0.6)'
        };

        // Рисуем полигоны БЕЗ ПОДПИСЕЙ
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 2) {
                const color = colors[pred.class] || 'rgba(255, 255, 255, 0.7)';
               
                ctx.strokeStyle = color;
                ctx.lineWidth = pred.class === 'Outline-trail' ? 4 : 2;
                ctx.beginPath();
               
                ctx.moveTo(pred.points[0].x, pred.points[0].y);
                for (let i = 1; i < pred.points.length; i++) {
                    ctx.lineTo(pred.points[i].x, pred.points[i].y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        });

        // Водяной знак
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, image.height - 80, 300, 70);
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`👤 ${userData.username || 'Пользователь'}`, 20, image.height - 55);
        ctx.fillText(`📅 ${new Date().toLocaleString('ru-RU')}`, 20, image.height - 35);
        ctx.fillText(`🔍 Анализатор следов обуви`, 20, image.height - 15);

        const vizPath = `viz_${Date.now()}.jpg`;
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
        fs.writeFileSync(vizPath, buffer);

        return vizPath;

    } catch (error) {
        console.log('❌ Ошибка визуализации:', error.message);
        return null;
    }
}

// =============================================================================
// 🦴 ВИЗУАЛИЗАЦИЯ "СКЕЛЕТ СЛЕДА" - ЦЕНТРЫ ДЕТАЛЕЙ ПРОТЕКТОРА
// =============================================================================

async function createSkeletonVisualization(imageUrl, predictions, userData) {
    try {
        console.log('🦴 Создаю скелетную визуализацию...');
       
        // Загружаем изображение
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // ВРЕМЕННО: уберем полупрозрачность для теста
        ctx.drawImage(image, 0, 0);

        // ФИЛЬТРУЕМ: ТОЛЬКО ДЕТАЛИ ПРОТЕКТОРА
        const details = predictions.filter(pred =>
            pred.class === 'shoe-protector'
        );

        console.log(`🦴 Найдено ${details.length} деталей протектора`);

        // ВРЕМЕННО: простая функция для bounding box если нет calculateBoundingBox
        function getBoundingBox(points) {
            let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
            points.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }

        // Вычисляем центры
        const centers = details.map(pred => {
            const bbox = getBoundingBox(pred.points);
            return {
                x: bbox.x + bbox.width / 2,
                y: bbox.y + bbox.height / 2,
                class: pred.class
            };
        });

        console.log(`🦴 Вычислено ${centers.length} центров`);

        // 1. РИСУЕМ СВЯЗИ МЕЖДУ ЦЕНТРАМИ
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)'; // Более яркий цвет
        ctx.lineWidth = 2; // Толще линии
       
        const MAX_DISTANCE = Math.min(image.width, image.height) * 0.15;
       
        for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
                const dist = Math.sqrt(
                    Math.pow(centers[i].x - centers[j].x, 2) +
                    Math.pow(centers[i].y - centers[j].y, 2)
                );
               
                if (dist < MAX_DISTANCE) {
                    ctx.beginPath();
                    ctx.moveTo(centers[i].x, centers[i].y);
                    ctx.lineTo(centers[j].x, centers[j].y);
                    ctx.stroke();
                }
            }
        }

        // 2. РИСУЕМ ТОЧКИ ЦЕНТРОВ (крупные и яркие)
        centers.forEach(center => {
            // Большие красные точки
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 8, 0, Math.PI * 2); // Увеличил радиус
            ctx.fill();

            // Белая обводка
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
        });

        // 3. КОНТУР СЛЕДА (если есть)
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );
       
        if (outline && outline.points) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]); // Более заметный пунктир
           
            ctx.beginPath();
            ctx.moveTo(outline.points[0].x, outline.points[0].y);
           
            for (let i = 1; i < outline.points.length; i++) {
                ctx.lineTo(outline.points[i].x, outline.points[i].y);
            }
           
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 4. ТЕКСТ
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 30px Arial';
        ctx.strokeText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
        ctx.fillText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
       
        ctx.font = '20px Arial';
        ctx.strokeText(`Признаки: ${details.length}`, 20, 70);
        ctx.fillText(`Признаки: ${details.length}`, 20, 70);       
        ctx.strokeText(`Точки анализа: ${centers.length}`, 20, 95);
        ctx.fillText(`Точки анализа: ${centers.length}`, 20, 95);

        // Сохраняем
        const tempPath = `skeleton_${Date.now()}.png`;
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(tempPath, buffer);

        console.log('✅ Скелетная визуализация создана успешно!');
        return tempPath;

    } catch (error) {
        console.error('❌ Ошибка создания скелетной визуализации:', error);
        return null;
    }
}

// =============================================================================
// 💾 СИСТЕМА СЕССИЙ И ЭТАЛОНОВ
// =============================================================================

function getSession(chatId) {
    if (!photoSessions.has(chatId)) {
        photoSessions.set(chatId, {
            active: false,
            photos: [],
            startTime: null,
            waitingForReference: null,
            waitingForComparison: null
        });
    }
    return photoSessions.get(chatId);
}

function updateUserStats(userId, username, action = 'photo') {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            username: username || `user_${userId}`,
            photosCount: 0,
            analysesCount: 0,
            sessionsCount: 0,
            comparisonsCount: 0,
            firstSeen: new Date(),
            lastSeen: new Date()
        });
        globalStats.totalUsers++;
    }

    const user = userStats.get(userId);
    user.lastSeen = new Date();

    switch(action) {
        case 'photo':
            user.photosCount++;
            globalStats.totalPhotos++;
            break;
        case 'analysis':
            user.analysesCount++;
            globalStats.totalAnalyses++;
            break;
        case 'session':
            user.sessionsCount++;
            globalStats.sessionsStarted++;
            break;
        case 'comparison':
            user.comparisonsCount++;
            globalStats.comparisonsMade++;
            break;
    }

    if (globalStats.totalPhotos % 10 === 0) {
        saveStats();
    }
}

function saveStats() {
    try {
        const statsData = {
            global: globalStats,
            users: Array.from(userStats.entries()),
            timestamp: new Date().toISOString()
        };

        console.log('💾 Статистика обновлена');

        // 🔄 СОХРАНЯЕМ В YANDEX DISK
        if (yandexDisk) {
            setTimeout(async () => {
                try {
                    const tempStatsPath = 'stats_backup.json';
                    fs.writeFileSync(tempStatsPath, JSON.stringify(statsData, null, 2));

                    await yandexDisk.uploadFile(tempStatsPath, 'stats.json');
                    console.log('✅ Статистика сохранена в Яндекс.Диск');

                    // Удаляем временный файл
                    try {
                        if (fs.existsSync(tempStatsPath)) {
                            fs.unlinkSync(tempStatsPath);
                        }
                    } catch (unlinkError) {
                        // Игнорируем ошибку удаления
                    }
                } catch (driveError) {
                    console.log('⚠️ Ошибка сохранения в Яндекс.Диск:', driveError.message);
                }
            }, 1000);
        }
    } catch (error) {
        console.log('❌ Ошибка сохранения статистики:', error.message);
    }
}

// 🔄 ЗАГРУЗКА СТАТИСТИКИ ИЗ ПУБЛИЧНОЙ ССЫЛКИ ЯНДЕКС.ДИСКА
async function loadStatsFromPublicLink() {
    try {
        console.log('🔄 Загрузка статистики по публичной ссылке...');

        const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=https://disk.yandex.ru/d/vjXtSXW8otwaNg`;

        const linkResponse = await axios.get(apiUrl, { timeout: 10000 });
        console.log('✅ Получена ссылка для скачивания');

        // Скачиваем как текст сначала
        const fileResponse = await axios.get(linkResponse.data.href, {
            timeout: 10000,
            responseType: 'text'
        });

        console.log('📥 Файл скачан, длина:', fileResponse.data.length);

        // Пробуем распарсить JSON
        const remoteStats = JSON.parse(fileResponse.data);

        // Проверяем структуру
        if (!remoteStats.global) {
            throw new Error('Неверная структура файла статистики');
        }

        // Обновляем статистику
        Object.assign(globalStats, remoteStats.global);
        userStats.clear();
       
        if (remoteStats.users && Array.isArray(remoteStats.users)) {
            remoteStats.users.forEach(([userId, userData]) => {
                userStats.set(userId, userData);
            });
        }

        console.log('🎯 Статистика загружена из облака');
        return true;

    } catch (error) {
        console.log('❌ Ошибка загрузки:', error.message);
        console.log('💫 Начинаем со свежей статистики');
        return false;
    }
}

// АВТОСОХРАНЕНИЕ КАЖДЫЕ 5 МИНУТ
setInterval(saveStats, 5 * 60 * 1000);

// =============================================================================
// 📱 ОСНОВНЫЕ КОМАНДЫ БОТА
// =============================================================================

bot.onText(/\/start/, async (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);
   
    await bot.sendMessage(msg.chat.id,
        `👟 **СИСТЕМА КРИМИНАЛИСТИЧЕСКОЙ ЭКСПЕРТИЗЫ ОТПЕЧАТКОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} экспертов, ${globalStats.totalPhotos} отпечатков\n\n` +
        `🔍 **ЭКСПЕРТНЫЕ РЕЖИМЫ:**\n` +
        `• **Базовый анализ** - отправьте фото отпечатка\n` +
        `• **/expert_start** - режим эксперта-криминалиста\n` +
        `• **Сравнение с эталоном** - /compare\n\n` +
        `🕵️‍♂️ **РЕЖИМ ЭКСПЕРТА-КРИМИНАЛИСТА:**\n` +
        `• Сессионный анализ multiple отпечатков\n` +
        `• Автоматическое сравнение внутри сессии\n` +
        `• Экспертное заключение по результатам\n\n` +
        `📸 **Основные команды:**\n` +
        `• /save_reference - сохранить эталон подошвы\n` +
        `• /list_references - список эталонов\n` +
        `• /statistics - статистика системы\n` +
        `• /help - помощь\n\n` +
        `💡 **Для криминалистической точности:**\n` +
        `• Снимайте под прямым углом к отпечатку\n` +
        `• Избегайте теней и бликов\n` +
        `• Четкий фокус на деталях протектора\n\n` +
        `⚠️ *Система постоянно совершенствуется*`
    );
});

bot.onText(/\/statistics/, async (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;
   
    // ❌ УДАЛЯЕМ УПОМИНАНИЯ О СЕССИЯХ
    const stats = `📊 **СТАТИСТИКА БОТА:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `🔄 Сравнений сделано: ${globalStats.comparisonsMade}\n` +
                 `📅 Последний анализ: ${globalStats.lastAnalysis ?
                     globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;
   
    await bot.sendMessage(msg.chat.id, stats);
});

bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ И ИНФОРМАЦИЯ О СИСТЕМЕ**\n\n` +
        `🔍 **О СИСТЕМЕ:**\n` +
        `• Модель: ${MODEL_METADATA.name}\n` +
        `• Статус: ${MODEL_METADATA.status}\n` +
        `• Версия: ${MODEL_METADATA.version}\n\n` +
        `📸 **Основные команды:**\n` +
        `• Просто отправьте фото - анализ следа\n` +
        `• /save_reference - сохранить эталон подошвы\n` +
        `• /list_references - список эталонов\n` +
        `• /compare - сравнить с эталоном\n` +
        `• /statistics - статистика бота\n` +
        `• /start - перезапустить бота\n\n` +
        `💡 **Рекомендации по съемке:**\n` +
        `- ${MODEL_METADATA.recommendations.join('\n- ')}\n\n` +
        `⚠️ **Ограничения системы:**\n` +
        `- ${MODEL_METADATA.limitations.join('\n- ')}`
    );
});

// =============================================================================
// 🔄 СИСТЕМА СРАВНЕНИЯ СЛЕДОВ
// =============================================================================

bot.onText(/\/compare$/, async (msg) => {
    const chatId = msg.chat.id;
   
    if (referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Сначала сохраните эталоны:\n' +
            '`/save_reference Название_Модели`\n\n' +
            'Или просто отправьте фото для быстрого анализа'
        );
        return;
    }

    let message = '🔍 **СРАВНЕНИЕ С ЭТАЛОНОМ**\n\n';
    message += '📝 **Укажите модель для сравнения:**\n';
   
    referencePrints.forEach((ref, modelName) => {
        const details = ref.features ? ref.features.detailCount : '?';
        message += `• \`/compare ${modelName}\` (${details} дет.)\n`;
    });
   
    message += '\n💡 **Или отправьте фото для быстрого анализа**';
   
    await bot.sendMessage(chatId, message);
});

bot.onText(/\/compare (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
    const session = getSession(chatId);

    const reference = referencePrints.get(modelName);
    if (!reference) {
        let message = `❌ Эталон "${modelName}" не найден\n\n`;
        message += '📋 **Доступные эталоны:**\n';
       
        referencePrints.forEach((ref, name) => {
            message += `• ${name}\n`;
        });
       
        await bot.sendMessage(chatId, message);
        return;
    }

    session.waitingForComparison = {
        modelName: modelName,
        reference: reference
    };
   
    await bot.sendMessage(chatId,
        `🔍 Сравниваю со следом: "${modelName}"\n\n` +
        '📸 **Отправьте фото следа:**\n' +
        '• След на грунте/песке\n' +
        '• Прямой угол съемки\n' +
        '• Хорошая четкость\n\n' +
        '🎯 **Алгоритм учитывает:**\n' +
        '• Крупные элементы узора\n' +
        '• Расположение деталей\n' +
        '• Характерные формы\n\n' +
        '❌ Для отмены: /cancel'
    );
});

// =============================================================================
// 💾 КОМАНДЫ ДЛЯ РАБОТЫ С ЭТАЛОНАМИ
// =============================================================================

bot.onText(/\/save_reference$/, async (msg) => {
    const chatId = msg.chat.id;
   
    await bot.sendMessage(chatId,
        '💾 **СОХРАНЕНИЕ ЭТАЛОННОГО ОТПЕЧАТКА**\n\n' +
        '📝 **Укажите название модели через пробел:**\n' +
        'Пример: `/save_reference Nike_Air_Max_90`\n\n' +
        '💡 **Рекомендации:**\n' +
        '• Фото чистой подошвы сверху\n' +
        '• Хорошее освещение без теней\n' +
        '• Четкий фокус на протекторе\n' +
        '• Название без пробелов (используйте _)\n\n' +
        '❌ Для отмены: /cancel'
    );
});

bot.onText(/\/save_reference (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
    const session = getSession(chatId);

    if (modelName.length < 2) {
        await bot.sendMessage(chatId, '❌ Название модели слишком короткое');
        return;
    }

    session.waitingForReference = modelName;
   
    await bot.sendMessage(chatId,
        `💾 Сохраняю эталон: "${modelName}"\n\n` +
        '📸 **Отправьте фото подошвы:**\n' +
        '• Чистая подошва, вид сверху\n' +
        '• Хорошее освещение\n' +
        '• Максимальная детализация\n\n' +
        '❌ Для отмены: /cancel'
    );
});

bot.onText(/\/list_references/, async (msg) => {
    const chatId = msg.chat.id;

    if (referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Для добавления эталонов:\n' +
            '`/save_reference Название_Модели`'
        );
        return;
    }

    let list = '📝 **СОХРАНЕННЫЕ ЭТАЛОНЫ:**\n\n';
    let counter = 1;

    referencePrints.forEach((ref, modelName) => {
        const date = ref.timestamp.toLocaleDateString('ru-RU');
        const details = ref.features ? ref.features.detailCount : '?';
        list += `${counter}. **${modelName}**\n`;
        list += `   📅 ${date} | 🔵 ${details} дет.\n\n`;
        counter++;
    });

    await bot.sendMessage(chatId, list);
});



bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getSession(chatId);
   
    session.waitingForReference = null;
    session.waitingForComparison = null; // ← ДОБАВЬТЕ ЭТУ СТРОКУ
   
    await bot.sendMessage(chatId, '❌ Операция отменена');
});

// =============================================================================
// 🕵️‍♂️ КОМАНДЫ РЕЖИМА ЭКСПЕРТА-КРИМИНАЛИСТА
// =============================================================================

bot.onText(/\/expert_start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
   
    const session = getExpertSession(chatId, username);
   
    await bot.sendMessage(chatId,
        `🕵️‍♂️ **РЕЖИМ ЭКСПЕРТА-КРИМИНАЛИСТА АКТИВИРОВАН**\n\n` +
        `**Сессия:** ${session.sessionId}\n` +
        `**Эксперт:** ${username}\n` +
        `**Время начала:** ${session.startTime.toLocaleString('ru-RU')}\n\n` +
        `🔍 **Теперь все отпечатки будут автоматически:**\n` +
        `• Сохраняться в текущую сессию\n` +
        `• Сравниваться между собой\n` +
        `• Анализироваться на сходимость\n\n` +
        `📸 **Просто отправляйте фото отпечатков подошв**\n\n` +
        `**Команды эксперта:**\n` +
        `• /expert_status - статус сессии\n` +
        `• /expert_report - экспертное заключение\n` +
        `• /expert_notes - добавить заметки\n` +
        `• /expert_finish - завершить сессию\n\n` +
        `⚠️ *Все данные сохраняются только до перезапуска бота*`
    );
});

bot.onText(/\/expert_status/, async (msg) => {
    const chatId = msg.chat.id;
    const session = expertSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId,
            '❌ Активная сессия экспертизы не найдена.\n' +
            'Используйте /expert_start для начала работы.'
        );
        return;
    }
   
    const summary = session.getSessionSummary();
   
    let status = `🕵️‍♂️ **СТАТУС СЕССИИ ЭКСПЕРТИЗЫ**\n\n`;
    status += `**ID:** ${summary.sessionId}\n`;
    status += `**Статус:** ${summary.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
    status += `**Отпечатков:** ${summary.footprintsCount}\n`;
    status += `**Сравнений:** ${summary.comparisonsCount}\n`;
    status += `**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n`;
    status += `**Длительность:** ${Math.round(summary.duration / 60000)} мин.\n`;
   
    if (session.notes) {
        status += `\n**Заметки эксперта:**\n${session.notes}`;
    }
   
    await bot.sendMessage(chatId, status);
});

bot.onText(/\/expert_report/, async (msg) => {
    const chatId = msg.chat.id;
    const session = expertSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для отчета.');
        return;
    }
   
    if (session.footprints.length < 2) {
        await bot.sendMessage(chatId,
            '📊 **Недостаточно данных для отчета**\n\n' +
            'Для генерации экспертного заключения требуется минимум 2 отпечатка.\n' +
            `Сейчас в сессии: ${session.footprints.length} отпечатков`
        );
        return;
    }
   
    const report = session.generateExpertReport();
    await bot.sendMessage(chatId, report);
});

bot.onText(/\/expert_notes(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const session = expertSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для добавления заметок.');
        return;
    }
   
    const notesText = match ? match[1] : null;
   
    if (!notesText) {
        await bot.sendMessage(chatId,
            '📝 **Добавление заметок к сессии**\n\n' +
            'Использование: `/expert_notes Ваш текст заметки`\n\n' +
            'Текущие заметки:\n' +
            (session.notes || 'Пока нет заметок')
        );
        return;
    }
   
    session.notes = notesText;
    await bot.sendMessage(chatId, '✅ Заметки эксперта сохранены');
});

bot.onText(/\/expert_finish/, async (msg) => {
    const chatId = msg.chat.id;
    const session = expertSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для завершения.');
        return;
    }
   
    session.status = 'completed';
    const report = session.generateExpertReport();
   
    await bot.sendMessage(chatId,
        `🔚 **СЕССИЯ ЭКСПЕРТИЗЫ ЗАВЕРШЕНА**\n\n${report}\n\n` +
        `📁 Все данные сохранены до перезапуска бота.\n` +
        `🔄 Для новой сессии используйте /expert_start`
    );
});

// =============================================================================
// 📸 ОБРАБОТКА ФОТО
// =============================================================================

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        const session = getSession(chatId);

        // Проверка сохранения эталона
        if (session.waitingForReference) {
            const modelName = session.waitingForReference;

            await bot.sendMessage(chatId, '📥 Получено фото эталона, анализирую...');

            const photo = msg.photo[msg.photo.length - 1];
            const file = await bot.getFile(photo.file_id);
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

            const response = await axios({
                method: "POST",
                url: 'https://detect.roboflow.com/-zqyih/13',
                params: {
                    api_key: 'NeHOB854EyHkDbGGLE6G',
                    image: fileUrl,
                    confidence: 25,
                    overlap: 30,
                    format: 'json'
                },
                timeout: 30000
            });

            const predictions = response.data.predictions || [];
const processedPredictions = smartPostProcessing(predictions);
const finalPredictions = processedPredictions.length > 0 ? processedPredictions : predictions;

// 🔄 ДОБАВЛЯЕМ АНАЛИЗ ПЕРСПЕКТИВЫ ПРЯМО ЗДЕСЬ:
let perspectiveAnalysis = { hasPerspectiveIssues: false, issues: [], recommendations: [] };
try {
    // Получаем размеры изображения для анализа
    const image = await loadImage(fileUrl);
    perspectiveAnalysis = analyzePerspectiveDistortion(
        finalPredictions,
        image.width,
        image.height
    );
} catch (error) {
    console.log('⚠️ Не удалось проанализировать перспективу:', error.message);
}

// 🕵️‍♂️ ПРОВЕРЯЕМ АКТИВНУЮ СЕССИЮ ЭКСПЕРТИЗЫ
const expertSession = expertSessions.get(chatId);
if (expertSession && expertSession.status === 'active') {
    console.log(`🕵️‍♂️ Добавляю отпечаток в сессию экспертизы: ${expertSession.sessionId}`);
   
    const footprintData = {
        imageUrl: fileUrl,
        predictions: finalPredictions,
        features: extractFeatures(finalPredictions),
        perspectiveAnalysis: perspectiveAnalysis,
        orientation: {
            type: analyzeOrientationType(finalPredictions),
            angle: calculateOrientationAngle(
                finalPredictions.find(pred =>
                    pred.class === 'Outline-trail' || pred.class.includes('Outline')
                )?.points || []
            )
        }
    };
   
    const footprintRecord = expertSession.addFootprint(footprintData);
   
    // ДОБАВЛЯЕМ ИНФОРМАЦИЮ О СЕССИИ В ОТЧЕТ
    baseCaption += `\n\n🕵️‍♂️ **СЕССИЯ ЭКСПЕРТИЗЫ**\n`;
    baseCaption += `• Отпечаток #${expertSession.footprints.length} зарегистрирован\n`;
   
    if (expertSession.comparisons.length > 0) {
        const lastComparison = expertSession.comparisons[expertSession.comparisons.length - 1];
        baseCaption += `• Автосравнение: ${lastComparison.similarity.toFixed(1)}% сходства\n`;
    }
}
              
            referencePrints.set(modelName, {
                features: {
                    detailCount: processedPredictions.length,
                    totalArea: 0
                },
                imageUrl: fileUrl,
                timestamp: new Date(),
                predictions: processedPredictions
            });

            session.waitingForReference = null;

            await bot.sendMessage(chatId,
                `✅ Эталон сохранен: "${modelName}"\n` +
                `📊 Детали: ${processedPredictions.length} элементов\n\n` +
                'Используйте `/list_references` для просмотра'
            );
            return;
        }

        // Обычная обработка фото
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');

        await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');

        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

        await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');

        const response = await axios({
            method: "POST",
            url: 'https://detect.roboflow.com/-zqyih/13',
            params: {
                api_key: 'NeHOB854EyHkDbGGLE6G',
                image: fileUrl,
                confidence: 25,
                overlap: 30,
                format: 'json'
            },
            timeout: 30000
        });

        const predictions = response.data.predictions || [];
        const processedPredictions = smartPostProcessing(predictions);
        const finalPredictions = processedPredictions.length > 0 ? processedPredictions : predictions;

// =============================================================================
// 📐 АНАЛИЗ ПЕРСПЕКТИВНЫХ ИСКАЖЕНИЙ
// =============================================================================

let perspectiveAnalysis = { hasPerspectiveIssues: false, issues: [], recommendations: [] };

try {
    console.log('📐 Запускаю анализ перспективных искажений...');
   
    // Получаем размеры изображения для анализа
    const image = await loadImage(fileUrl);
    console.log(`📏 Размер изображения: ${image.width}x${image.height}`);
   
    // ВЫЗЫВАЕМ ФУНКЦИЮ АНАЛИЗА ПЕРСПЕКТИВЫ
    perspectiveAnalysis = analyzePerspectiveDistortion(
        finalPredictions,
        image.width,
        image.height
    );
   
    console.log('📐 Результат анализа перспективы:', {
        hasIssues: perspectiveAnalysis.hasPerspectiveIssues,
        issues: perspectiveAnalysis.issues,
        confidence: perspectiveAnalysis.confidence
    });
   
} catch (error) {
    console.log('⚠️ Не удалось проанализировать перспективу:', error.message);
    perspectiveAnalysis = {
        hasPerspectiveIssues: false,
        issues: ['анализ_не_удался'],
        recommendations: ['не_удалось_оценить_качество_съемки'],
        confidence: 'low'
    };
}
      
        // Проверка сравнения с эталоном
        if (session.waitingForComparison) {
            const comparisonData = session.waitingForComparison;
            const modelName = comparisonData.modelName;
            const reference = comparisonData.reference;

            console.log(`🔍 Начинаем сравнение с эталоном "${modelName}"`);
            console.log('📊 Данные эталона:', reference);

            try {
                // ИСПРАВЛЕНИЕ: используем предсказания из эталона
                const referencePredictions = reference.predictions || [];
                const footprintPredictions = processedPredictions || finalPredictions || predictions || [];

                console.log(`📊 Эталон: ${referencePredictions.length} предсказаний`);
                console.log(`📊 След: ${footprintPredictions.length} предсказаний`);

                const footprintFeatures = extractFeatures(footprintPredictions);
                console.log('✅ Features следа:', footprintFeatures);

                const referenceFeatures = reference.features || { detailCount: 0 };
                console.log('✅ Features эталона:', referenceFeatures);

                // 🔥 ПЕРЕДАЕМ ПРЕДСКАЗАНИЯ ДЛЯ УЧЕТА ОРИЕНТАЦИИ
const comparisonResult = compareWithMirror(referenceFeatures, footprintFeatures, footprintPredictions);
                  
               // Формируем отчет
let report = `🔍 **СРАВНЕНИЕ С "${modelName}"**\n\n`;
report += `🎯 **Вероятность совпадения: ${Math.round(comparisonResult.overallScore)}%**\n\n`;

// 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ ОБ ОРИЕНТАЦИИ
if (comparisonResult.orientationAdjusted) {
    report += `📐 **Учет ориентации:** угол ${Math.abs(comparisonResult.orientationAngle).toFixed(1)}°\n`;
}
if (comparisonResult.mirrorUsed) {
    report += `🔄 **Учтена симметрия** (левый/правый ботинок)\n`;
}

report += `\n📈 **Детальный анализ:**\n`;
report += `• 🎨 Узор: ${Math.round(comparisonResult.patternSimilarity)}%\n`;
report += `• 📐 Расположение: ${Math.round(comparisonResult.spatialDistribution)}%\n`;
report += `• 🔍 Детали: ${Math.round(comparisonResult.detailMatching)}%\n`;
report += `• ⭐ Формы: ${Math.round(comparisonResult.shapeConsistency)}%\n\n`;

if (comparisonResult.mirrorUsed) {
    report += `🔄 **Учтена симметрия** (левый/правый ботинок)\n\n`;
}

// Интерпретация результата
if (comparisonResult.overallScore > 70) {
    report += `✅ **ВЫСОКАЯ ВЕРОЯТНОСТЬ** - след соответствует модели`;
} else if (comparisonResult.overallScore > 50) {
    report += `🟡 **СРЕДНЯЯ ВЕРОЯТНОСТЬ** - возможное соответствие`;
} else if (comparisonResult.overallScore > 30) {
    report += `🟠 **НИЗКАЯ ВЕРОЯТНОСТЬ** - слабое соответствие`;
} else {
    report += `❌ **ВЕРОЯТНО НЕСООТВЕТСТВИЕ** - разные модели`;
}
                  
// Добавляем прозрачность модели
report += `\n\n---\n`;
report += `🔍 **ИНФОРМАЦИЯ О СИСТЕМЕ:**\n`;
report += `• Модель: ${MODEL_METADATA.name} (${MODEL_METADATA.status})\n`;
report += `• Уверенность анализа: ${comparisonResult.confidence}\n\n`;
report += `💡 **Рекомендации:** ${MODEL_METADATA.recommendations.join(', ')}`;
await bot.sendMessage(chatId, report);

                console.log('✅ Сравнение завершено успешно');

            } catch (error) {
                console.error('❌ Ошибка при сравнении:', error);
                console.error('❌ Stack trace:', error.stack);
                await bot.sendMessage(chatId,
                    '❌ Ошибка при сравнении следов. Попробуйте другое фото.\n\n' +
                    '💡 **Советы:**\n' +
                    '• Убедитесь в четкости фото\n' +
                    '• Прямой угол съемки\n' +
                    '• Хорошее освещение'
                );
            }

            session.waitingForComparison = null;
            updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'comparison');
            return;
        }

// 📤 ЗАГРУЗКА ФОТО НА ЯНДЕКС.ДИСК
if (yandexDisk) {
    try {
        const timestamp = Date.now();
        const photoId = `user_${msg.from.id}_${timestamp}`;
       
        // Загружаем оригинальное фото
        const tempPhotoPath = `temp_${photoId}.jpg`;
        const photoResponse = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });
       
        const writer = fs.createWriteStream(tempPhotoPath);
        photoResponse.data.pipe(writer);
       
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
       
        // Загружаем на Яндекс.Диск
        await yandexDisk.uploadFile(tempPhotoPath, `${photoId}.jpg`);
       
        // Удаляем временный файл
        fs.unlinkSync(tempPhotoPath);
       
        console.log(`✅ Фото загружено на Яндекс.Диск: ${photoId}.jpg`);
       
    } catch (uploadError) {
        console.log('⚠️ Ошибка загрузки на Яндекс.Диск:', uploadError.message);
    }
}
      
        if (finalPredictions.length > 0) {
    await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');
    const userData = {
        username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name
    };
    const vizPath = await createAnalysisVisualization(fileUrl, finalPredictions, userData);
   
    // 🔄 ОБНОВЛЕННЫЙ БЛОК С ПРОЗРАЧНОСТЬЮ И АНАЛИЗОМ ПЕРСПЕКТИВЫ
let baseCaption = `✅ Анализ завершен!\n🎯 Выявлено морфологических признаков: ${finalPredictions.length}`;

// ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ПЕРСПЕКТИВЕ
if (perspectiveAnalysis.hasPerspectiveIssues) {
    baseCaption += `\n⚠️ **Обнаружены искажения:** ${perspectiveAnalysis.issues.join(', ')}`;
    if (perspectiveAnalysis.recommendations.length > 0) {
        baseCaption += `\n💡 **Рекомендации:** ${perspectiveAnalysis.recommendations.join(', ')}`;
    }
} else {
    baseCaption += `\n📐 Перспектива: нормальная`;
}

// АНАЛИЗ ОРИЕНТАЦИИ
const orientationType = analyzeOrientationType(finalPredictions);
const orientationText = {
    'aligned': '✅ Нормальная ориентация',
    'rotated_clockwise': '🔄 Поворот по часовой',
    'rotated_counterclockwise': '🔄 Поворот против часовой',
    'strongly_rotated': '⚠️ Сильный поворот',
    'unknown': '❓ Ориентация не определена'
};
const orientationAngle = calculateOrientationAngle(
    finalPredictions.find(pred =>
        pred.class === 'Outline-trail' || pred.class.includes('Outline')
    )?.points || []
);

if (orientationType !== 'unknown' && Math.abs(orientationAngle) > 0) {
    baseCaption += `\n🧭 ${orientationText[orientationType]} (${Math.abs(orientationAngle).toFixed(1)}°)`;
} else {
    baseCaption += `\n🧭 ${orientationText[orientationType]}`;
}

const transparentCaption = addModelTransparency(baseCaption, finalPredictions.length);
   
    if (vizPath) {
        await bot.sendPhoto(chatId, vizPath, {
            caption: transparentCaption  // ← ТЕПЕРЬ С ПРОЗРАЧНОСТЬЮ
        });
        fs.unlinkSync(vizPath);
       
        // Скелетная визуализация
        console.log('🔍 Пытаюсь создать скелетную визуализацию...');
        try {
            const skeletonPath = await createSkeletonVisualization(fileUrl, finalPredictions, userData);
            if (skeletonPath) {
    console.log('✅ Карта признаков создана, отправляю...');
    await bot.sendPhoto(chatId, skeletonPath, {
        caption: `🕵️‍♂️ Карта морфологических признаков протектора`
    });
    fs.unlinkSync(skeletonPath);
}
        } catch (error) {
            console.error('💥 Ошибка при создании скелетной визуализации:', error);
        }
    } else {
        await bot.sendMessage(chatId, transparentCaption);  // ← ТЕПЕРЬ С ПРОЗРАЧНОСТЬЮ
    }
} else {
            await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
        }

        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'analysis');

    } catch (error) {
        console.log('❌ Ошибка анализа фото:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка при анализе фото. Попробуйте еще раз.');
    }
});

// =============================================================================
// 🚀 ЗАПУСК СИСТЕМЫ
// ===============================================================
async function loadStats() {
    try {
        console.log('🔄 Загрузка статистики из Яндекс.Диска...');
       
        const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=https://disk.yandex.ru/d/vjXtSXW8otwaNg`;
        const linkResponse = await axios.get(apiUrl, { timeout: 10000 });
       
        const fileResponse = await axios.get(linkResponse.data.href, {
            timeout: 10000,
            responseType: 'text'
        });

        const remoteStats = JSON.parse(fileResponse.data);
       
        if (remoteStats.global) {
            Object.assign(globalStats, remoteStats.global);
            userStats.clear();
           
            if (remoteStats.users && Array.isArray(remoteStats.users)) {
                remoteStats.users.forEach(([userId, userData]) => {
                    userStats.set(userId, userData);
                });
            }
           
            console.log('✅ Статистика загружена:');
            console.log(`   👥 Пользователей: ${globalStats.totalUsers}`);
            console.log(`   📸 Фото: ${globalStats.totalPhotos}`);
        }
    } catch (error) {
        console.log('❌ Ошибка загрузки статистики:', error.message);
        console.log('💫 Начинаем со свежей статистики');
    }
}

// Автосохранение каждые 5 минут
setInterval(saveStats, 5 * 60 * 1000);

// Анти-сон система
setInterval(() => {
    console.log('🔄 Keep-alive ping:', new Date().toISOString());
}, 4 * 60 * 1000);

// Запуск сервера
app.listen(PORT, async () => {
    console.log(`🟢 HTTP сервер запущен на порту ${PORT}`);
   
    try {
        await bot.setWebHook(WEBHOOK_URL);
        console.log('✅ Webhook установлен');
    } catch (error) {
        console.log('❌ Ошибка установки webhook:', error.message);
    }
   
    // 🔄 ЗАГРУЖАЕМ СТАТИСТИКУ ИЗ ПУБЛИЧНОЙ ССЫЛКИ
    await loadStatsFromPublicLink();
   
    console.log('🤖 Бот полностью готов к работе!');
    console.log(`📊 Текущая статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото`);
});

// Обработчики ошибок
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
});

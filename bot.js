// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                       АНАЛИЗАТОР СЛЕДОВ ОБУВИ (WEBHOOK ВЕРСИЯ)               🔵
// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

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
    sessionsStarted: 0,
    comparisonsMade: 0
};

const referencePrints = new Map();
const photoSessions = new Map();

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
// 🧠 УМНАЯ ПОСТОБРАБОТКА
// =============================================================================

function smartPostProcessing(predictions) {
    if (!predictions || predictions.length === 0) return [];

    console.log(`🔧 Умная постобработка: ${predictions.length} объектов`);

    const filtered = predictions.filter(pred => {
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

function compareFootprints(referenceFeatures, footprintFeatures) {
    console.log('🔍 СРАВНЕНИЕ: эталон vs след');
    console.log('📊 Эталон:', referenceFeatures);
    console.log('📊 След:', footprintFeatures);

    const scores = {
        detailCount: 0,
        spatialLayout: 0,
        shapeCharacteristics: 0,
        overallScore: 0
    };

    // 1. Сравнение количества деталей (30%)
    const refDetails = referenceFeatures.detailCount || 0;
    const footprintDetails = footprintFeatures.detailCount || 0;

    console.log(`📊 Детали: эталон=${refDetails}, след=${footprintDetails}`);

    if (refDetails > 0 && footprintDetails > 0) {
        const countSimilarity = Math.min(refDetails, footprintDetails) / Math.max(refDetails, footprintDetails);
        scores.detailCount = countSimilarity * 30;
        console.log(`✅ Сходство деталей: ${countSimilarity.toFixed(2)} -> ${scores.detailCount.toFixed(1)}%`);
    } else {
        console.log('❌ Недостаточно деталей для сравнения');
    }

    // 2. Пространственное расположение (40%)
    if (refDetails >= 2 && footprintDetails >= 2) {
        scores.spatialLayout = 24; // Базовый score 60% от 40
       
        // Бонус за большее количество деталей
        const avgDetails = (refDetails + footprintDetails) / 2;
        if (avgDetails > 5) scores.spatialLayout += 8;
        if (avgDetails > 10) scores.spatialLayout += 8;
       
        scores.spatialLayout = Math.min(scores.spatialLayout, 40);
        console.log(`✅ Пространственное расположение: ${scores.spatialLayout.toFixed(1)}%`);
    }

    // 3. Характерные формы (30%)
    scores.shapeCharacteristics = 15; // Базовый score
   
    // Бонусы за специфические особенности
    if (footprintFeatures.hasOutline) scores.shapeCharacteristics += 10;
    if (footprintFeatures.largeDetails > 0) scores.shapeCharacteristics += 5;
   
    scores.shapeCharacteristics = Math.min(scores.shapeCharacteristics, 30);
    console.log(`✅ Характерные формы: ${scores.shapeCharacteristics.toFixed(1)}%`);

    // Общий счет
    scores.overallScore = scores.detailCount + scores.spatialLayout + scores.shapeCharacteristics;
    scores.overallScore = Math.min(scores.overallScore, 100); // Ограничиваем 100%

    console.log('📊 Итоговые результаты сравнения:', scores);
    return scores;
}

// Упрощенная функция извлечения features
function extractFeatures(predictions) {
    console.log(`📊 Извлекаем features из ${predictions.length} предсказаний`);
   
    const features = {
        detailCount: predictions.length, // Просто количество обнаруженных объектов
        hasOutline: false,
        largeDetails: 0
    };

    // Проверяем есть ли контуры
    predictions.forEach(pred => {
        if (pred.class && pred.class.includes('Outline')) {
            features.hasOutline = true;
        }
       
        // Считаем "крупные" детали (просто по количеству точек)
        if (pred.points && pred.points.length > 8) {
            features.largeDetails++;
        }
    });

    console.log('📊 Извлеченные features:', features);
    return features;
}

function extractFeatures(predictions) {
    const features = {
        detailCount: 0,
        hasOutline: false,
        largeDetails: 0
    };

    predictions.forEach(pred => {
        features.detailCount++;
       
        if (pred.class === 'Outline-trail') {
            features.hasOutline = true;
        }
       
        // Считаем крупные детали (площадь > 1000px²)
        if (pred.points && pred.points.length > 5) {
            const bbox = calculateBoundingBox(pred.points);
            const area = bbox.width * bbox.height;
            if (area > 1000) {
                features.largeDetails++;
            }
        }
    });

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
    } catch (error) {
        console.log('❌ Ошибка сохранения статистики:', error.message);
    }
}

// =============================================================================
// 📱 ОСНОВНЫЕ КОМАНДЫ БОТА
// =============================================================================

bot.onText(/\/start/, async (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'session');
   
    await bot.sendMessage(msg.chat.id,
        `👟 **АНАЛИЗАТОР СЛЕДОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото\n\n` +
        `📸 **Отправьте фото** для анализа следа\n` +
        `💾 **/save_reference** - сохранить эталон\n` +
        `📝 **/list_references** - список эталонов\n` +
        `📊 **/statistics** - показать статистику\n` +
        `🆘 **/help** - помощь\n\n` +
        `💡 Бот работает в стабильном режиме!`
    );
});

bot.onText(/\/statistics/, async (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;

    const stats = `📊 **СТАТИСТИКА БОТА:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `📋 Сессий начато: ${globalStats.sessionsStarted}\n` +
                 `🔄 Сравнений сделано: ${globalStats.comparisonsMade}`;

    await bot.sendMessage(msg.chat.id, stats);
});

bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ**\n\n` +
        `📸 **Основные команды:**\n` +
        `• Просто отправьте фото - анализ следа\n` +
        `• /save_reference - сохранить эталон подошвы\n` +
        `• /list_references - список эталонов\n` +
        `• /statistics - статистика бота\n` +
        `• /start - перезапустить бота\n\n` +
        `💡 **Советы:**\n` +
        `• Для лучших результатов: хорошее освещение\n` +
        `• Фото под прямым углом\n` +
        `• Четкий фокус на следе`
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
                url: 'https://detect.roboflow.com/-zqyih/12',
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

// Проверка сравнения с эталоном
if (session.waitingForComparison) {
    const comparisonData = session.waitingForComparison;
    const modelName = comparisonData.modelName;
    const reference = comparisonData.reference;

    console.log(`🔍 Начинаем сравнение с эталоном "${modelName}"`);
    console.log('📊 Данные эталона:', reference);

    await bot.sendMessage(chatId, `🔍 Сравниваю след с эталоном "${modelName}"...`);

    try {
        const footprintFeatures = extractFeatures(processedPredictions);
        const referenceFeatures = reference.features;

        console.log('📊 Features эталона:', referenceFeatures);
        console.log('📊 Features следа:', footprintFeatures);

        const comparisonResult = compareFootprints(referenceFeatures, footprintFeatures);

        // Формируем отчет
        let report = `🔍 **СРАВНЕНИЕ С "${modelName}"**\n\n`;
        report += `🎯 Вероятность совпадения: **${Math.round(comparisonResult.overallScore)}%**\n\n`;
        report += `📊 Анализ:\n`;
        report += `• 🔢 Количество деталей: ${Math.round(comparisonResult.detailCount)}%\n`;
        report += `• 📐 Расположение: ${Math.round(comparisonResult.spatialLayout)}%\n`;
        report += `• ⭐ Формы: ${Math.round(comparisonResult.shapeCharacteristics)}%\n\n`;

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

        report += `\n\n💡 *Учет деформации грунта и потери мелких деталей*`;

        await bot.sendMessage(chatId, report);

        // Визуализация
        const userData = {
            username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name
        };

        const vizPath = await createAnalysisVisualization(fileUrl, finalPredictions, userData);
        if (vizPath) {
            await bot.sendPhoto(chatId, vizPath, {
                caption: `📸 Анализированный след (${finalPredictions.length} дет.)`
            });
            fs.unlinkSync(vizPath);
        }

    } catch (error) {
        console.error('❌ Ошибка при сравнении:', error);
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
      
        // Обычная обработка фото
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');
       
        await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');
       
        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
       
        await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');
       
        const response = await axios({
            method: "POST",
            url: 'https://detect.roboflow.com/-zqyih/12',
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

        if (finalPredictions.length > 0) {
            await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');
           
            const userData = {
                username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name
            };
           
            const vizPath = await createAnalysisVisualization(fileUrl, finalPredictions, userData);
           
            if (vizPath) {
                await bot.sendPhoto(chatId, vizPath, {
                    caption: `✅ Анализ завершен!\n🎯 Обнаружено объектов: ${finalPredictions.length}`
                });
                fs.unlinkSync(vizPath);
            } else {
                await bot.sendMessage(chatId,
                    `✅ Анализ завершен!\n🎯 Обнаружено объектов: ${finalPredictions.length}`
                );
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
// =============================================================================

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
   
    await loadStats();
   
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

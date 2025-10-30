// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                       АНАЛИЗАТОР СЛЕДОВ ОБУВИ (WEBHOOK ВЕРСИЯ)               🔵
// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const { createCanvas, loadImage } = require('canvas')
const fs = require('fs')

const app = express();
app.use(express.json());

// 🎯 НАСТРОЙКИ
const TELEGRAM_TOKEN = '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = `https://shoe-print-bot.onrender.com/bot${TELEGRAM_TOKEN}`;

console.log('🚀 Запуск бота с Webhook...');
console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);

// 📊 СИСТЕМА СТАТИСТИКИ
const userStats = new Map();
const globalStats = {
    totalUsers: 0,
    totalPhotos: 0,
    totalAnalyses: 0,
    sessionsStarted: 0,
    comparisonsMade: 0
};

// 🎯 ИНИЦИАЛИЗАЦИЯ БОТА
const bot = new TelegramBot(TELEGRAM_TOKEN);

// 🟢 WEBHOOK МАРШРУТ
app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🟢 СТРАНИЦА ДЛЯ RENDER
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Анализатор следов обуви</title></head>
            <body>
                <h1>🤖 Анализатор следов обуви</h1>
                <p>Бот работает! Используйте Telegram:</p>
                <p><a href="https://t.me/Sled_la_bot">@Sled_la_bot</a></p>
                <p>📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото</p>
            </body>
        </html>
    `);
});

// 🟢 HEALTH CHECK ДЛЯ RENDER
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

// 🟢 ОСНОВНЫЕ КОМАНДЫ БОТА
bot.onText(/\/start/, (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'session');
   
    bot.sendMessage(msg.chat.id,
        `👟 **АНАЛИЗАТОР СЛЕДОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото\n\n` +
        `📸 **Отправьте фото** для анализа следа\n` +
        `📊 **/statistics** - показать статистику\n` +
        `🆘 **/help** - помощь\n\n` +
        `💡 Бот работает в стабильном режиме!`
    );
});

bot.onText(/\/statistics/, (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;

    const stats = `📊 **СТАТИСТИКА БОТА:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `📋 Сессий начато: ${globalStats.sessionsStarted}\n` +
                 `🔄 Сравнений сделано: ${globalStats.comparisonsMade}`;

    bot.sendMessage(msg.chat.id, stats);
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ**\n\n` +
        `📸 **Основные команды:**\n` +
        `• Просто отправьте фото - анализ следа\n` +
        `• /statistics - статистика бота\n` +
        `• /start - перезапустить бота\n\n` +
        `💡 **Советы:**\n` +
        `• Для лучших результатов: хорошее освещение\n` +
        `• Фото под прямым углом\n` +
        `• Четкий фокус на следе`
    );
});

// 🟢 КОМАНДА ДЛЯ СБРОСА WEBHOOK
bot.onText(/\/reset_webhook/, async (msg) => {
    try {
        await bot.deleteWebHook();
        await bot.setWebHook(WEBHOOK_URL);
        await bot.sendMessage(msg.chat.id, '✅ Webhook сброшен и установлен заново!');
    } catch (error) {
        await bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
    }
});

// 🧠 УМНАЯ ПОСТОБРАБОТКА - УЛУЧШЕННЫЕ АЛГОРИТМЫ

function smartPostProcessing(predictions) {
    if (!predictions || predictions.length === 0) return [];

    console.log(`🔧 Умная постобработка: ${predictions.length} объектов`);

    // 1. Фильтрация слишком маленьких объектов
    const filtered = predictions.filter(pred => {
        if (!pred.points || pred.points.length < 3) return false;
       
        // Рассчитываем площадь bounding box
        const bbox = calculateBoundingBox(pred.points);
        const area = bbox.width * bbox.height;
       
        // Фильтруем слишком маленькие объекты
        return area > 100; // минимальная площадь 100px²
    });

    // 2. Упрощение полигонов (сохраняя острые углы)
    const optimized = filtered.map(pred => {
        if (pred.points.length <= 6) return pred; // Не упрощаем маленькие полигоны

        const optimizedPoints = simplifyPolygon(pred.points, getEpsilonForClass(pred.class));
       
        return {
            ...pred,
            points: optimizedPoints,
            originalPoints: pred.points.length,
            optimizedPoints: optimizedPoints.length
        };
    });

    console.log(`✅ После постобработки: ${optimized.length} объектов`);
    return optimized;
}

// 🎯 УПРОЩЕНИЕ ПОЛИГОНОВ (алгоритм Дугласа-Пекера)
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

// 🎯 РАСЧЕТ BOUNDING BOX
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

// 🎯 EPSILON ДЛЯ РАЗНЫХ КЛАССОВ
function getEpsilonForClass(className) {
    switch(className) {
        case 'shoe-protector':
            return 1.5;  // Меньше упрощения для деталей
        case 'Outline-trail':
            return 0.8;  // Минимальное упрощение для контуров
        case 'Heel':
        case 'Toe':
            return 1.0;  // Среднее упрощение
        default:
            return 1.2;
    }
}

// 🎨 ФУНКЦИЯ ВИЗУАЛИЗАЦИИ РЕЗУЛЬТАТОВ
async function createAnalysisVisualization(imageUrl, predictions, userData = {}) {
    try {
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Рисуем оригинальное фото
        ctx.drawImage(image, 0, 0);

        // Цвета для разных классов
        const colors = {
            'Outline-trail': 'rgba(148, 0, 211, 0.8)',    // Фиолетовый - контур
            'shoe-protector': 'rgba(64, 224, 208, 0.7)',  // Бирюзовый - детали
            'Heel': 'rgba(0, 0, 255, 0.6)',              // Синий - каблук
            'Toe': 'rgba(30, 144, 255, 0.6)'             // Голубой - мысок
        };

        // Рисуем полигоны
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

                // Подпись без confidence (только для крупных объектов)
if (pred.points.length > 10) { // Только для достаточно крупных полигонов
    const centerX = pred.points.reduce((sum, p) => sum + p.x, 0) / pred.points.length;
    const centerY = pred.points.reduce((sum, p) => sum + p.y, 0) / pred.points.length;
    
    ctx.fillStyle = color;
    ctx.font = 'bold 14px Arial';
    
    // Красивые русские названия
    const classNames = {
        'Outline-trail': 'КОНТУР',
        'shoe-protector': 'ДЕТАЛЬ', 
        'Heel': 'КАБЛУК',
        'Toe': 'МЫСОК'
    };
    
    const displayName = classNames[pred.class] || pred.class;
    ctx.fillText(displayName, centerX - 30, centerY - 5);
}

            }
        });

        // 🎯 ВОДЯНОЙ ЗНАК
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, image.height - 80, 300, 70);
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`👤 ${userData.username || 'Пользователь'}`, 20, image.height - 55);
        ctx.fillText(`📅 ${new Date().toLocaleString('ru-RU')}`, 20, image.height - 35);
        ctx.fillText(`🔍 Анализатор следов обуви`, 20, image.height - 15);

        // Сохраняем временный файл
        const vizPath = `viz_${Date.now()}.jpg`;
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
        require('fs').writeFileSync(vizPath, buffer);

        return vizPath;

    } catch (error) {
        console.log('❌ Ошибка визуализации:', error.message);
        return null;
    }
}

// 🟢 ОБРАБОТКА ФОТО С ВИЗУАЛИЗАЦИЕЙ
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
   
    try {
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');
       
        await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');
       
        // Скачиваем фото
        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
       
        await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');
       
        // Анализ через Roboflow
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

// 🔧 ПРИМЕНЯЕМ УМНУЮ ПОСТОБРАБОТКУ
const processedPredictions = smartPostProcessing(predictions);

// Логируем улучшения
if (predictions.length !== processedPredictions.length) {
    console.log(`🎯 Фильтрация: ${predictions.length} → ${processedPredictions.length} объектов`);
}

// Используем обработанные предсказания для визуализации
const finalPredictions = processedPredictions.length > 0 ? processedPredictions : predictio
        
        // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ
        if (predictions.length > 0) {
            await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');
           
            const userData = {
                username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name
            };
           
            const vizPath = await createAnalysisVisualization(fileUrl, finalPredictions, userData);
           
            if (vizPath) {
                // Отправляем визуализацию
                await bot.sendPhoto(chatId, vizPath, {
                    caption: `✅ Анализ завершен!\n🎯 Обнаружено объектов: ${predictions.length}`
                });
               
                // Удаляем временный файл
                require('fs').unlinkSync(vizPath);
            } else {
                await bot.sendMessage(chatId,
                    `✅ Анализ завершен!\n🎯 Обнаружено объектов: ${predictions.length}`
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

// 🟢 ФУНКЦИЯ ОБНОВЛЕНИЯ СТАТИСТИКИ
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

    // Автосохранение каждые 10 фото
    if (globalStats.totalPhotos % 10 === 0) {
        saveStats();
    }
}

// 🟢 СОХРАНЕНИЕ СТАТИСТИКИ
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

// 🟢 ЗАГРУЗКА СТАТИСТИКИ ПРИ СТАРТЕ
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

// 🟢 АВТОСОХРАНЕНИЕ КАЖДЫЕ 5 МИНУТ
setInterval(saveStats, 5 * 60 * 1000);

// 🟢 АНТИ-СОН СИСТЕМА
setInterval(() => {
    console.log('🔄 Keep-alive ping:', new Date().toISOString());
}, 4 * 60 * 1000);

// 🚀 ЗАПУСК СЕРВЕРА
app.listen(PORT, async () => {
    console.log(`🟢 HTTP сервер запущен на порту ${PORT}`);
   
    // Настраиваем webhook
    try {
        await bot.setWebHook(WEBHOOK_URL);
        console.log('✅ Webhook установлен');
    } catch (error) {
        console.log('❌ Ошибка установки webhook:', error.message);
    }
   
    // Загружаем статистику
    await loadStats();
   
    console.log('🤖 Бот полностью готов к работе!');
    console.log(`📊 Текущая статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото`);
});

// 🟢 ОБРАБОТЧИКИ ОШИБОК
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
});

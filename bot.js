// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                БАЗОВЫЙ АНАЛИЗАТОР СЛЕДОВ ОБУВИ (УПРОЩЕННАЯ ВЕРСИЯ)           🔵
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
// 🎯 КОНФИГУРАЦИЯ И НАСТРОЙКИ
// =============================================================================

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = `https://shoe-print-bot.onrender.com/bot${TELEGRAM_TOKEN}`;

console.log('🚀 Запуск базовой версии бота...');

// =============================================================================
// 📊 СИСТЕМА СТАТИСТИКИ
// =============================================================================

const userStats = new Map();
const globalStats = {
    totalUsers: 0,
    totalPhotos: 0,
    totalAnalyses: 0,
    lastAnalysis: null
};

// =============================================================================
// 💾 СИСТЕМА СОХРАНЕНИЯ ДАННЫХ
// =============================================================================

class DataPersistence {
    constructor() {
        this.dataFile = 'basic_stats.json';
        this.backupInterval = 5 * 60 * 1000; // 5 минут
        this.setupAutoSave();
    }

    setupAutoSave() {
        setInterval(() => {
            this.saveAllData();
        }, this.backupInterval);
    }

    async saveAllData() {
        try {
            console.log('💾 Автосохранение данных...');
           
            const data = {
                userStats: Array.from(userStats.entries()),
                globalStats: globalStats,
                timestamp: new Date().toISOString(),
                version: 'basic_1.0'
            };

            // Локальное сохранение
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
           
            // Сохранение в Яндекс.Диск
            if (yandexDisk) {
                try {
                    await yandexDisk.uploadFile(this.dataFile, 'basic_stats_backup.json');
                    console.log('✅ Данные сохранены в Яндекс.Диск');
                } catch (driveError) {
                    console.log('⚠️ Ошибка сохранения в Яндекс.Диск:', driveError.message);
                }
            }
           
            console.log('💾 Все данные сохранены локально');
        } catch (error) {
            console.log('❌ Ошибка сохранения данных:', error.message);
        }
    }

    async loadAllData() {
        try {
            console.log('🔄 Восстановление данных...');
           
            let data = null;
           
            // Пробуем загрузить из Яндекс.Диска
            if (yandexDisk) {
                try {
                    if (await yandexDisk.fileExists('basic_stats_backup.json')) {
                        await yandexDisk.downloadFile('basic_stats_backup.json', this.dataFile);
                        console.log('✅ Данные загружены из Яндекс.Диска');
                    }
                } catch (driveError) {
                    console.log('⚠️ Не удалось загрузить из Яндекс.Диска:', driveError.message);
                }
            }
           
            // Загружаем из локального файла
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                data = JSON.parse(fileContent);
                console.log('✅ Локальные данные загружены');
            } else {
                console.log('📝 Локальные данные не найдены, начинаем с чистого листа');
                return;
            }
           
            // Восстанавливаем статистику пользователей
            if (data.userStats) {
                userStats.clear();
                data.userStats.forEach(([userId, userData]) => {
                    userStats.set(userId, {
                        ...userData,
                        firstSeen: new Date(userData.firstSeen),
                        lastSeen: new Date(userData.lastSeen),
                        lastAnalysis: userData.lastAnalysis ? new Date(userData.lastAnalysis) : null
                    });
                });
            }
           
            // Восстанавливаем глобальную статистику
            if (data.globalStats) {
                Object.assign(globalStats, data.globalStats);
                if (data.globalStats.lastAnalysis) {
                    globalStats.lastAnalysis = new Date(data.globalStats.lastAnalysis);
                }
            }
           
            console.log('🎯 Данные полностью восстановлены');
           
        } catch (error) {
            console.log('❌ Ошибка восстановления данных:', error.message);
            console.log('💫 Начинаем со свежих данных');
        }
    }
}

// =============================================================================
// 🚀 ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ
// =============================================================================

const dataPersistence = new DataPersistence();

// =============================================================================
// 🎨 ВИЗУАЛИЗАЦИЯ АНАЛИЗА
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
// 🦴 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИИ ДЕТАЛЕЙ
// =============================================================================

async function createTopologyVisualization(imageUrl, predictions, userData) {
    try {
        console.log('🕵️‍♂️ Создаю карту топологии деталей...');
       
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(image, 0, 0);

        // ФИЛЬТРУЕМ: ТОЛЬКО ДЕТАЛИ ПРОТЕКТОРА
        const details = predictions.filter(pred =>
            pred.class === 'shoe-protector'
        );

        console.log(`🕵️‍♂️ Найдено ${details.length} морфологических признаков`);
      
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

        console.log(`🕵️‍♂️ Вычислено ${centers.length} точек анализа`);

        // 1. РИСУЕМ СВЯЗИ МЕЖДУ ЦЕНТРАМИ
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
        ctx.lineWidth = 2;
       
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

        // 2. РИСУЕМ ТОЧКИ ЦЕНТРОВ
        centers.forEach(center => {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
            ctx.fill();

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
            ctx.setLineDash([10, 5]);
           
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
        ctx.strokeText(`🕵️‍♂️ Карта топологии деталей`, 20, 40);
        ctx.fillText(`🕵️‍♂️ Карта топологии деталей`, 20, 40);
       
        ctx.font = '20px Arial';
        ctx.strokeText(`Детали: ${details.length}`, 20, 70);
        ctx.fillText(`Детали: ${details.length}`, 20, 70);       
        ctx.strokeText(`Точки анализа: ${centers.length}`, 20, 95);
        ctx.fillText(`Точки анализа: ${centers.length}`, 20, 95);

        // Сохраняем
        const tempPath = `topology_${Date.now()}.png`;
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(tempPath, buffer);

        console.log('✅ Топологическая визуализация создана успешно!');
        return tempPath;

    } catch (error) {
        console.error('❌ Ошибка создания топологической визуализации:', error);
        return null;
    }
}

// =============================================================================
// 🔧 УМНАЯ ПОСТОБРАБОТКА
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
// 📊 ИЗВЛЕЧЕНИЕ ФИЧЕЙ
// =============================================================================

function extractFeatures(predictions) {
    console.log(`📊 Извлекаем features из ${predictions.length} предсказаний`);
   
    const features = {
        detailCount: predictions.length,
        hasOutline: false,
        largeDetails: 0,
        density: 1,
        spatialSpread: 0
    };

    if (!predictions || predictions.length === 0) {
        return features;
    }

    let totalArea = 0;
    const centers = [];

    predictions.forEach(pred => {
        if (pred.class && pred.class.includes('Outline')) {
            features.hasOutline = true;
        }

        if (pred.points && pred.points.length > 3) {
            const bbox = calculateBoundingBox(pred.points);
            const area = bbox.width * bbox.height;
            totalArea += area;
           
            if (area > 1000) {
                features.largeDetails++;
            }

            centers.push({
                x: bbox.x + bbox.width / 2,
                y: bbox.y + bbox.height / 2
            });
        }
    });

    if (centers.length > 0 && totalArea > 0) {
        features.density = centers.length / (totalArea / 1000);
    }

    console.log('📊 Features:', features);
    return features;
}

// =============================================================================
// 👤 СИСТЕМА СТАТИСТИКИ ПОЛЬЗОВАТЕЛЕЙ
// =============================================================================

function updateUserStats(userId, username, action = 'photo') {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            username: username || `user_${userId}`,
            photosCount: 0,
            analysesCount: 0,
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

        if (yandexDisk) {
            setTimeout(async () => {
                try {
                    const tempStatsPath = 'basic_stats_temp.json';
                    fs.writeFileSync(tempStatsPath, JSON.stringify(statsData, null, 2));

                    await yandexDisk.uploadFile(tempStatsPath, 'basic_stats.json');
                    console.log('✅ Статистика сохранена в Яндекс.Диск');

                    try {
                        if (fs.existsSync(tempStatsPath)) {
                            fs.unlinkSync(tempStatsPath);
                        }
                    } catch (unlinkError) {}
                } catch (driveError) {
                    console.log('⚠️ Ошибка сохранения в Яндекс.Диск:', driveError.message);
                }
            }, 1000);
        }
    } catch (error) {
        console.log('❌ Ошибка сохранения статистики:', error.message);
    }
}

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
            <head><title>Базовый анализатор следов обуви</title></head>
            <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                    <h1 style="text-align: center; margin-bottom: 30px;">🤖 Базовый анализатор следов обуви</h1>
                    <div style="text-align: center; margin-bottom: 30px;">
                        <p style="font-size: 18px; margin-bottom: 20px;">Базовая версия работает! Используйте Telegram:</p>
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
// 📱 ОСНОВНЫЕ КОМАНДЫ БОТА
// =============================================================================

bot.onText(/\/start/, async (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);
   
    await bot.sendMessage(msg.chat.id,
        `👟 **БАЗОВЫЙ АНАЛИЗАТОР СЛЕДОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} отпечатков\n\n` +
        `🔍 **ФУНКЦИОНАЛ:**\n` +
        `• **Базовый анализ** - отправьте фото отпечатка\n` +
        `• **Визуализация деталей** - автоматически\n` +
        `• **Топология протектора** - карта связей\n\n` +
        `📸 **Как использовать:**\n` +
        `Просто отправьте фото следа обуви\n\n` +
        `💡 **Рекомендации по съемке:**\n` +
        `• Снимайте под прямым углом\n` +
        `• Хорошее освещение без теней\n` +
        `• Четкий фокус на деталях\n\n` +
        `📊 **Команды:**\n` +
        `• /statistics - статистика системы\n` +
        `• /help - помощь\n\n` +
        `⚠️ *Базовая версия - только анализ и визуализация*`
    );
});

bot.onText(/\/statistics/, async (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;
   
    const stats = `📊 **СТАТИСТИКА СИСТЕМЫ:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `📅 Последний анализ: ${globalStats.lastAnalysis ?
                     globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;
   
    await bot.sendMessage(msg.chat.id, stats);
});

bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ ПО БАЗОВОЙ ВЕРСИИ**\n\n` +
        `🔍 **ВОЗМОЖНОСТИ:**\n` +
        `• Анализ следов через Roboflow API\n` +
        `• Визуализация контуров и деталей\n` +
        `• Топологический анализ протектора\n` +
        `• Сохранение статистики в облако\n\n` +
        `📸 **КАК ИСПОЛЬЗОВАТЬ:**\n` +
        `Просто отправьте фото следа обуви\n\n` +
        `💡 **СОВЕТЫ ПО СЪЕМКЕ:**\n` +
        `• Прямой угол к отпечатку\n` +
        `• Хорошее освещение\n` +
        `• Четкий фокус на деталях\n` +
        `• Контрастный фон\n\n` +
        `📊 **КОМАНДЫ:**\n` +
        `• /start - начало работы\n` +
        `• /statistics - статистика\n` +
        `• /help - эта справка\n\n` +
        `🔄 **Автосохранение:** каждые 5 минут`
    );
});

// =============================================================================
// 📸 ОБРАБОТКА ФОТО
// =============================================================================

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
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

        // 📤 ЗАГРУЗКА ФОТО НА ЯНДЕКС.ДИСК
        if (yandexDisk) {
            try {
                const timestamp = Date.now();
                const photoId = `user_${msg.from.id}_${timestamp}`;
               
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
               
                await yandexDisk.uploadFile(tempPhotoPath, `${photoId}.jpg`);
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
           
            let caption = `✅ Анализ завершен!\n🎯 Выявлено морфологических признаков: ${finalPredictions.length}`;
           
            if (vizPath) {
                await bot.sendPhoto(chatId, vizPath, { caption: caption });
                fs.unlinkSync(vizPath);
               
                // Топологическая визуализация
                console.log('🔍 Создаю топологическую визуализацию...');
                try {
                    const topologyPath = await createTopologyVisualization(fileUrl, finalPredictions, userData);
                    if (topologyPath) {
                        console.log('✅ Карта топологии создана, отправляю...');
                        await bot.sendPhoto(chatId, topologyPath, {
                            caption: `🕵️‍♂️ Карта топологии деталей протектора\n🔗 Связи между ${finalPredictions.filter(p => p.class === 'shoe-protector').length} деталями`
                        });
                        fs.unlinkSync(topologyPath);
                    }
                } catch (error) {
                    console.error('💥 Ошибка при создании топологической визуализации:', error);
                }
            } else {
                await bot.sendMessage(chatId, caption);
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

// Загрузка статистики из Яндекс.Диска
async function loadStatsFromYandex() {
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
           
            console.log('✅ Статистика загружена из Яндекс.Диска');
            console.log(`   👥 Пользователей: ${globalStats.totalUsers}`);
            console.log(`   📸 Фото: ${globalStats.totalPhotos}`);
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
   
    // Загружаем статистику и данные
    await loadStatsFromYandex();
    await dataPersistence.loadAllData();
   
    console.log('🤖 Базовая версия бота полностью готова к работе!');
    console.log(`📊 Текущая статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото`);
});

// Обработчики ошибок
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
    process.exit(1);
});

// Грациозное завершение
async function gracefulShutdown() {
    console.log('🔄 Грациозное завершение работы...');
   
    try {
        await dataPersistence.saveAllData();
        console.log('✅ Все данные сохранены');
    } catch (error) {
        console.error('❌ Ошибка при завершении:', error);
    }
   
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

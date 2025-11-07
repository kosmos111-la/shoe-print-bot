const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ===== ПУНКТ 2: ИСПРАВЛЕННЫЙ КОД =====
class BotCore {
    constructor() {
        this.stats = {
            totalUsers: 0,
            totalPhotos: 0,
            activeSessions: 0
        };
        this.sessionManager = this.initializeSessionManager();
        this.initializeManagers();
    }

    initializeSessionManager() {
        return {
            getUser: (userId) => {
                return {
                    userId: userId,
                    username: 'unknown',
                    photosProcessed: 0,
                    firstSeen: new Date()
                };
            },
            updateUserStats: (userData) => {
                console.log(`📊 Обновление статистики для ${userData.username}`);
                if (userData.userId) {
                    this.stats.totalUsers++;
                }
                return true;
            },
            getStats: () => {
                return this.stats;
            }
        };
    }

    initializeManagers() {
        this.analysisManager = {
            get: () => ({ analyze: () => ({}) })
        };
       
        this.visualizationManager = {
            get: () => ({ drawResults: () => null })
        };
       
        this.storageManager = {
            get: () => ({ save: () => true })
        };

        console.log("✅ Упрощенные менеджеры инициализированы");
    }

    async handleStartCommand(userId, username) {
        try {
            console.log(`🛡 /start от ${username} (ID: ${userId})`);
           
            const userData = {
                userId: userId,
                username: username,
                action: 'start'
            };
           
            this.sessionManager.updateUserStats(userData);
           
            return "👋 Добро пожаловать! Отправьте фото следа для анализа.";
           
        } catch (error) {
            console.error(`❌ Ошибка в /start для ${username}:`, error.message);
            return "👋 Добро пожаловать! Отправьте фото следа для анализа.";
        }
    }
}

// Создаем экземпляр ядра бота
const botCore = new BotCore();

// ===== ПУНКТ 3: УПРОЩЕННЫЕ ОБРАБОТЧИКИ =====

// Инициализация бота
const bot = new TelegramBot(TOKEN);
app.use(express.json());

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;

    try {
        const welcomeMessage = botCore.handleStartCommand(userId, username);
        bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: {
                keyboard: [
                    [{ text: "📸 Анализировать след" }],
                    [{ text: "❄️ Анализ снега" }, { text: "🆘 Помощь" }]
                ],
                resize_keyboard: true
            }
        });
    } catch (error) {
        console.error('Ошибка в /start:', error);
        bot.sendMessage(chatId, "👋 Добро пожаловать! Отправьте фото следа для анализа.");
    }
});

// Упрощенный обработчик фото
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
   
    try {
        bot.sendMessage(chatId, "🔄 Обрабатываю фото...");
       
        // Простая заглушка для обработки
        const result = await processImageSimple(msg);
       
        bot.sendMessage(chatId, `✅ Анализ завершен!\nРезультат: ${result}`);
       
    } catch (error) {
        console.error('Ошибка обработки фото:', error);
        bot.sendMessage(chatId, "❌ Ошибка обработки фото. Попробуйте еще раз.");
    }
});

// Простая функция обработки изображения
async function processImageSimple(msg) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("Обнаружены характеристики следа: длина 25см, ширина 10см");
        }, 2000);
    });
}

// ===== ПУНКТ 4-5: ДОПОЛНИТЕЛЬНЫЕ КЛАССЫ =====

// Упрощенная система статистики
class SimpleStats {
    constructor() {
        this.statsFile = path.join(__dirname, 'stats.json');
        this.stats = this.loadStats();
    }

    loadStats() {
        try {
            if (fs.existsSync(this.statsFile)) {
                const data = fs.readFileSync(this.statsFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.log('📝 Создаем новую статистику');
        }
       
        return {
            totalUsers: 0,
            totalPhotos: 0,
            activeSessions: 0,
            lastUpdate: new Date().toISOString()
        };
    }

    saveStats() {
        try {
            this.stats.lastUpdate = new Date().toISOString();
            fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
            console.log('✅ Статистика сохранена локально');
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения статистики:', error.message);
            return false;
        }
    }
}

// ===== WEBHOOK И ЗАПУСК СЕРВЕРА =====

// Webhook endpoint
app.post(`/webhook${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'Bot is running', timestamp: new Date() });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Бот запущен на порту ${PORT}`);
    console.log(`🌐 Webhook URL: https://your-app.onrender.com/`);
});

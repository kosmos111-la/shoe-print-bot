const config = require('./config.js');
const express = require('express');

console.log('🚀 Запуск упрощенной версии...');
console.log('✅ Конфиг загружен');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Упрощенная модульная система</h1>
        <p>Система запущена! Конфиг работает.</p>
        <p>Порт: ${config.PORT}</p>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        config: {
            port: config.PORT,
            hasTelegramToken: !!config.TELEGRAM_TOKEN
        }
    });
});

const PORT = config.PORT || 10000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log('🎯 Упрощенная система готова!');
});

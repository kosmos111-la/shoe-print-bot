const express = require('express');

// ВСТРОЕННЫЙ CONFIG
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI',
    PORT: process.env.PORT || 10000,
    YANDEX_DISK_TOKEN: process.env.YANDEX_DISK_TOKEN,
   
    ROBOFLOW: {
        API_URL: 'https://detect.roboflow.com/-zqyih/13',
        API_KEY: 'NeHOB854EyHkDbGGLE6G',
        CONFIDENCE: 25,
        OVERLAP: 30
    }
};

console.log('🚀 Запуск системы со встроенным config...');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Система РАБОТАЕТ!</h1>
        <p>Config загружен вручную</p>
        <p>Порт: ${config.PORT}</p>
    `);
});

app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
});

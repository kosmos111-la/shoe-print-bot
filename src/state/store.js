// src/state/store.js
// 🗃️ ЦЕНТРАЛИЗОВАННОЕ СОСТОЯНИЕ БОТА (вынесено из main.js)
// Map'ы и счётчики, которые раньше были глобальными переменными в main.js

// 📊 Статистика пользователей: userId -> {username, photosCount, analysesCount, ...}
const userStats = new Map();

// 📈 Глобальная статистика бота
const globalStats = {
    totalUsers: 0,
    totalPhotos: 0,
    totalAnalyses: 0,
    lastAnalysis: null
};

// 💾 Кэш последних анализов: userId -> последний analysis
const userLastAnalysis = new Map();

// 📸 Очередь фото по пользователям
// photoBatchDetector: userId -> {photos: [], timer: null}
const photoBatchDetector = new Map();
// photoQueue: userId -> array of photos
const photoQueue = new Map();
// processingUsers: Set of userIds currently being processed
const processingUsers = new Set();

module.exports = {
    userStats,
    globalStats,
    userLastAnalysis,
    photoBatchDetector,
    photoQueue,
    processingUsers
};

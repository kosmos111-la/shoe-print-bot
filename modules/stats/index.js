module.exports = {
    async initialize() {
        console.log('✅ Модуль статистики инициализирован');
        return {
            updateUserStats: () => {},
            getGlobalStats: () => ({ totalUsers: 0, totalPhotos: 0 })
        };
    }
};

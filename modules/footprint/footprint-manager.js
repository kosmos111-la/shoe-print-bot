// modules/footprint/footprint-manager.js
// Главный менеджер, который будет интегрирован в main.js
const FootprintDatabase = require('./footprint-database');

class FootprintManager {
    constructor() {
        this.db = new FootprintDatabase();
        this.initialized = false;
        console.log('👣 FootprintManager создан');
    }

    async initialize() {
        if (this.initialized) return true;
       
        try {
            await this.db.initialize();
            this.initialized = true;
            console.log('✅ FootprintManager инициализирован');
            return true;
        } catch (error) {
            console.log('❌ Ошибка инициализации FootprintManager:', error.message);
            return false;
        }
    }

    // СОХРАНИТЬ СЕССИЮ КАК МОДЕЛЬ
    async saveSessionAsModel(session, modelName = null, userId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!session || !session.analysisResults || session.analysisResults.length === 0) {
            throw new Error('Сессия пуста или не содержит анализов');
        }

        const DigitalFootprint = require('./digital-footprint');
        const footprint = new DigitalFootprint({
            name: modelName || `Сессия_${session.id.slice(0, 8)}`,
            userId: userId || session.userId,
            sessionId: session.id,
            metadata: {
                estimatedSize: this.estimateSizeFromSession(session),
                footprintType: this.determineFootprintType(session),
                orientation: this.calculateAverageOrientation(session),
                photosCount: session.photos.length
            }
        });

        console.log(`🔄 Создаю модель из ${session.analysisResults.length} анализов...`);

        // Агрегируем все анализы сессии
session.analysisResults.forEach((analysis, index) => {
    // Находим соответствующее фото из сессии
    const photo = session.photos[index];
   
    // 🆕 ВАЖНО: Передаем ВСЕ возможные пути к фото
    const sourceInfo = {
        sessionId: session.id,
        analysisIndex: index,
        photoId: photo?.fileId,
        timestamp: analysis.timestamp || new Date(),
        // Пути к фото из сессии
        imagePath: photo?.localPath,
        photoPath: photo?.fileUrl,
        localPath: photo?.localPath,
        // Информация о качестве фото если есть
        photoQuality: photo?.quality || 0.5
    };
   
    // Добавляем анализ с путями к фото
    const added = footprint.addAnalysis(analysis, sourceInfo);
   
    console.log(`   Анализ ${index + 1}: добавлено ${added.added} узлов, фото: ${photo?.localPath || 'нет'}`);
});
```

Вот как должно выглядеть в контексте (примерно строки 40-60):

```javascript
// Агрегируем все анализы сессии
session.analysisResults.forEach((analysis, index) => {
    // Находим соответствующее фото из сессии
    const photo = session.photos[index];
   
    // 🆕 ВАЖНО: Передаем ВСЕ возможные пути к фото
    const sourceInfo = {
        sessionId: session.id,
        analysisIndex: index,
        photoId: photo?.fileId,
        timestamp: analysis.timestamp || new Date(),
        // Пути к фото из сессии
        imagePath: photo?.localPath,
        photoPath: photo?.fileUrl,
        localPath: photo?.localPath,
        // Информация о качестве фото если есть
        photoQuality: photo?.quality || 0.5
    };
   
    // Добавляем анализ с путями к фото
    const added = footprint.addAnalysis(analysis, sourceInfo);
   
    console.log(`   Анализ ${index + 1}: добавлено ${added.added} узлов, фото: ${photo?.localPath || 'нет'}`);
});

        // Сохраняем в базу
        const saved = await this.db.save(footprint);

        // Ищем похожие модели
        const similar = await this.db.findSimilar(
            session.analysisResults[0], // Используем первый анализ для поиска
            { userId, threshold: 0.7, limit: 3 }
        );

        return {
            footprint: saved,
            similar: similar.filter(s => s.footprint.id !== saved.id),
            stats: {
                nodes: saved.nodes.size,
                edges: saved.edges.length,
                confidence: saved.stats.confidence,
                sources: saved.stats.totalSources
            }
        };
    }

    // ПОИСК ПОХОЖИХ ДЛЯ АНАЛИЗА
    async findSimilarForAnalysis(analysis, userId = null, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        return await this.db.findSimilar(analysis, {
            userId,
            threshold: options.threshold || 0.6,
            limit: options.limit || 5,
            quickFirst: true
        });
    }

    // ПОЛУЧИТЬ МОДЕЛИ ПОЛЬЗОВАТЕЛЯ
    async getUserModels(userId) {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.db.getByUser(userId);
    }

    // УДАЛИТЬ МОДЕЛЬ
    async deleteModel(modelId, userId) {
        if (!this.initialized) {
            await this.initialize();
        }

        return await this.db.delete(modelId, userId);
    }

    // СТАТИСТИКА
    async getStats() {
        if (!this.initialized) {
            await this.initialize();
        }

        return this.db.getStats();
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    estimateSizeFromSession(session) {
        if (!session.analysisResults || session.analysisResults.length === 0) {
            return null;
        }

        // Берем размер из первого анализа с интеллектуальным анализом
        const firstWithIntel = session.analysisResults.find(a => a.intelligentAnalysis);
        if (firstWithIntel?.intelligentAnalysis?.summary?.sizeEstimation) {
            return firstWithIntel.intelligentAnalysis.summary.sizeEstimation;
        }

        return null;
    }

    determineFootprintType(session) {
        if (!session.analysisResults || session.analysisResults.length === 0) {
            return 'unknown';
        }

        // Анализируем типы следов в сессии
        const types = session.analysisResults
            .map(a => a.intelligentAnalysis?.summary?.footprintType)
            .filter(Boolean);

        if (types.length === 0) return 'unknown';

        // Находим самый частый тип
        const frequency = {};
        types.forEach(type => {
            frequency[type] = (frequency[type] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    calculateAverageOrientation(session) {
        if (!session.analysisResults || session.analysisResults.length === 0) {
            return 0;
        }

        const orientations = session.analysisResults
            .map(a => {
                const orient = a.intelligentAnalysis?.summary?.orientation;
                if (!orient) return null;
               
                const match = orient.match(/(\d+)/);
                return match ? parseInt(match[1]) : null;
            })
            .filter(Boolean);

        if (orientations.length === 0) return 0;

        // Усреднение углов (учитываем циклическую природу)
        const sinSum = orientations.reduce((sum, angle) => sum + Math.sin(angle * Math.PI / 180), 0);
        const cosSum = orientations.reduce((sum, angle) => sum + Math.cos(angle * Math.PI / 180), 0);
       
        return Math.round(Math.atan2(sinSum, cosSum) * 180 / Math.PI);
    }

    // СОЗДАТЬ FOOTPRINT ИЗ ОДНОГО АНАЛИЗА (для поиска)
    createFootprintFromAnalysis(analysis, userId = null) {
        const DigitalFootprint = require('./digital-footprint');
        const footprint = new DigitalFootprint({
            name: 'Временная модель для поиска',
            userId
        });

        footprint.addAnalysis(analysis, {
            type: 'search',
            timestamp: new Date()
        });

        return footprint;
    }
}

// Экспортируем синглтон
module.exports = new FootprintManager();

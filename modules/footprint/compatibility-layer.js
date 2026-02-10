// modules/footprint/compatibility-layer.js
// 🔥 СЛОЙ СОВМЕСТИМОСТИ ДЛЯ СТАРОГО КОДА

class CompatibilityLayer {
    constructor(footprintManager) {
        this.manager = footprintManager;
        console.log('🔌 Слой совместимости создан');
    }
   
    // 🔥 СТАРЫЕ МЕТОДЫ ДЛЯ main.js
    getActiveSession(userId) {
        return this.manager.getActiveSession(userId);
    }
   
    createNewSession(userId, sessionName = null) {
        return this.manager.createNewSession(userId, sessionName);
    }
   
    getSessionInfo(userId) {
        return this.manager.getSessionInfo(userId);
    }
   
    async addAnalysisToSession(userId, analysis, photoInfo = {}) {
        return await this.manager.addAnalysisToSession(userId, analysis, photoInfo);
    }
   
    async getVisualizationForSession(userId, options = {}) {
        return await this.manager.getVisualizationForSession(userId, options);
    }
   
    getSessionStats(userId) {
        return this.manager.getSessionStats(userId);
    }
   
    clearSession(userId) {
        return this.manager.clearSession(userId);
    }
   
    // 🔥 ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ДЛЯ УДОБСТВА
    async processPhoto(userId, analysis, photoInfo = {}) {
        console.log(`📸 [Compatibility] Обработка фото для ${userId}`);
       
        // 1. Добавляем анализ
        const addResult = await this.addAnalysisToSession(userId, analysis, photoInfo);
       
        if (!addResult.success) {
            return addResult;
        }
       
        // 2. Получаем визуализацию
        let visualization = null;
        if (addResult.visualizationPath) {
            visualization = {
                path: addResult.visualizationPath,
                type: 'topological'
            };
        } else {
            // Если нет пути, создаем новую визуализацию
            const vizResult = await this.getVisualizationForSession(userId, {
                filename: `photo_${Date.now()}.png`
            });
           
            if (vizResult.success) {
                visualization = {
                    path: vizResult.path,
                    type: 'topological',
                    stats: vizResult.stats
                };
            }
        }
       
        // 3. Формируем результат
        return {
            success: true,
            sessionId: addResult.sessionId,
            footprintId: addResult.footprintId,
            nodesAdded: addResult.nodesAdded,
            totalNodes: addResult.totalNodes,
            similarity: addResult.similarity,
            decision: addResult.decision,
            visualization: visualization,
            message: this.getDecisionMessage(addResult.decision, addResult.similarity)
        };
    }
   
    getDecisionMessage(decision, similarity) {
        const percent = (similarity * 100).toFixed(1);
       
        switch(decision) {
            case 'same_footprint':
            case 'same_footprint_enhanced':
                return `✅ ОДНА ОБУВЬ! Сходство: ${percent}%`;
            case 'new_footprint':
                return `🆕 НОВАЯ ОБУВЬ! Создана модель`;
            case 'different_footprint':
                return `❌ РАЗНАЯ ОБУВЬ! Сходство: ${percent}%`;
            default:
                return `🔍 Анализ завершен. Сходство: ${percent}%`;
        }
    }
   
    // 🔥 МЕТОД ДЛЯ ПОЛУЧЕНИЯ ИНФОРМАЦИИ О ВСЕХ СЕССИЯХ
    getAllSessionsInfo() {
        const sessions = [];
       
        // Сессии из sessionManager
        for (const [userId, session] of this.manager.sessionManager.sessions) {
            sessions.push({
                userId,
                sessionId: session.id,
                name: session.name,
                photosCount: session.photos?.length || 0,
                footprintNodes: session.currentFootprint?.graph?.nodes?.size || 0,
                lastActivity: session.lastActivity
            });
        }
       
        return {
            totalSessions: sessions.length,
            sessions: sessions
        };
    }
   
    // 🔥 МЕТОД ДЛЯ ТЕСТИРОВАНИЯ СОВМЕСТИМОСТИ
    testCompatibility() {
        console.log('🧪 Тестирование совместимости...');
       
        const methods = [
            'getActiveSession',
            'createNewSession',
            'getSessionInfo',
            'addAnalysisToSession',
            'getVisualizationForSession',
            'getSessionStats',
            'clearSession'
        ];
       
        const results = [];
       
        methods.forEach(method => {
            const exists = typeof this[method] === 'function';
            results.push({
                method,
                exists,
                status: exists ? '✅' : '❌'
            });
        });
       
        console.log('📊 Результаты теста совместимости:');
        results.forEach(r => {
            console.log(`   ${r.status} ${r.method}`);
        });
       
        return {
            success: results.every(r => r.exists),
            results: results
        };
    }
}

module.exports = CompatibilityLayer;

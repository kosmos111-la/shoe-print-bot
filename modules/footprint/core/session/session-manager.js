// modules/footprint/core/session/session-manager.js
// 🔥 МЕНЕДЖЕР СЕССИЙ

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SessionManager {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
    }

    // 🔥 СОЗДАНИЕ СЕССИИ
    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: String(userId),
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            currentFootprint: null,
            metadata: {
                created: new Date(),
                normalizationHistory: [],
                lastTransformation: null
            }
        };

        this.manager.userSessions.set(userId, session);
        this.manager.systemStats.totalUsers = this.manager.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)} для пользователя ${userId}`);

        return session;
    }

    // 🔥 ПОЛУЧЕНИЕ АКТИВНОЙ СЕССИИ
    getActiveSession(userId) {
        return this.manager.userSessions.get(userId);
    }

    // 🔥 СОХРАНЕНИЕ СЕССИИ КАК МОДЕЛИ
    saveSessionAsModel(userId, modelName = null) {
        const session = this.manager.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        if (modelName) {
            footprint.name = modelName;
        }

        const modelPath = path.join(this.config.dbPath, 'models', `${footprint.id}.json`);

        try {
            const modelData = footprint.toJSON();
            modelData.metadata.sessionInfo = {
                sessionId: session.id,
                photosCount: session.photos.length,
                normalizationHistory: session.metadata.normalizationHistory || []
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

            this.manager.loadedModels.set(footprint.id, footprint);
            this.manager.systemStats.totalModels = this.manager.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            this.manager.userSessions.delete(userId);

            return {
                success: true,
                modelId: footprint.id,
                modelName: footprint.name,
                modelPath: modelPath,
                modelStats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 🔥 ПОЛУЧЕНИЕ ИНФОРМАЦИИ О СЕССИИ
    getSessionInfo(userId) {
        const session = this.manager.userSessions.get(userId);
        if (!session) {
            return {
                exists: false,
                message: 'Сессия не найдена'
            };
        }

        return {
            exists: true,
            sessionId: session.id,
            userId: session.userId,
            name: session.name,
            startTime: session.startTime,
            lastActivity: session.lastActivity,
            photosCount: session.photos.length,
            hasFootprint: !!session.currentFootprint,
            footprintNodes: session.currentFootprint?.graph?.nodes?.size || 0,
            normalizationHistory: session.metadata.normalizationHistory?.length || 0
        };
    }

    // 🔥 ОЧИСТКА СТАРЫХ СЕССИЙ
    cleanupOldSessions(maxAgeHours = 24) {
        const now = new Date();
        let cleanedCount = 0;

        for (const [userId, session] of this.manager.userSessions.entries()) {
            const hoursDiff = (now - session.lastActivity) / (1000 * 60 * 60);
           
            if (hoursDiff > maxAgeHours) {
                this.manager.userSessions.delete(userId);
               
                // Также очищаем связанные супер-модели
                if (this.manager.vectorSuperModels.has(userId)) {
                    this.manager.vectorSuperModels.delete(userId);
                }
               
                cleanedCount++;
                console.log(`🧹 Очищена старая сессия: ${session.id.slice(0, 8)} (${hoursDiff.toFixed(1)} часов)`);
            }
        }

        return {
            cleanedCount,
            remainingSessions: this.manager.userSessions.size
        };
    }

    // 🔥 ПОЛУЧЕНИЕ ВСЕХ СЕССИЙ (для админки)
    getAllSessions() {
        const sessions = [];
       
        for (const [userId, session] of this.manager.userSessions.entries()) {
            sessions.push({
                userId,
                sessionId: session.id,
                name: session.name,
                startTime: session.startTime,
                lastActivity: session.lastActivity,
                photosCount: session.photos.length,
                hasFootprint: !!session.currentFootprint
            });
        }
       
        return sessions;
    }

    // 🔥 ПРОВЕРКА СУЩЕСТВОВАНИЯ СЕССИИ
    hasSession(userId) {
        return this.manager.userSessions.has(userId);
    }

    // 🔥 ОБНОВЛЕНИЕ ВРЕМЕНИ АКТИВНОСТИ
    updateLastActivity(userId) {
        const session = this.manager.userSessions.get(userId);
        if (session) {
            session.lastActivity = new Date();
            return true;
        }
        return false;
    }
}

module.exports = SessionManager;

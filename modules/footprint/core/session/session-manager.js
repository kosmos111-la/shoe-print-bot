// modules/footprint/core/session/session-manager.js
// 🔥 ИСПРАВЛЕНИЕ: Правильные пути импорта

class SessionManager {
    constructor(manager) {
        this.manager = manager;
        this.sessions = new Map();
        this.sessionTimeouts = new Map();

        // 🔥 КОНТРОЛЬ ДУБЛИРОВАНИЯ
        this.userActiveSession = new Map(); // userId -> sessionId
        this.maxSessionsPerUser = 3;

        console.log('🔄 SessionManager создан с контролем дублирования сессий');
    }

    createSession(userId, name = null) {
        console.log(`🔄 Создаю сессию для пользователя ${userId}...`);

        // 🔥 ПРОВЕРЯЕМ, ЕСТЬ ЛИ УЖЕ АКТИВНАЯ СЕССИЯ
        const existingSessionId = this.userActiveSession.get(userId);
        if (existingSessionId && this.sessions.has(existingSessionId)) {
            console.log(`📌 У пользователя ${userId} уже есть активная сессия: ${existingSessionId}`);

            // Возвращаем существующую сессию
            const existingSession = this.sessions.get(existingSessionId);
            existingSession.lastActivity = new Date();

            // Обновляем таймаут
            this.resetSessionTimeout(userId, existingSessionId);

            return existingSession;
        }

        // 🔥 ОЧИЩАЕМ СТАРЫЕ СЕССИИ (если их слишком много)
        this.cleanupOldSessionsForUser(userId);

        // Создаем новую сессию
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const sessionName = name || `Сессия_${new Date().toLocaleTimeString('ru-RU')}`;

        const session = {
            id: sessionId,
            userId: userId,
            name: sessionName,
            createdAt: new Date(),
            lastActivity: new Date(),
            currentFootprint: null,
            photos: [],
            metadata: {
                normalizationHistory: [],
                lastTransformation: null
            }
        };

        // Сохраняем сессию
        this.sessions.set(sessionId, session);
        this.userActiveSession.set(userId, sessionId);

        // Устанавливаем таймаут
        this.resetSessionTimeout(userId, sessionId);

        console.log(`✅ Создана сессия: ${sessionId} для пользователя ${userId}`);
        console.log(`   Всего сессий у пользователя: ${this.getUserSessionCount(userId)}`);

        return session;
    }

    // 🔥 НОВЫЙ МЕТОД: Очистить старые сессии пользователя
    cleanupOldSessionsForUser(userId) {
        const userSessions = this.getUserSessions(userId);

        if (userSessions.length >= this.maxSessionsPerUser) {
            console.log(`🧹 Очищаю старые сессии для пользователя ${userId} (есть ${userSessions.length})`);

            // Сортируем по времени последней активности
            userSessions.sort((a, b) => b.lastActivity - a.lastActivity);

            // Оставляем только maxSessionsPerUser-1 самых новых
            const sessionsToRemove = userSessions.slice(this.maxSessionsPerUser - 1);

            sessionsToRemove.forEach(session => {
                console.log(`   Удаляю старую сессию: ${session.id}`);
                this.sessions.delete(session.id);

                // Если это была активная сессия - очищаем
                if (this.userActiveSession.get(userId) === session.id) {
                    this.userActiveSession.delete(userId);
                }
            });
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить все сессии пользователя
    getUserSessions(userId) {
        const userSessions = [];

        for (const [sessionId, session] of this.sessions) {
            if (session.userId === userId) {
                userSessions.push(session);
            }
        }

        return userSessions;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить количество сессий пользователя
    getUserSessionCount(userId) {
        return this.getUserSessions(userId).length;
    }

    getActiveSession(userId) {
        // 🔥 ИСПОЛЬЗУЕМ КЭШ АКТИВНОЙ СЕССИИ
        const activeSessionId = this.userActiveSession.get(userId);

        if (activeSessionId && this.sessions.has(activeSessionId)) {
            const session = this.sessions.get(activeSessionId);
            session.lastActivity = new Date(); // Обновляем активность
            this.resetSessionTimeout(userId, activeSessionId);
            return session;
        }

        // Если активной нет, ищем любую сессию пользователя
        const userSessions = this.getUserSessions(userId);

        if (userSessions.length > 0) {
            // Берем самую новую
            userSessions.sort((a, b) => b.lastActivity - a.lastActivity);
            const newestSession = userSessions[0];

            // Устанавливаем как активную
            this.userActiveSession.set(userId, newestSession.id);
            newestSession.lastActivity = new Date();
            this.resetSessionTimeout(userId, newestSession.id);

            console.log(`📌 Восстановлена активная сессия для ${userId}: ${newestSession.id}`);

            return newestSession;
        }

        return null; // Нет сессий
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Установить активную сессию
    setActiveSession(userId, sessionId) {
        if (!this.sessions.has(sessionId)) {
            console.log(`❌ Сессия ${sessionId} не существует`);
            return false;
        }

        const session = this.sessions.get(sessionId);
        if (session.userId !== userId) {
            console.log(`❌ Сессия ${sessionId} принадлежит другому пользователю`);
            return false;
        }

        this.userActiveSession.set(userId, sessionId);
        session.lastActivity = new Date();
        this.resetSessionTimeout(userId, sessionId);

        console.log(`✅ Установлена активная сессия для ${userId}: ${sessionId}`);
        return true;
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        Object.assign(session, updates);
        session.lastActivity = new Date();

        // Обновляем таймаут
        this.resetSessionTimeout(session.userId, sessionId);

        return session;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Удалить сессию
    deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        const userId = session.userId;

        // Удаляем из активных, если это активная сессия
        if (this.userActiveSession.get(userId) === sessionId) {
            this.userActiveSession.delete(userId);
        }

        // Очищаем таймаут
        if (this.sessionTimeouts.has(sessionId)) {
            clearTimeout(this.sessionTimeouts.get(sessionId));
            this.sessionTimeouts.delete(sessionId);
        }

        // Удаляем сессию
        this.sessions.delete(sessionId);

        console.log(`🗑️ Удалена сессия: ${sessionId} (пользователь: ${userId})`);
        return true;
    }

    resetSessionTimeout(userId, sessionId) {
        const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 минут

        // Очищаем предыдущий таймаут
        if (this.sessionTimeouts.has(sessionId)) {
            clearTimeout(this.sessionTimeouts.get(sessionId));
        }

        // Устанавливаем новый таймаут
        const timeout = setTimeout(() => {
            console.log(`⏰ Сессия ${sessionId} истекла по таймауту (30 минут)`);

            // Удаляем из активных
            if (this.userActiveSession.get(userId) === sessionId) {
                this.userActiveSession.delete(userId);
            }

            // Удаляем сессию
            this.sessions.delete(sessionId);
            this.sessionTimeouts.delete(sessionId);
        }, SESSION_TIMEOUT_MS);

        this.sessionTimeouts.set(sessionId, timeout);
    }

    // 🔥 НОВЫЙ МЕТОД: Получить статистику сессий
    getSessionStats() {
        const stats = {
            totalSessions: this.sessions.size,
            usersWithSessions: new Set(),
            activeSessions: this.userActiveSession.size,
            sessionsByUser: {}
        };

        // Собираем статистику по пользователям
        for (const [sessionId, session] of this.sessions) {
            const userId = session.userId;
            stats.usersWithSessions.add(userId);

            if (!stats.sessionsByUser[userId]) {
                stats.sessionsByUser[userId] = 0;
            }
            stats.sessionsByUser[userId]++;
        }

        stats.uniqueUsers = stats.usersWithSessions.size;

        return stats;
    }

    // 🔥 НОВЫЙ МЕТОД: Очистить старые сессии
    cleanupOldSessions(maxAgeHours = 24) {
        const now = new Date();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        let deletedCount = 0;

        for (const [sessionId, session] of this.sessions) {
            const sessionAge = now - session.lastActivity;

            if (sessionAge > maxAgeMs) {
                this.deleteSession(sessionId);
                deletedCount++;
            }
        }

        console.log(`🧹 Очищено ${deletedCount} старых сессий (старше ${maxAgeHours} часов)`);
        return deletedCount;
    }

    // 🔥 НОВЫЙ МЕТОД: Переключить активную сессию
    switchActiveSession(userId, sessionId) {
        const session = this.getSession(sessionId);
        if (!session || session.userId !== userId) {
            console.log(`❌ Не могу переключиться на сессию ${sessionId}`);
            return false;
        }

        // Устанавливаем как активную
        this.setActiveSession(userId, sessionId);

        console.log(`🔄 Переключена активная сессия для ${userId}: ${sessionId}`);
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить список сессий пользователя
    listUserSessions(userId) {
        const userSessions = this.getUserSessions(userId);
        const activeSessionId = this.userActiveSession.get(userId);

        return userSessions.map(session => ({
            id: session.id,
            name: session.name,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            isActive: session.id === activeSessionId,
            photoCount: session.photos ? session.photos.length : 0,
            hasFootprint: !!session.currentFootprint
        }));
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить здоровье сессий
    checkSessionHealth() {
        const stats = this.getSessionStats();
        const issues = [];

        // Проверка на слишком много сессий у одного пользователя
        Object.entries(stats.sessionsByUser).forEach(([userId, count]) => {
            if (count > this.maxSessionsPerUser) {
                issues.push(`Пользователь ${userId}: ${count} сессий (макс: ${this.maxSessionsPerUser})`);
            }
        });

        // Проверка старых сессий
        const now = new Date();
        for (const [sessionId, session] of this.sessions) {
            const ageHours = (now - session.lastActivity) / (60 * 60 * 1000);
            if (ageHours > 24) {
                issues.push(`Сессия ${sessionId}: неактивна ${ageHours.toFixed(1)} часов`);
            }
        }

        return {
            healthy: issues.length === 0,
            stats: stats,
            issues: issues
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Получить информацию о сессии
    getSessionInfo(userId) {
        const session = this.getActiveSession(userId);
        if (!session) {
            return { exists: false, message: 'Нет активной сессии' };
        }

        return {
            exists: true,
            sessionId: session.id,
            sessionName: session.name,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            photoCount: session.photos ? session.photos.length : 0,
            hasFootprint: !!session.currentFootprint,
            footprintInfo: session.currentFootprint ? {
                id: session.currentFootprint.id,
                name: session.currentFootprint.name,
                nodeCount: session.currentFootprint.graph ? session.currentFootprint.graph.nodes.size : 0
            } : null,
            normalizationHistory: session.metadata.normalizationHistory ?
                session.metadata.normalizationHistory.length : 0
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить наличие сессии
    hasSession(userId) {
        return this.getActiveSession(userId) !== null;
    }

    // 🔥 НОВЫЙ МЕТОД: Сохранить сессию как модель (ИСПРАВЛЕННЫЙ)
    saveSessionAsModel(userId, modelName = null) {
        try {
            const session = this.getActiveSession(userId);
            if (!session || !session.currentFootprint) {
                return { success: false, error: 'Нет активной сессии или отпечатка' };
            }

            const manager = this.manager;
            const footprint = session.currentFootprint;
            const name = modelName || `Модель_${new Date().toLocaleTimeString('ru-RU')}`;

            // Сохраняем модель в файл
            const modelsDir = path.join(manager.config.dbPath, 'models');
            if (!fs.existsSync(modelsDir)) {
                fs.mkdirSync(modelsDir, { recursive: true });
            }

            const modelData = {
                id: footprint.id,
                userId: footprint.userId,
                name: name,
                timestamp: new Date(),
                graph: footprint.graph ? {
                    nodes: Array.from(footprint.graph.nodes.entries()),
                    edges: footprint.graph.edges || []
                } : null,
                points: footprint.points || [],
                metadata: footprint.metadata || {},
                transformation: footprint.transformation || null
            };

            const filename = `model_${footprint.id}_${Date.now()}.json`;
            const filePath = path.join(modelsDir, filename);
           
            fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2));

            console.log(`💾 Сессия сохранена как модель: ${name} (${filename})`);
            return { success: true, modelName: name, filePath, footprintId: footprint.id };

        } catch (error) {
            console.error(`❌ Ошибка сохранения сессии как модели: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SessionManager;

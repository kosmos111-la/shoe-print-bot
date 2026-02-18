// modules/footprint/core/session/session-manager.js
// 🔥 ИСПРАВЛЕНО: ПОЛНАЯ ИЗОЛЯЦИЯ ПЕСОЧНИЦ

class SessionManager {
    constructor(manager) {
        this.manager = manager;
        this.sessions = new Map();
        this.sessionTimeouts = new Map();

        // 🔥 РАЗДЕЛЯЕМ ПОСТОЯННЫЕ И ПЕСОЧНИЦЫ
        this.permanentSessions = new Map(); // userId -> sessionId (только постоянные)
        this.sandboxSessions = new Map();   // userId -> sessionId (только песочницы)

        console.log('🔄 SessionManager создан');
        console.log('   • Постоянные сессии: отдельно');
        console.log('   • Песочницы: отдельно');
    }

    // ========== ПОСТОЯННЫЕ СЕССИИ (ДЛЯ БАЗЫ МОДЕЛЕЙ) ==========

    createPermanentSession(userId, name = null) {
        console.log(`🔄 Создаю ПОСТОЯННУЮ сессию для пользователя ${userId}...`);

        const sessionId = `perm_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const sessionName = name || `Постоянная_${new Date().toLocaleTimeString('ru-RU')}`;

        const session = {
            id: sessionId,
            userId: userId,
            name: sessionName,
            createdAt: new Date(),
            lastActivity: new Date(),
            currentFootprint: null,
            photos: [],
            metadata: {
                type: 'permanent' // 🔥 ЯВНЫЙ ТИП
            }
        };

        this.sessions.set(sessionId, session);
        this.permanentSessions.set(userId, sessionId);

        this.resetSessionTimeout(userId, sessionId);

        console.log(`✅ Создана ПОСТОЯННАЯ сессия: ${sessionId}`);
        return session;
    }

    getActivePermanentSession(userId) {
        const sessionId = this.permanentSessions.get(userId);
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.metadata.type === 'permanent') {
                session.lastActivity = new Date();
                this.resetSessionTimeout(userId, sessionId);
                return session;
            }
        }
        return null;
    }

    // ========== ПЕСОЧНИЦЫ (ТЕКУЩИЕ СЕССИИ) ==========

    createSandboxSession(userId, name = null) {
        console.log(`🏖️ Создаю ПЕСОЧНИЦУ для пользователя ${userId}...`);

        const sessionId = `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const sessionName = name || `Сессия_${new Date().toLocaleTimeString('ru-RU')}`;

        const session = {
            id: sessionId,
            userId: userId,
            name: sessionName,
            createdAt: new Date(),
            lastActivity: new Date(),
            currentFootprint: null,
            photos: [],
            topologyManager: null, // 🔥 для хранения топологического менеджера
            metadata: {
                type: 'sandbox' // 🔥 ЯВНЫЙ ТИП
            }
        };

        this.sessions.set(sessionId, session);
        this.sandboxSessions.set(userId, sessionId);

        this.resetSessionTimeout(userId, sessionId);

        console.log(`✅ Создана ПЕСОЧНИЦА: ${sessionId}`);
        return session;
    }

    getActiveSandboxSession(userId) {
        const sessionId = this.sandboxSessions.get(userId);
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.metadata.type === 'sandbox') {
                session.lastActivity = new Date();
                this.resetSessionTimeout(userId, sessionId);
                return session;
            }
        }
        return null;
    }

    // ========== ЗАВЕРШЕНИЕ СЕССИЙ ==========

    endPermanentSession(userId) {
        const sessionId = this.permanentSessions.get(userId);
        if (!sessionId) return null;

        const session = this.sessions.get(sessionId);
        if (!session) return null;

        session.status = 'completed';
        session.endTime = new Date();

        const report = this.generateSessionReport(session);
       
        this.sessions.delete(sessionId);
        this.permanentSessions.delete(userId);
       
        if (this.sessionTimeouts.has(sessionId)) {
            clearTimeout(this.sessionTimeouts.get(sessionId));
            this.sessionTimeouts.delete(sessionId);
        }

        console.log(`🏁 Постоянная сессия завершена: ${sessionId}`);
        return report;
    }

    endSandboxSession(userId) {
        const sessionId = this.sandboxSessions.get(userId);
        if (!sessionId) return null;

        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const result = {
            sessionId: sessionId,
            name: session.name,
            createdAt: session.createdAt,
            duration: (Date.now() - session.createdAt) / 1000,
            photosCount: session.photos.length,
            hasModel: !!session.currentFootprint,
            model: session.currentFootprint
        };

        session.status = 'completed';
        session.endTime = new Date();

        this.sessions.delete(sessionId);
        this.sandboxSessions.delete(userId);
       
        if (this.sessionTimeouts.has(sessionId)) {
            clearTimeout(this.sessionTimeouts.get(sessionId));
            this.sessionTimeouts.delete(sessionId);
        }

        console.log(`🏁 Песочница завершена: ${sessionId}`);
        console.log(`   • Фото: ${result.photosCount}`);
        console.log(`   • Модель: ${result.hasModel ? 'есть' : 'нет'}`);

        return result;
    }

    // ========== СТАРЫЕ МЕТОДЫ (ДЛЯ СОВМЕСТИМОСТИ) ==========

    createSession(userId, name = null) {
        console.log(`⚠️ УСТАРЕЛО: используйте createSandboxSession`);
        return this.createSandboxSession(userId, name);
    }

    getActiveSession(userId) {
        console.log(`⚠️ УСТАРЕЛО: используйте getActiveSandboxSession`);
        return this.getActiveSandboxSession(userId);
    }

    endSession(userId) {
        console.log(`⚠️ УСТАРЕЛО: используйте endSandboxSession`);
        return this.endSandboxSession(userId);
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ==========

    resetSessionTimeout(userId, sessionId) {
        const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

        if (this.sessionTimeouts.has(sessionId)) {
            clearTimeout(this.sessionTimeouts.get(sessionId));
        }

        const timeout = setTimeout(() => {
            console.log(`⏰ Сессия ${sessionId} истекла по таймауту`);

            const session = this.sessions.get(sessionId);
            if (session) {
                if (session.metadata.type === 'permanent') {
                    this.permanentSessions.delete(userId);
                } else if (session.metadata.type === 'sandbox') {
                    this.sandboxSessions.delete(userId);
                }
                this.sessions.delete(sessionId);
            }
            this.sessionTimeouts.delete(sessionId);
        }, SESSION_TIMEOUT_MS);

        this.sessionTimeouts.set(sessionId, timeout);
    }

    generateSessionReport(session) {
        return {
            sessionId: session.id,
            type: session.metadata.type,
            duration: session.endTime ?
                (session.endTime - session.createdAt) / 1000 :
                (new Date() - session.createdAt) / 1000,
            totalPhotos: session.photos.length,
            hasModel: !!session.currentFootprint,
            createdAt: session.createdAt,
            endedAt: session.endTime || new Date()
        };
    }

    // ========== СТАТИСТИКА ==========

    getStats() {
        return {
            totalSessions: this.sessions.size,
            permanentSessions: this.permanentSessions.size,
            sandboxSessions: this.sandboxSessions.size,
            sessionsByType: {
                permanent: Array.from(this.sessions.values())
                    .filter(s => s.metadata?.type === 'permanent').length,
                sandbox: Array.from(this.sessions.values())
                    .filter(s => s.metadata?.type === 'sandbox').length
            }
        };
    }
}

module.exports = SessionManager;

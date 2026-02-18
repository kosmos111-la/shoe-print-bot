// modules/footprint/core/session/session-manager.js
// 🔥 ИСПРАВЛЕНО: Добавлено разделение на постоянные и песочницы

class SessionManager {
    constructor(manager) {
        this.manager = manager;
        this.sessions = new Map();
        this.sessionTimeouts = new Map();

        // 🔥 НОВОЕ: разделяем типы сессий
        this.permanentSessions = new Map(); // userId -> sessionId (база моделей)
        this.sandboxSessions = new Map();   // userId -> sessionId (текущие сессии)

        console.log('🔄 SessionManager создан');
        console.log('   • Постоянные сессии: отдельно');
        console.log('   • Песочницы: отдельно');
    }

    // ========== ПОСТОЯННЫЕ СЕССИИ (ДЛЯ БАЗЫ МОДЕЛЕЙ) ==========

    createPermanentSession(userId, name = null) {
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
            topologyManager: null, // 🔥 для хранения менеджера
            metadata: {
                type: 'sandbox' // 🔥 ЯВНЫЙ ТИП
            }
        };

        this.sessions.set(sessionId, session);
        this.sandboxSessions.set(userId, sessionId);
        this.resetSessionTimeout(userId, sessionId);

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

        this.sessions.delete(sessionId);
        this.sandboxSessions.delete(userId);
       
        if (this.sessionTimeouts.has(sessionId)) {
            clearTimeout(this.sessionTimeouts.get(sessionId));
            this.sessionTimeouts.delete(sessionId);
        }

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
}

module.exports = SessionManager;

// modules/session/session-manager.js
class SessionManager {
    constructor() {
        this.activeSessions = new Map();
        this.sessionHistory = new Map();
        console.log('🔄 SessionManager инициализирован');
    }

    createSession(userId, context) {
        const sessionId = `${userId}_${Date.now()}`;
        const session = {
            id: sessionId,
            userId: userId,
            startTime: new Date(),
            status: 'active',
            context: context || 'general',
            photos: [],
            analysisResults: [],
            location: null,
            metadata: {}
        };

        this.activeSessions.set(userId, session);
       
        if (!this.sessionHistory.has(userId)) {
            this.sessionHistory.set(userId, []);
        }
        this.sessionHistory.get(userId).push(session);

        console.log(`✅ Сессия создана: ${sessionId}`);
        return session;
    }

    addPhotoToSession(userId, photoData) {
        const session = this.activeSessions.get(userId);
        if (!session) return false;

        session.photos.push({
            ...photoData,
            timestamp: new Date(),
            sequence: session.photos.length + 1
        });

        console.log(`📸 Фото добавлено в сессию ${session.id}`);
        return true;
    }

    addAnalysisToSession(userId, analysisData) {
        const session = this.activeSessions.get(userId);
        if (!session) return false;

        session.analysisResults.push({
            ...analysisData,
            timestamp: new Date()
        });

        console.log(`🔍 Анализ добавлен в сессию ${session.id}`);
        return true;
    }

    getSessionSummary(userId) {
        const session = this.activeSessions.get(userId);
        if (!session) return null;

        return {
            sessionId: session.id,
            duration: (new Date() - session.startTime) / 1000,
            photoCount: session.photos.length,
            analysisCount: session.analysisResults.length,
            location: session.location,
            status: session.status
        };
    }

    endSession(userId) {
        const session = this.activeSessions.get(userId);
        if (!session) return null;

        session.status = 'completed';
        session.endTime = new Date();
       
        this.activeSessions.delete(userId);
       
        console.log(`🏁 Сессия завершена: ${session.id}`);
        return this.generateSessionReport(session);
    }

    generateSessionReport(session) {
        const report = {
            sessionId: session.id,
            duration: session.endTime ?
                (session.endTime - session.startTime) / 1000 :
                (new Date() - session.startTime) / 1000,
            totalPhotos: session.photos.length,
            totalAnalyses: session.analysisResults.length,
            firstPhotoTime: session.photos[0]?.timestamp,
            lastPhotoTime: session.photos[session.photos.length - 1]?.timestamp,
            location: session.location,
            context: session.context,
            photos: session.photos,
            analysisResults: session.analysisResults
        };

        return report;
    }

    getActiveSession(userId) {
        return this.activeSessions.get(userId);
    }

    hasActiveSession(userId) {
        return this.activeSessions.has(userId);
    }
}

module.exports = { SessionManager };

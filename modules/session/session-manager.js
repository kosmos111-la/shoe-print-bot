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
        if (!session) {
            console.warn(`⚠️ Не найдена сессия для пользователя ${userId}`);
            return false;
        }

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
        if (!session) {
            console.warn(`⚠️ Не найдена сессия для пользователя ${userId}`);
            return false;
        }

        // 🔥 ГАРАНТИРУЕМ ЧТО ВСЕ ДАННЫЕ ЕСТЬ
        const fullAnalysis = {
            ...analysisData,
            timestamp: new Date(),
            predictions: Array.isArray(analysisData?.predictions) ?
                analysisData.predictions : [],
            intelligentAnalysis: analysisData?.intelligentAnalysis || null,
            practicalAnalysis: analysisData?.practicalAnalysis || null,
            analysis: analysisData?.analysis || null,
            visualizationPaths: analysisData?.visualizationPaths || {},
            batchInfo: analysisData?.batchInfo || null
        };

        session.analysisResults.push(fullAnalysis);

        console.log(`🔍 Анализ добавлен в сессию ${session.id}`);
        console.log(`   - predictions: ${fullAnalysis.predictions.length}`);
       
        const protectorsCount = fullAnalysis.predictions
            .filter(p => p?.class === 'shoe-protector').length;
        console.log(`   - protectors: ${protectorsCount}`);

        return true;
    }

    getSessionSummary(userId) {
        const session = this.activeSessions.get(userId);
        if (!session) return null;

        const validAnalyses = session.analysisResults.filter(a =>
            a && Array.isArray(a.predictions)
        );

        return {
            sessionId: session.id,
            duration: (new Date() - session.startTime) / 1000,
            photoCount: session.photos.length,
            analysisCount: validAnalyses.length,
            validAnalysesCount: validAnalyses.filter(a =>
                a.predictions && a.predictions.length > 0
            ).length,
            location: session.location,
            status: session.status,
            hasPredictions: validAnalyses.some(a => a.predictions.length > 0)
        };
    }

    endSession(userId) {
        const session = this.activeSessions.get(userId);
        if (!session) {
            console.warn(`⚠️ Не найдена активная сессия для ${userId}`);
            return null;
        }

        session.status = 'completed';
        session.endTime = new Date();

        const report = this.generateSessionReport(session);
        this.activeSessions.delete(userId);

        console.log(`🏁 Сессия завершена: ${session.id}`);
        console.log(`   - фото: ${session.photos.length}`);
        console.log(`   - анализы: ${session.analysisResults.length}`);
       
        return report;
    }

    generateSessionReport(session) {
        const validAnalyses = session.analysisResults.filter(a =>
            a && Array.isArray(a.predictions)
        );

        const protectorAnalyses = validAnalyses.filter(a =>
            a.predictions.some(p => p?.class === 'shoe-protector')
        );

        return {
            sessionId: session.id,
            duration: session.endTime ?
                (session.endTime - session.startTime) / 1000 :
                (new Date() - session.startTime) / 1000,
            totalPhotos: session.photos.length,
            totalAnalyses: session.analysisResults.length,
            validAnalyses: validAnalyses.length,
            protectorAnalyses: protectorAnalyses.length,
            firstPhotoTime: session.photos[0]?.timestamp,
            lastPhotoTime: session.photos[session.photos.length - 1]?.timestamp,
            location: session.location,
            context: session.context,
            photos: session.photos,
            analysisResults: session.analysisResults
        };
    }

    getActiveSession(userId) {
        const session = this.activeSessions.get(userId);
        if (session) {
            return {
                ...session,
                analysisSummary: {
                    total: session.analysisResults.length,
                    withPredictions: session.analysisResults.filter(a =>
                        a?.predictions && a.predictions.length > 0
                    ).length,
                    withProtectors: session.analysisResults.filter(a =>
                        a?.predictions?.some(p => p?.class === 'shoe-protector')
                    ).length
                }
            };
        }
        return null;
    }

    hasActiveSession(userId) {
        return this.activeSessions.has(userId);
    }

    // 🔧 ДОПОЛНИТЕЛЬНЫЙ МЕТОД ДЛЯ ДЕБАГА
    debugSessionData(userId) {
        const session = this.activeSessions.get(userId);
        if (!session) return { error: "Сессия не найдена" };

        return {
            sessionId: session.id,
            photoCount: session.photos.length,
            analysisCount: session.analysisResults.length,
            analyses: session.analysisResults.map((analysis, index) => ({
                index,
                hasPredictions: !!analysis?.predictions,
                predictionsCount: analysis?.predictions?.length || 0,
                protectorsCount: analysis?.predictions?.filter(p =>
                    p?.class === 'shoe-protector'
                ).length || 0,
                firstProtectorPoints: analysis?.predictions
                    ?.find(p => p?.class === 'shoe-protector')
                    ?.points?.length || 0
            }))
        };
    }
}

module.exports = { SessionManager };

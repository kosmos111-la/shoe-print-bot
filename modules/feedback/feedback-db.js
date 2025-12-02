// modules/feedback/feedback-db.js
const fs = require('fs');
const path = require('path');

class FeedbackDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/feedback.json');
        this.ensureDatabase();
        console.log('💾 FeedbackDatabase инициализирован');
    }

    ensureDatabase() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
       
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({
                feedbacks: [],
                statistics: {
                    total: 0,
                    correct: 0,
                    correctionsByType: {},
                    accuracyHistory: []
                },
                version: '1.0'
            }, null, 2));
        }
    }

    addFeedback(feedback) {
        const data = this.loadData();
       
        const feedbackEntry = {
            id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            ...feedback
        };
       
        data.feedbacks.push(feedbackEntry);
       
        // Обновляем статистику
        data.statistics.total++;
        if (feedback.correctionType === 'correct') {
            data.statistics.correct++;
        } else {
            const type = feedback.correctionType || 'other';
            data.statistics.correctionsByType[type] =
                (data.statistics.correctionsByType[type] || 0) + 1;
        }
       
        // Рассчитываем текущую точность
        const accuracy = data.statistics.total > 0 ?
            (data.statistics.correct / data.statistics.total) * 100 : 0;
       
        // Сохраняем в историю (последние 100 точек)
        data.statistics.accuracyHistory.push({
            timestamp: new Date().toISOString(),
            accuracy: accuracy,
            totalFeedbacks: data.statistics.total
        });
       
        if (data.statistics.accuracyHistory.length > 100) {
            data.statistics.accuracyHistory.shift();
        }
       
        this.saveData(data);
        console.log(`✅ Feedback сохранен: ${feedbackEntry.id}`);
       
        return feedbackEntry;
    }

    getStatistics() {
        const data = this.loadData();
        return data.statistics;
    }

    getFeedbacksForRetraining() {
        const data = this.loadData();
       
        // Фильтруем фидбеки с исправлениями (не "correct")
        return data.feedbacks.filter(fb =>
            fb.correctionType && fb.correctionType !== 'correct'
        ).map(fb => ({
            original_prediction: fb.prediction,
            user_correction: fb.correctionType,
            image_id: fb.imageId,
            timestamp: fb.timestamp,
            user_id: fb.userId
        }));
    }

    getAccuracyTrend() {
        const data = this.loadData();
        return data.statistics.accuracyHistory;
    }

    loadData() {
        try {
            const content = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.log('❌ Ошибка загрузки базы фидбека:', error);
            return { feedbacks: [], statistics: { total: 0, correct: 0 } };
        }
    }

    saveData(data) {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.log('❌ Ошибка сохранения базы фидбека:', error);
        }
    }

    exportForRoboflow() {
        const corrections = this.getFeedbacksForRetraining();
       
        // Группируем по классам для Roboflow
        const exportData = {
            version: new Date().toISOString(),
            total_corrections: corrections.length,
            corrections_by_class: {},
            annotations: []
        };
       
        corrections.forEach(corr => {
            const className = corr.user_correction;
            exportData.corrections_by_class[className] =
                (exportData.corrections_by_class[className] || 0) + 1;
           
            // Форматируем для Roboflow API
            if (corr.original_prediction) {
                exportData.annotations.push({
                    image: corr.image_id,
                    annotation: {
                        class: className,
                        coordinates: corr.original_prediction.points,
                        confidence: corr.original_prediction.confidence
                    },
                    correction_source: 'user_feedback'
                });
            }
        });
       
        return exportData;
    }
}

module.exports = { FeedbackDatabase };

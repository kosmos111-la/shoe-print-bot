// modules/feedback/feedback-manager.js
class FeedbackManager {
    constructor() {
        this.activeFeedbackRequests = new Map(); // messageId -> feedbackData
        console.log('💬 FeedbackManager инициализирован');
    }

    requestFeedback(userId, chatId, prediction, context) {
        const feedbackId = `fb_req_${Date.now()}_${userId}`;
       
        const feedbackRequest = {
            id: feedbackId,
            userId: userId,
            chatId: chatId,
            prediction: prediction,
            context: context,
            timestamp: new Date(),
            status: 'pending'
        };

        this.activeFeedbackRequests.set(feedbackId, feedbackRequest);
       
        console.log(`📝 Feedback запрошен: ${feedbackId}`);
        return feedbackRequest;
    }

    createFeedbackKeyboard() {
        return {
            inline_keyboard: [
                [
                    { text: "✅ Правильно", callback_data: "feedback_correct" },
                    { text: "❌ Неправильно", callback_data: "feedback_incorrect" }
                ]
            ]
        };
    }

    createCorrectionKeyboard() {
        return {
            inline_keyboard: [
                [
                    { text: "🐾 След животного", callback_data: "correction_animal" },
                    { text: "👞 Другая обувь", callback_data: "correction_other_shoe" }
                ],
                [
                    { text: "📏 Неправильные границы", callback_data: "correction_bounds" },
                    { text: "👣 Несколько следов", callback_data: "correction_multiple" }
                ],
                [
                    { text: "🚫 Не след вообще", callback_data: "correction_not_footprint" },
                    { text: "🔍 Другой класс", callback_data: "correction_other_class" }
                ]
            ]
        };
    }

    processFeedback(feedbackId, userResponse, correctionType = null) {
        const request = this.activeFeedbackRequests.get(feedbackId);
        if (!request) return null;

        request.status = 'completed';
        request.userResponse = userResponse;
        request.correctionType = correctionType || (userResponse === 'correct' ? 'correct' : 'other');
        request.completedAt = new Date();

        this.activeFeedbackRequests.delete(feedbackId);
       
        console.log(`✅ Feedback обработан: ${feedbackId} -> ${correctionType || userResponse}`);
        return request;
    }

    getActiveRequests(userId) {
        return Array.from(this.activeFeedbackRequests.values())
            .filter(req => req.userId === userId && req.status === 'pending');
    }

    cleanupOldRequests() {
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
       
        let cleaned = 0;
        this.activeFeedbackRequests.forEach((req, id) => {
            if (req.timestamp.getTime() < hourAgo) {
                this.activeFeedbackRequests.delete(id);
                cleaned++;
            }
        });
       
        if (cleaned > 0) {
            console.log(`🧹 Очищено ${cleaned} старых feedback запросов`);
        }
    }
}

module.exports = { FeedbackManager };

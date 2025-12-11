// modules/utils/confidence-validator.js

class ConfidenceValidator {
    static normalizeConfidence(value) {
        // Преобразовать любое значение в диапазон [0.0, 1.0]
        if (typeof value !== 'number' || isNaN(value)) {
            return 0.5;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }
   
    static validatePoint(point) {
        const normalized = { ...point };
       
        // Нормализовать confidence
        normalized.confidence = this.normalizeConfidence(point.confidence);
       
        // Убедиться, что есть source
        if (!normalized.source) {
            normalized.source = 'unknown';
        }
       
        // Убедиться, что есть id
        if (!normalized.id) {
            normalized.id = `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
       
        return normalized;
    }
   
    static validatePointsArray(points) {
        return points.map(point => this.validatePoint(point));
    }
   
    static checkForConfidenceIssues(points) {
        const issues = [];
       
        points.forEach((point, i) => {
            const confidence = point.confidence || 0.5;
           
            if (confidence < 0.0) {
                issues.push({
                    index: i,
                    type: 'confidence_too_low',
                    value: confidence,
                    message: `Confidence меньше 0.0: ${confidence}`
                });
            }
           
            if (confidence > 1.0) {
                issues.push({
                    index: i,
                    type: 'confidence_too_high',
                    value: confidence,
                    message: `Confidence больше 1.0: ${confidence}`
                });
            }
           
            if (!point.source) {
                issues.push({
                    index: i,
                    type: 'missing_source',
                    message: 'Точка без source'
                });
            }
        });
       
        return issues;
    }
}

module.exports = ConfidenceValidator;

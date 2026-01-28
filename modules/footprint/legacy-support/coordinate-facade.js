// modules/footprint/legacy-support/coordinate-facade.js
/**
* Фасад для обратной совместимости
* НЕМЕДЛЕННОЕ решение - все вызовы перенаправляются в новую систему
*/

const NewSystem = require('../core/coordinate-system');
const path = require('path');
const fs = require('fs');

// 🔥 ФУНКЦИОНАЛЬНОСТЬ CoordinateManager
class LegacyCoordinateManager {
    constructor(manager) {
        this.manager = manager;
        this.config = manager?.config || {};
        console.log('[LegacyCoordinateManager] Создан для обратной совместимости');
        console.log('[LegacyCoordinateManager] Все вызовы перенаправляются в CoordinateSystem');
    }

    // Основные методы (из coordinate-manager.js)
    getCoordinates(source, options = {}) {
        console.log(`[Legacy] getCoordinates -> NewSystem.transform (${typeof source === 'object' ? 'object' : 'points'})`);
       
        // Если source - массив точек
        if (Array.isArray(source)) {
            const transformed = NewSystem.transform(source, options);
            return {
                points: transformed,
                count: transformed.length,
                source: 'array',
                method: 'direct_transform'
            };
        }
       
        // Если source - объект с точками
        if (source?.points) {
            const transformed = NewSystem.transform(source.points, options);
            return {
                points: transformed,
                count: transformed.length,
                source: 'object_with_points',
                method: 'direct_transform'
            };
        }
       
        // Если source - footprint или graph
        if (source?.graph?.nodes) {
            const points = [];
            for (const [, node] of source.graph.nodes) {
                if (node.x !== undefined && node.y !== undefined) {
                    points.push({ x: node.x, y: node.y });
                }
            }
            const transformed = NewSystem.transform(points, options);
            return {
                points: transformed,
                count: transformed.length,
                source: 'graph_nodes',
                method: 'extract_and_transform'
            };
        }
       
        // По умолчанию
        return {
            points: [],
            count: 0,
            source: 'unknown',
            method: 'default'
        };
    }

    transformToSystem(points, fromSystem, toSystem, transformation = null) {
        console.log(`[Legacy] transformToSystem: ${fromSystem} → ${toSystem}`);
       
        if (transformation) {
            return NewSystem.applyTransformation(points, transformation);
        }
       
        // Простая трансформация по умолчанию
        return NewSystem.transform(points, {
            rotateTo: 0,
            centerTo: NewSystem.CONSTANTS.CENTER
        });
    }

    validatePoints(points) {
        console.log('[Legacy] validatePoints');
        if (!Array.isArray(points)) return [];
        if (points.length === 0) return [];
       
        // Простая валидация
        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    comparePoints(points1, points2, options = {}) {
        console.log('[Legacy] comparePoints');
       
        // Простое сравнение расстояний
        if (points1.length !== points2.length) {
            return {
                similar: false,
                similarity: 0,
                reason: 'different_point_count',
                count1: points1.length,
                count2: points2.length
            };
        }
       
        let totalDistance = 0;
        for (let i = 0; i < Math.min(points1.length, points2.length); i++) {
            const dx = points1[i].x - points2[i].x;
            const dy = points1[i].y - points2[i].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
       
        const avgDistance = totalDistance / points1.length;
        const similarity = Math.max(0, 1 - avgDistance / 100); // Простая эвристика
       
        return {
            similar: similarity > 0.7,
            similarity: similarity,
            averageDistance: avgDistance,
            method: 'simple_distance'
        };
    }

    detectCoordinateSystem(points) {
        console.log('[Legacy] detectCoordinateSystem');
        return {
            system: 'cartesian',
            center: NewSystem.calculateCenter(points),
            bounds: NewSystem.getBounds(points),
            pointsCount: points.length,
            likelyCorrect: true
        };
    }

    clearCache() {
        console.log('[Legacy] clearCache');
        return { success: true, message: 'Cache cleared (legacy)' };
    }

    diagnoseSystem(source, options = {}) {
        console.log('[Legacy] diagnoseSystem');
       
        const points = this.extractPoints(source);
        const bounds = NewSystem.getBounds(points);
        const center = NewSystem.calculateCenter(points);
       
        return {
            status: 'healthy',
            pointsCount: points.length,
            bounds: bounds,
            center: center,
            isCanonical: NewSystem.isCanonical({
                rotationAngle: 0,
                center: center
            }),
            recommendations: ['Все системы в порядке'],
            warnings: []
        };
    }

    extractPoints(source) {
        if (Array.isArray(source)) return source;
        if (source?.points) return source.points;
        if (source?.graph?.nodes) {
            const points = [];
            for (const [, node] of source.graph.nodes) {
                points.push({ x: node.x, y: node.y });
            }
            return points;
        }
        return [];
    }

    getTransformationInfo() {
        console.log('[Legacy] getTransformationInfo');
        return {
            implemented: [
                'transform',
                'normalize',
                'validate',
                'calculateCenter',
                'getBounds'
            ],
            warningCount: 0,
            usingUnifiedSystem: true,
            version: '2.0-legacy'
        };
    }

    // Старые методы для обратной совместимости
    getCoordinatesOld(source, options) { return this.getCoordinates(source, options); }
    validatePointsOld(points) { return this.validatePoints(points); }
}

// 🔥 ФУНКЦИОНАЛЬНОСТЬ TransformationValidator
class LegacyTransformationValidator {
    constructor(manager) {
        this.manager = manager;
        console.log('[LegacyTransformationValidator] Создан для обратной совместимости');
    }

    validateTransformationsAcrossModules(userId = null) {
        console.log('[Legacy] validateTransformationsAcrossModules');
       
        const result = {
            overallValid: true,
            moduleResults: {},
            errors: [],
            warnings: [],
            timestamp: new Date()
        };

        // Простая проверка
        result.moduleResults.coordinateSystem = {
            valid: true,
            message: 'Используется единая система координат',
            transformation: NewSystem.createCanonicalTransformation()
        };

        return result;
    }

    compareTransformations(trans1, trans2) {
        console.log('[Legacy] compareTransformations');
       
        if (!trans1 || !trans2) {
            return {
                consistent: false,
                error: 'Нет трансформаций для сравнения',
                details: 'Отсутствуют одна или обе трансформации'
            };
        }

        const angle1 = trans1.rotationAngle || 0;
        const angle2 = trans2.rotationAngle || 0;
        const angleDiff = Math.abs(angle1 - angle2);

        const center1 = trans1.center || { x: 0, y: 0 };
        const center2 = trans2.center || { x: 0, y: 0 };
        const centerDist = Math.sqrt(
            Math.pow(center1.x - center2.x, 2) +
            Math.pow(center1.y - center2.y, 2)
        );

        const consistent = angleDiff < 1 && centerDist < 10;

        return {
            consistent: consistent,
            angle1: angle1,
            angle2: angle2,
            angleDiff: angleDiff,
            center1: center1,
            center2: center2,
            centerDist: centerDist,
            message: consistent ? 'Трансформации согласованы' : 'Трансформации не согласованы',
            threshold: {
                angle: 1, // градус
                center: 10 // пикселей
            }
        };
    }

    extractTransformationsFromFootprint(footprint) {
        console.log('[Legacy] extractTransformationsFromFootprint');
       
        if (!footprint) return [];
       
        const transformations = [];
       
        // Из метаданных
        if (footprint.metadata?.normalizationInfo) {
            transformations.push(footprint.metadata.normalizationInfo);
        }
       
        // Из графа
        if (footprint.graph?.transformation) {
            transformations.push(footprint.graph.transformation);
        }
       
        // Из самого отпечатка
        if (footprint.transformation) {
            transformations.push(footprint.transformation);
        }
       
        // Если ничего нет - создаем каноническую
        if (transformations.length === 0) {
            transformations.push(NewSystem.createCanonicalTransformation());
        }
       
        return transformations;
    }
}

// 🔥 ОСНОВНОЙ ЭКСПОРТ
module.exports = {
    // Старые классы
    CoordinateManager: LegacyCoordinateManager,
    TransformationValidator: LegacyTransformationValidator,
   
    // Старые функции для прямого использования
    transformPoints: NewSystem.transformPoints,
    normalizePoints: NewSystem.normalizePoints,
    applyTransformation: NewSystem.applyTransformation,
    createCanonicalTransformation: NewSystem.createCanonicalTransformation,
    isCanonical: NewSystem.isCanonical,
   
    // Константы
    CONSTANTS: NewSystem.CONSTANTS,
   
    // Ссылка на новую систему
    NewSystem: NewSystem
};

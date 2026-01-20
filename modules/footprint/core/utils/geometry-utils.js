// modules/footprint/core/utils/geometry-utils.js
// 🔥 УТИЛИТЫ ДЛЯ ГЕОМЕТРИИ

class GeometryUtils {
    constructor(manager) {
        this.manager = manager;
    }

    // 🔥 РАСЧЕТ ГРАНИЦ
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // 🔥 РАСЧЕТ ЦЕНТРА
    calculateCenter(points) {
        if (points.length === 0) {
            return { x: 0, y: 0 };
        }

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 РАСЧЕТ СООТНОШЕНИЯ СТОРОН
    calculateAspectRatio(points) {
        const bounds = this.calculateBounds(points);
        return bounds.width / Math.max(1, bounds.height);
    }

    // 🔥 РАССТОЯНИЕ МЕЖДУ ТОЧКАМИ
    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) +
            Math.pow(point2.y - point1.y, 2)
        );
    }

    // 🔥 ПРЕОБРАЗОВАНИЕ КООРДИНАТ
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_normalized', referenceTransformation = null) {
        if (!transformationInfo) {
            console.log('⚠️ Нет информации о трансформации');
            return originalPoints;
        }

        console.log(`📐 Преобразование координат ${originalPoints.length} точек (${direction})...`);

         const RotationInvariance = require('../../rotation-invariance');
        const processor = new RotationInvariance();
      
        if (direction === 'to_normalized') {
            // Из системы фото в нормализованную систему
            const targetTransformation = processor.createIdentityTransformation();
            return processor.transformPointsBetweenSystems(
                originalPoints,
                transformationInfo,
                targetTransformation
            );
        } else if (direction === 'to_original') {
            // Из нормализованной системы в систему фото
            if (!referenceTransformation) {
                console.log('⚠️ Нет эталонной трансформации для обратного преобразования');
                return originalPoints;
            }

            return processor.transformPointsBetweenSystems(
                originalPoints,
                processor.createIdentityTransformation(),
                referenceTransformation
            );
        } else if (direction === 'between_footprints' && referenceTransformation) {
            // Из системы одного отпечатка в систему другого
            return processor.transformPointsBetweenSystems(
                originalPoints,
                transformationInfo,
                referenceTransformation
            );
        }

        return originalPoints;
    }

    // 🔥 ПОДГОТОВКА ТОЧЕК ШАБЛОНА ДЛЯ СРАВНЕНИЯ
    prepareTemplatePointsForComparison(templateCells, templateBuilder, targetTransformation) {
        const points = [];

        // Получаем трансформацию шаблона (из templateBuilder)
        const templateTransformation = templateBuilder.getNormalizationTransform();

        const RotationInvariance = require('../../rotation-invariance');
        const processor = new RotationInvariance();

        templateCells.forEach((cell, index) => {
            // Создаем точку из ячейки шаблона
            const templatePoint = {
                x: cell.x || 0,
                y: cell.y || 0,
                nx: cell.nx || 0,
                ny: cell.ny || 0,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id
            };

            // 🔥 ПРЕОБРАЗУЕМ В СИСТЕМУ ЦЕЛЕВОГО ОТПЕЧАТКА
            const transformedPoint = processor.transformPointsBetweenSystems(
                [templatePoint],
                templateTransformation,
                targetTransformation
            )[0];

            if (transformedPoint) {
                points.push({
                    ...transformedPoint,
                    originalTemplatePoint: templatePoint,
                    cellIndex: index
                });
            }
        });

        return points;
    }

    // 🔥 ПРЕОБРАЗОВАНИЕ ТОЧЕК ШАБЛОНА В СИСТЕМУ ОТПЕЧАТКА
    transformTemplatePointsToFootprintSystem(templateCells, templateTransformation, footprintTransformation) {
        const points = [];

        templateCells.forEach((cell, index) => {
            const normalizedX = cell.nx || 0;
            const normalizedY = cell.ny || 0;

            const templateX = normalizedX * templateTransformation.width + templateTransformation.minX;
            const templateY = normalizedY * templateTransformation.height + templateTransformation.minY;

            let transformedX = templateX;
            let transformedY = templateY;

            const footprintAngle = footprintTransformation.rotationAngle || 0;

            if (footprintAngle !== 0 && footprintTransformation.center) {
                const centerX = footprintTransformation.center.x || 0;
                const centerY = footprintTransformation.center.y || 0;

                const dx = templateX - centerX;
                const dy = templateY - centerY;

                const angleRad = -footprintAngle * Math.PI / 180;
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const rotatedX = dx * cosA - dy * sinA;
                const rotatedY = dx * sinA + dy * cosA;

                transformedX = rotatedX + centerX;
                transformedY = rotatedY + centerY;
            }

            points.push({
                x: transformedX,
                y: transformedY,
                nx: normalizedX,
                ny: normalizedY,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id,
                isNew: cell.isNew || false,
                status: cell.status || 'unknown',
                originalCell: cell,
                cellIndex: index
            });
        });

        return points;
    }

    // 🔥 НАХОЖДЕНИЕ БЛИЖАЙШЕЙ ТОЧКИ
    findNearestPoint(point, pointsArray, maxDistance = Infinity) {
        let nearest = null;
        let minDistance = Infinity;

        for (const p of pointsArray) {
            const distance = Math.sqrt(
                Math.pow(p.x - point.x, 2) +
                Math.pow(p.y - point.y, 2)
            );

            if (distance < minDistance && distance <= maxDistance) {
                minDistance = distance;
                nearest = p;
            }
        }

        return nearest;
    }

    // 🔥 НАХОЖДЕНИЕ К ТОЧКАМ В РАДИУСЕ
    findPointsInRadius(centerPoint, pointsArray, radius) {
        return pointsArray.filter(point => {
            const distance = Math.sqrt(
                Math.pow(point.x - centerPoint.x, 2) +
                Math.pow(point.y - centerPoint.y, 2)
            );
            return distance <= radius;
        });
    }
}

module.exports = GeometryUtils;

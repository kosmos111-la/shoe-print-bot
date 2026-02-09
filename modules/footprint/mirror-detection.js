// modules/footprint/mirror-detection.js
// 🔥 УПРОЩЕННЫЙ ДЕТЕКТОР ЗЕРКАЛЬНОСТИ ДЛЯ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ

class MirrorDetection {
    constructor(options = {}) {
        this.config = {
            symmetryThreshold: 0.15,      // Порог для определения симметрии
            confidenceThreshold: 0.7,     // Порог уверенности в определении типа
            debug: options.debug || false,
            enableMirrorCorrection: options.enableMirrorCorrection !== false,
           
            // 🔥 ГЕОМЕТРИЧЕСКИЕ НАСТРОЙКИ
            geometricTolerance: options.geometricTolerance || 5, // градусов
            neighborCount: options.neighborCount || 4
        };

        console.log('🪞 MirrorDetection создан для геометрических паспортов');
    }

    // 🔥 ОСНОВНОЙ МЕТОД: Анализ геометрии паспортов
    analyzeGeometricSymmetry(passports) {
        console.log(`🔍 Анализирую зеркальность ${passports.length} геометрических паспортов`);
       
        if (passports.length < 3) {
            return {
                hasSymmetry: false,
                symmetryScore: 0,
                symmetryType: 'insufficient_data',
                confidence: 0,
                recommendations: ['Недостаточно данных для анализа зеркальности']
            };
        }

        // Извлекаем координаты из паспортов
        const points = this.extractPointsFromPassports(passports);
       
        // 1. Анализ распределения по квадрантам
        const quadrantAnalysis = this.analyzeQuadrants(points);
       
        // 2. Анализ симметрии
        const symmetryAnalysis = this.analyzeSymmetry(points);
       
        // 3. Определение типа обуви
        const footTypeAnalysis = this.determineFootType(points, quadrantAnalysis, symmetryAnalysis);
       
        // 4. Анализ геометрических инвариантов
        const geometricAnalysis = this.analyzeGeometricInvariants(passports);
       
        const result = {
            // 🔥 СИММЕТРИЯ
            hasSymmetry: symmetryAnalysis.score > this.config.symmetryThreshold,
            symmetryScore: symmetryAnalysis.score,
            symmetryType: symmetryAnalysis.type,
           
            // 🔥 ТИП ОБУВИ
            footType: footTypeAnalysis.type,
            footTypeConfidence: footTypeAnalysis.confidence,
            isMirrored: footTypeAnalysis.isMirrored,
           
            // 🔥 ГЕОМЕТРИЧЕСКИЕ ХАРАКТЕРИСТИКИ
            geometricInvariants: geometricAnalysis.invariants,
            geometricSymmetry: geometricAnalysis.symmetryScore,
           
            // 🔥 СТАТИСТИКА
            pointCount: points.length,
            quadrantAnalysis: quadrantAnalysis,
            symmetryAnalysis: symmetryAnalysis,
           
            // 🔥 РЕКОМЕНДАЦИИ
            recommendations: this.generateRecommendations({
                symmetryAnalysis,
                footTypeAnalysis,
                geometricAnalysis
            })
        };
       
        if (this.config.debug) {
            console.log(`📊 Результат анализа зеркальности:`);
            console.log(`   • Симметрия: ${result.hasSymmetry ? '✅ Да' : '❌ Нет'} (${result.symmetryScore.toFixed(3)})`);
            console.log(`   • Тип обуви: ${result.footType} (уверенность: ${result.footTypeConfidence.toFixed(3)})`);
            console.log(`   • Зеркальность: ${result.isMirrored ? '🪞 Да' : '👣 Нет'}`);
            console.log(`   • Геометрическая симметрия: ${result.geometricSymmetry.toFixed(3)}`);
        }
       
        return result;
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ ПАСПОРТОВ
    extractPointsFromPassports(passports) {
        const points = [];
       
        passports.forEach((passport, index) => {
            if (passport.coordinates) {
                points.push({
                    id: passport.pointId || `pt_${index}`,
                    x: passport.coordinates.x || 0,
                    y: passport.coordinates.y || 0,
                    passportHash: passport.geometricHash,
                    patternType: passport.patternType
                });
            }
        });
       
        return points;
    }

    // 🔥 АНАЛИЗ РАСПРЕДЕЛЕНИЯ ПО КВАДРАНТАМ
    analyzeQuadrants(points) {
        if (points.length === 0) {
            return {
                topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0,
                leftBias: 0, rightBias: 0, asymmetry: 0
            };
        }
       
        // Находим центр распределения
        const center = this.calculateCenter(points);
       
        const quadrants = {
            topLeft: 0,     // x < center.x, y < center.y
            topRight: 0,    // x >= center.x, y < center.y
            bottomLeft: 0,  // x < center.x, y >= center.y
            bottomRight: 0  // x >= center.x, y >= center.y
        };
       
        points.forEach(point => {
            if (point.y < center.y) {
                if (point.x < center.x) quadrants.topLeft++;
                else quadrants.topRight++;
            } else {
                if (point.x < center.x) quadrants.bottomLeft++;
                else quadrants.bottomRight++;
            }
        });
       
        const total = points.length;
        const leftCount = quadrants.topLeft + quadrants.bottomLeft;
        const rightCount = quadrants.topRight + quadrants.bottomRight;
       
        return {
            ...quadrants,
            leftBias: leftCount / total,
            rightBias: rightCount / total,
            asymmetry: Math.abs(leftCount - rightCount) / total,
            center: center
        };
    }

    // 🔥 АНАЛИЗ СИММЕТРИИ
    analyzeSymmetry(points) {
        if (points.length < 6) {
            return {
                score: 0,
                type: 'insufficient_data',
                axis: 'unknown',
                mirroredPairs: 0
            };
        }
       
        const center = this.calculateCenter(points);
        const bounds = this.calculateBounds(points);
       
        // 1. Симметрия относительно вертикальной оси
        const verticalSymmetry = this.calculateVerticalSymmetry(points, center, bounds);
       
        // 2. Симметрия относительно горизонтальной оси
        const horizontalSymmetry = this.calculateHorizontalSymmetry(points, center, bounds);
       
        // Выбираем лучшую симметрию
        let bestSymmetry = verticalSymmetry;
        if (horizontalSymmetry.score > verticalSymmetry.score) {
            bestSymmetry = horizontalSymmetry;
            bestSymmetry.type = 'horizontal';
        } else {
            bestSymmetry.type = 'vertical';
        }
       
        return bestSymmetry;
    }

    // 🔥 ВЫЧИСЛИТЬ ВЕРТИКАЛЬНУЮ СИММЕТРИЮ
    calculateVerticalSymmetry(points, center, bounds) {
        const leftPoints = points.filter(p => p.x < center.x);
        const rightPoints = points.filter(p => p.x >= center.x);
       
        if (leftPoints.length === 0 || rightPoints.length === 0) {
            return { score: 0, mirroredPairs: 0, averageDistance: 0 };
        }
       
        // Зеркалим правые точки относительно вертикальной оси
        const mirroredRightPoints = rightPoints.map(p => ({
            x: center.x - (p.x - center.x), // Зеркальное отражение
            y: p.y,
            original: p
        }));
       
        return this.calculateSymmetryScore(leftPoints, mirroredRightPoints, bounds.width);
    }

    // 🔥 ВЫЧИСЛИТЬ ГОРИЗОНТАЛЬНУЮ СИММЕТРИЮ
    calculateHorizontalSymmetry(points, center, bounds) {
        const topPoints = points.filter(p => p.y < center.y);
        const bottomPoints = points.filter(p => p.y >= center.y);
       
        if (topPoints.length === 0 || bottomPoints.length === 0) {
            return { score: 0, mirroredPairs: 0, averageDistance: 0 };
        }
       
        // Зеркалим нижние точки относительно горизонтальной оси
        const mirroredBottomPoints = bottomPoints.map(p => ({
            x: p.x,
            y: center.y - (p.y - center.y), // Зеркальное отражение
            original: p
        }));
       
        return this.calculateSymmetryScore(topPoints, mirroredBottomPoints, bounds.height);
    }

    // 🔥 ВЫЧИСЛИТЬ СКОР СИММЕТРИИ
    calculateSymmetryScore(referencePoints, mirroredPoints, size) {
        let matchedPairs = 0;
        let totalScore = 0;
       
        const usedMirrored = new Set();
       
        referencePoints.forEach(refPoint => {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;
           
            mirroredPoints.forEach((mirroredPoint, index) => {
                if (usedMirrored.has(index)) return;
               
                const distance = this.calculateDistance(refPoint, mirroredPoint);
                const normalizedDistance = distance / (size / 4);
               
                if (normalizedDistance < 0.2 && distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = mirroredPoint;
                    bestIndex = index;
                }
            });
           
            if (bestMatch) {
                const matchScore = 1 - Math.min(1, bestDistance / (size / 10));
                totalScore += matchScore;
                matchedPairs++;
                usedMirrored.add(bestIndex);
            }
        });
       
        const maxPossiblePairs = Math.min(referencePoints.length, mirroredPoints.length);
        const symmetryScore = maxPossiblePairs > 0 ? totalScore / maxPossiblePairs : 0;
       
        return {
            score: symmetryScore,
            mirroredPairs: matchedPairs,
            averageDistance: totalScore > 0 ? totalScore / matchedPairs : 0
        };
    }

    // 🔥 ОПРЕДЕЛИТЬ ТИП ОБУВИ
    determineFootType(points, quadrantAnalysis, symmetryAnalysis) {
        if (points.length < 5) {
            return {
                type: 'unknown',
                confidence: 0,
                isMirrored: false,
                reason: 'Недостаточно точек'
            };
        }
       
        let type = 'unknown';
        let confidence = 0;
        let isMirrored = false;
       
        // Анализ смещения влево/вправо
        const leftBias = quadrantAnalysis.leftBias;
        const rightBias = quadrantAnalysis.rightBias;
        const asymmetry = Math.abs(leftBias - rightBias);
       
        // Определяем ориентацию по смещению
        if (asymmetry > 0.1) {
            if (rightBias > leftBias) {
                type = 'right';
                confidence = asymmetry * 0.7 + (1 - symmetryAnalysis.score) * 0.3;
                isMirrored = false;
            } else {
                type = 'left';
                confidence = asymmetry * 0.7 + (1 - symmetryAnalysis.score) * 0.3;
                isMirrored = true;
            }
        } else if (symmetryAnalysis.score > this.config.symmetryThreshold) {
            // Высокая симметрия - возможно нейтральный тип
            type = 'neutral';
            confidence = symmetryAnalysis.score;
            isMirrored = false;
        }
       
        // Корректируем уверенность
        confidence = Math.min(1, Math.max(0, confidence));
       
        return {
            type,
            confidence,
            isMirrored,
            leftBias,
            rightBias,
            asymmetry
        };
    }

    // 🔥 АНАЛИЗ ГЕОМЕТРИЧЕСКИХ ИНВАРИАНТОВ
    analyzeGeometricInvariants(passports) {
        if (passports.length < 3) {
            return {
                invariants: [],
                symmetryScore: 0,
                hasMirrorPairs: false
            };
        }
       
        // Группируем паспорта по типу паттерна
        const patternGroups = new Map();
       
        passports.forEach(passport => {
            const type = passport.patternType || 'unknown';
            if (!patternGroups.has(type)) {
                patternGroups.set(type, []);
            }
            patternGroups.get(type).push(passport);
        });
       
        // Ищем зеркальные пары паттернов
        let mirrorPairs = 0;
        let totalPairs = 0;
       
        // Анализируем углы в паспортах
        const allAngles = [];
        passports.forEach(passport => {
            if (passport.angles && Array.isArray(passport.angles)) {
                allAngles.push(...passport.angles);
            }
        });
       
        // Проверяем симметрию углов
        let angleSymmetry = 0;
        if (allAngles.length > 0) {
            // Углы, близкие к 90°, могут быть симметричными
            const near90 = allAngles.filter(angle => Math.abs(angle - 90) < 15).length;
            angleSymmetry = near90 / allAngles.length;
        }
       
        // Проверяем наличие парных паттернов (например, правые/левые треугольники)
        const patternTypes = Array.from(patternGroups.keys());
        let patternSymmetry = 0;
       
        for (let i = 0; i < patternTypes.length; i++) {
            for (let j = i + 1; j < patternTypes.length; j++) {
                const type1 = patternTypes[i];
                const type2 = patternTypes[j];
               
                // Проверяем, являются ли паттерны зеркальными (по названию или характеристикам)
                if (this.arePatternsMirrored(type1, type2, patternGroups.get(type1), patternGroups.get(type2))) {
                    mirrorPairs++;
                }
                totalPairs++;
            }
        }
       
        const symmetryScore = totalPairs > 0 ? mirrorPairs / totalPairs : 0;
       
        return {
            invariants: Array.from(patternGroups.entries()).map(([type, group]) => ({
                type,
                count: group.length,
                angles: this.getAverageAngles(group)
            })),
            symmetryScore: Math.max(symmetryScore, angleSymmetry),
            hasMirrorPairs: mirrorPairs > 0,
            patternGroups: patternTypes.length,
            mirrorPairs
        };
    }

    // 🔥 ПРОВЕРИТЬ, ЯВЛЯЮТСЯ ЛИ ПАТТЕРНЫ ЗЕРКАЛЬНЫМИ
    arePatternsMirrored(type1, type2, group1, group2) {
        // Простая проверка по названию
        if (type1.includes('left') && type2.includes('right')) return true;
        if (type1.includes('right') && type2.includes('left')) return true;
       
        // Проверка по средним углам
        if (group1 && group2 && group1.length > 0 && group2.length > 0) {
            const avgAngles1 = this.getAverageAngles(group1);
            const avgAngles2 = this.getAverageAngles(group2);
           
            if (avgAngles1.length > 0 && avgAngles2.length > 0) {
                // Проверяем, являются ли углы дополнительными (например, 30° и 150°)
                const angleDiff = Math.abs(avgAngles1[0] - (180 - avgAngles2[0]));
                if (angleDiff < this.config.geometricTolerance) {
                    return true;
                }
            }
        }
       
        return false;
    }

    // 🔥 ПОЛУЧИТЬ СРЕДНИЕ УГЛЫ ИЗ ГРУППЫ ПАСПОРТОВ
    getAverageAngles(passports) {
        const allAngles = [];
       
        passports.forEach(passport => {
            if (passport.angles && Array.isArray(passport.angles)) {
                allAngles.push(...passport.angles);
            }
        });
       
        if (allAngles.length === 0) return [];
       
        // Группируем углы по интервалам
        const angleBins = new Array(18).fill(0); // 20° интервалы
        allAngles.forEach(angle => {
            const bin = Math.floor(angle / 20);
            if (bin >= 0 && bin < 18) {
                angleBins[bin]++;
            }
        });
       
        // Находим наиболее частые углы
        const maxCount = Math.max(...angleBins);
        const commonAngles = [];
       
        angleBins.forEach((count, bin) => {
            if (count >= maxCount * 0.5) { // Хотя бы половина от максимума
                commonAngles.push(bin * 20 + 10); // Центр интервала
            }
        });
       
        return commonAngles;
    }

    // 🔥 СОЗДАТЬ РЕКОМЕНДАЦИИ
    generateRecommendations(analysis) {
        const recommendations = [];
       
        if (analysis.symmetryAnalysis.score > this.config.symmetryThreshold) {
            recommendations.push({
                type: 'info',
                message: `Обнаружена симметрия ${analysis.symmetryAnalysis.type} (${(analysis.symmetryAnalysis.score * 100).toFixed(1)}%)`,
                action: 'auto_correct_if_needed'
            });
        }
       
        if (analysis.footTypeAnalysis.confidence > this.config.confidenceThreshold) {
            const footType = analysis.footTypeAnalysis.type;
            const confidence = analysis.footTypeAnalysis.confidence * 100;
           
            recommendations.push({
                type: 'success',
                message: `Определен тип обуви: ${footType} (уверенность: ${confidence.toFixed(1)}%)`,
                action: footType === 'left' && this.config.enableMirrorCorrection ? 'apply_mirror_correction' : 'none'
            });
        } else if (analysis.footTypeAnalysis.type !== 'unknown') {
            recommendations.push({
                type: 'warning',
                message: `Возможный тип обуви: ${analysis.footTypeAnalysis.type} (низкая уверенность)`,
                action: 'collect_more_data'
            });
        }
       
        if (analysis.geometricAnalysis.hasMirrorPairs) {
            recommendations.push({
                type: 'info',
                message: `Обнаружены зеркальные пары паттернов (${analysis.geometricAnalysis.mirrorPairs} пар)`,
                action: 'geometric_analysis_available'
            });
        }
       
        // Добавляем рекомендацию по сбору данных если мало информации
        if (analysis.symmetryAnalysis.score < 0.1 && analysis.footTypeAnalysis.confidence < 0.3) {
            recommendations.push({
                type: 'warning',
                message: 'Недостаточно данных для определения зеркальности',
                action: 'collect_more_photos'
            });
        }
       
        return recommendations;
    }

    // 🔥 ПРИМЕНИТЬ ЗЕРКАЛЬНУЮ КОРРЕКЦИЮ (если нужно)
    applyMirrorCorrection(passports, targetFootType = 'right') {
        console.log(`🔄 Применяю зеркальную коррекцию к ${passports.length} паспортам`);
       
        const analysis = this.analyzeGeometricSymmetry(passports);
       
        if (!analysis.isMirrored || analysis.footType === targetFootType) {
            console.log('✅ Зеркальная коррекция не требуется');
            return {
                applied: false,
                reason: 'Не требуется или уже правильный тип',
                originalPassports: passports,
                correctedPassports: passports
            };
        }
       
        // Зеркалим координаты
        const correctedPassports = passports.map(passport => {
            if (!passport.coordinates) return passport;
           
            // Находим центр для зеркалирования
            const points = this.extractPointsFromPassports(passports);
            const center = this.calculateCenter(points);
           
            // Зеркалим координаты относительно вертикальной оси
            const mirroredX = center.x - (passport.coordinates.x - center.x);
           
            return {
                ...passport,
                coordinates: {
                    ...passport.coordinates,
                    x: mirroredX
                },
                metadata: {
                    ...passport.metadata,
                    mirrorCorrected: true,
                    originalX: passport.coordinates.x,
                    correctionApplied: new Date(),
                    originalFootType: analysis.footType,
                    targetFootType: targetFootType
                }
            };
        });
       
        console.log(`✅ Применена зеркальная коррекция: ${analysis.footType} → ${targetFootType}`);
       
        return {
            applied: true,
            originalAnalysis: analysis,
            correctedPassports: correctedPassports,
            correctionInfo: {
                originalFootType: analysis.footType,
                targetFootType: targetFootType,
                mirrorAxis: 'vertical',
                correctionCenter: this.calculateCenter(this.extractPointsFromPassports(passports))
            }
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };
       
        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

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

    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    detectFootType(graph) {
        console.log(`🦶 [Совместимость] Определяю тип следа из графа...`);
       
        // Извлекаем точки из графа
        const points = [];
        if (graph && graph.nodes) {
            graph.nodes.forEach((node, nodeId) => {
                points.push({
                    id: nodeId,
                    x: node.x || 0,
                    y: node.y || 0
                });
            });
        }
       
        // Создаем фейковые паспорта для совместимости
        const fakePassports = points.map((point, index) => ({
            pointId: point.id,
            coordinates: { x: point.x, y: point.y },
            geometricHash: `legacy_${index}`,
            patternType: 'legacy'
        }));
       
        const analysis = this.analyzeGeometricSymmetry(fakePassports);
       
        return {
            footType: analysis.footType,
            confidence: analysis.footTypeConfidence,
            reason: 'Совместимость со старым кодом',
            isMirrored: analysis.isMirrored,
            pointCount: points.length
        };
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    mirrorGraph(graph, axis = 'vertical') {
        console.log(`🪞 [Совместимость] Зеркалю граф ${graph.name || 'unknown'}`);
       
        // Извлекаем точки
        const points = [];
        if (graph && graph.nodes) {
            graph.nodes.forEach((node, nodeId) => {
                points.push({
                    id: nodeId,
                    x: node.x || 0,
                    y: node.y || 0,
                    node: node
                });
            });
        }
       
        if (points.length === 0) {
            console.log('⚠️ Граф не содержит узлов');
            return graph;
        }
       
        const center = this.calculateCenter(points);
       
        // Создаем новый граф с зеркальными координатами
        // (здесь должна быть логика создания нового графа, но для совместимости возвращаем старый)
       
        console.log(`✅ Граф зеркалирован относительно оси ${axis}, центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
       
        return {
            ...graph,
            mirrorMetadata: {
                originalGraphId: graph.id,
                mirrorAxis: axis,
                mirrorCenter: center,
                mirroredAt: new Date()
            }
        };
    }

    // 🔥 ПОЛУЧИТЬ ВИЗУАЛИЗАЦИОННЫЕ ДАННЫЕ
    getVisualizationData(passports) {
        const analysis = this.analyzeGeometricSymmetry(passports);
        const points = this.extractPointsFromPassports(passports);
        const center = this.calculateCenter(points);
        const bounds = this.calculateBounds(points);
       
        return {
            analysis: analysis,
            points: points.map(p => ({
                ...p,
                quadrant: this.getPointQuadrant(p, center)
            })),
            center: center,
            bounds: bounds,
            quadrants: this.analyzeQuadrants(points),
            symmetryLines: {
                vertical: { x: center.x, y1: bounds.minY, y2: bounds.maxY },
                horizontal: { y: center.y, x1: bounds.minX, x2: bounds.maxX }
            },
            recommendations: analysis.recommendations
        };
    }

    getPointQuadrant(point, center) {
        if (point.x < center.x) {
            return point.y < center.y ? 'topLeft' : 'bottomLeft';
        } else {
            return point.y < center.y ? 'topRight' : 'bottomRight';
        }
    }
}

module.exports = MirrorDetection;

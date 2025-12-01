// modules/analysis/practical-analyzer.js
class PracticalAnalyzer {
    constructor() {
        console.log('🎯 PracticalAnalyzer: Практический анализ для ПСО');
    }

    analyzeForPSO(predictions, userContext = {}) {
        const analysis = {
            // 🔍 КЛЮЧЕВЫЕ ПРИЗНАКИ
            keyFindings: {
                isAnimal: this.checkForAnimal(predictions),
                hasHeel: this.checkForHeel(predictions),
                hasToe: this.checkForToe(predictions),
                hasGroundDisturbance: this.checkForGroundDisturbance(predictions),
                footprintCount: this.countFootprints(predictions),
                protectorDetails: this.analyzeProtectorDetails(predictions)
            },
          
            // 🎯 ПРАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ
            recommendations: this.generatePSORecommendations(predictions),
          
            // 📊 ЧИСТЫЕ ФАКТЫ
            facts: {
                classesFound: this.listFoundClasses(predictions),
                objectCounts: this.countObjectsByClass(predictions),
                hasClearOutline: predictions.some(p => p.class === 'Outline-trail')
            }
        };
      
        return analysis;
    }

    // 🐕 ФИЛЬТРАЦИЯ ЛАП ЖИВОТНЫХ
    checkForAnimal(predictions) {
        const animalPaws = predictions.filter(p => p.class === 'Animal');
        return {
            hasAnimal: animalPaws.length > 0,
            count: animalPaws.length,
            message: animalPaws.length > 0
                ? `🚫 Обнаружены следы животных: ${animalPaws.length}`
                : '✅ Следов животных нет'
        };
    }

    // 👠 ПРОВЕРКА КАБЛУКА
    checkForHeel(predictions) {
        const heels = predictions.filter(p => p.class === 'Heel');
       
        return {
            hasHeel: heels.length > 0,
            count: heels.length,
            message: heels.length > 0
                ? `👠 Каблук: ${heels.length} детекций`
                : '👟 Каблук не обнаружен'
        };
    }

    // 🦶 ПРОВЕРКА МЫСОЧНОЙ ЧАСТИ
    checkForToe(predictions) {
        const toes = predictions.filter(p => p.class === 'Toe');
        return {
            hasToe: toes.length > 0,
            count: toes.length,
            message: toes.length > 0
                ? `🦶 Мысочная часть: ${toes.length}`
                : '🦶 Мысочная часть не обнаружена'
        };
    }

    // 🌊 ПРОВЕРКА ПОВОЛОКИ/ВЫВОЛОКИ
    checkForGroundDisturbance(predictions) {
        const disturbances = predictions.filter(p => p.class === 'Dragged and dragged');
       
        return {
            hasDisturbance: disturbances.length > 0,
            count: disturbances.length,
            message: disturbances.length > 0
                ? `🌊 Динамический рисунок: ${disturbances.length}`
                : '🌊 Четкие края'
        };
    }

    // 👣 ПОДСЧЕТ СЛЕДОВ
    countFootprints(predictions) {
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
       
        return {
            count: outlines.length,
            message: outlines.length > 1
                ? `👣 Следов в кадре: ${outlines.length}`
                : outlines.length === 1 ? '👣 1 след' : '👣 Следов не обнаружено'
        };
    }

    // 🔍 АНАЛИЗ ДЕТАЛЕЙ ПРОТЕКТОРА
    analyzeProtectorDetails(predictions) {
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
        const disturbances = predictions.filter(p => p.class === 'Dragged and dragged');
       
        // Важно: предупредить о возможной путанице
        const warning = disturbances.length > protectors.length * 0.5
            ? '⚠️ Много динамических элементов - возможна путаница с протектором'
            : null;
       
        return {
            protectorCount: protectors.length,
            disturbanceCount: disturbances.length,
            warning: warning,
            message: protectors.length > 0
                ? `🔍 Деталей протектора: ${protectors.length}`
                : '🔍 Деталей протектора не обнаружено'
        };
    }

    // 📋 СПИСОК НАЙДЕННЫХ КЛАССОВ
    listFoundClasses(predictions) {
        const classes = [...new Set(predictions.map(p => p.class))];
        return classes;
    }

    // 📊 ПОДСЧЕТ ОБЪЕКТОВ ПО КЛАССАМ
    countObjectsByClass(predictions) {
        const counts = {};
        predictions.forEach(pred => {
            counts[pred.class] = (counts[pred.class] || 0) + 1;
        });
        return counts;
    }

    // 💡 ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ
    generatePSORecommendations(predictions) {
        const recommendations = [];
        const animalCheck = this.checkForAnimal(predictions);
        const heelCheck = this.checkForHeel(predictions);
        const toeCheck = this.checkForToe(predictions);
        const disturbanceCheck = this.checkForGroundDisturbance(predictions);
        const footprintCheck = this.countFootprints(predictions);
        const protectorDetails = this.analyzeProtectorDetails(predictions);

        // 1. ИСКЛЮЧЕНИЕ ЖИВОТНЫХ
        if (animalCheck.hasAnimal) {
            recommendations.push(`🚫 ${animalCheck.message}`);
        }

        // 2. ОСНОВНЫЕ ПРИЗНАКИ
        if (heelCheck.hasHeel) {
            recommendations.push(`👠 ${heelCheck.message}`);
        }
       
        if (toeCheck.hasToe) {
            recommendations.push(`🦶 ${toeCheck.message}`);
        }
       
        if (disturbanceCheck.hasDisturbance) {
            recommendations.push(`🌊 ${disturbanceCheck.message}`);
           
            // Практическая интерпретация
            if (disturbanceCheck.count > 3) {
                recommendations.push('   • Мягкий/влажный грунт');
            }
        }

        // 3. КОЛИЧЕСТВО СЛЕДОВ
        recommendations.push(footprintCheck.message);

        // 4. ДЕТАЛИ ПРОТЕКТОРА
        recommendations.push(protectorDetails.message);
        if (protectorDetails.warning) {
            recommendations.push(protectorDetails.warning);
        }

        // 5. ОБЩАЯ ОЦЕНКА
        const outlineFound = predictions.some(p => p.class === 'Outline-trail');
        const enoughDetail = protectorDetails.protectorCount > 2 || disturbanceCheck.count > 0;
       
        if (outlineFound && enoughDetail) {
            recommendations.push('✅ След пригоден для анализа');
        } else if (!outlineFound) {
            recommendations.push('❌ Контур следа не обнаружен - анализ затруднен');
        } else {
            recommendations.push('⚠️ Мало деталей для точного анализа');
        }

        return recommendations;
    }

    // 📊 КАТЕГОРИЗАЦИЯ ОБУВИ (по фактам)
    categorizeShoe(predictions) {
        const heelCheck = this.checkForHeel(predictions);
        const toeCheck = this.checkForToe(predictions);
        const protectorDetails = this.analyzeProtectorDetails(predictions);
       
        // Чистые факты без догадок
        const features = [];
       
        if (heelCheck.hasHeel) features.push('с каблуком');
        if (toeCheck.hasToe) features.push('с мысочной частью');
        if (protectorDetails.protectorCount > 5) features.push('детализированный протектор');
        if (protectorDetails.protectorCount < 3) features.push('мало деталей протектора');
       
        return features.length > 0 ? features.join(', ') : 'недостаточно данных';
    }

    // 🔎 ОТЛИЧИТЕЛЬНЫЕ ОСОБЕННОСТИ
    findDistinctiveFeatures(predictions) {
        const features = [];
        const counts = this.countObjectsByClass(predictions);
       
        // Только факты
        if (counts['shoe-protector'] > 10) features.push('много деталей протектора');
        if (counts['shoe-protector'] < 3) features.push('мало деталей протектора');
        if (counts['Dragged and dragged'] > 5) features.push('интенсивное выдавливание грунта');
        if (counts['Heel'] > 2) features.push('несколько каблучных элементов');
        if (counts['Toe'] > 2) features.push('несколько мысочных элементов');
       
        // Необычные классы
        const unusualClasses = Object.keys(counts).filter(cls =>
            !['Outline-trail', 'shoe-protector', 'Heel', 'Animal', 'Toe', 'Dragged and dragged'].includes(cls)
        );
       
        if (unusualClasses.length > 0) {
            features.push('нестандартные элементы: ' + unusualClasses.join(', '));
        }
       
        return features.length > 0 ? features : ['стандартные признаки'];
    }

    // 🌍 ВЗАИМОДЕЙСТВИЕ С ПОВЕРХНОСТЬЮ
    analyzeSurfaceInteraction(predictions) {
        const disturbanceCheck = this.checkForGroundDisturbance(predictions);
        const protectorDetails = this.analyzeProtectorDetails(predictions);
       
        const interactions = [];
       
        if (disturbanceCheck.hasDisturbance) {
            if (disturbanceCheck.count > protectorDetails.protectorCount) {
                interactions.push('преобладают динамические элементы');
            } else {
                interactions.push('есть динамические элементы');
            }
        }
       
        if (protectorDetails.protectorCount > 0 && disturbanceCheck.count === 0) {
            interactions.push('четкий отпечаток');
        }
       
        return interactions.length > 0 ? interactions : ['стандартное взаимодействие'];
    }

    // 👣 РАСПРЕДЕЛЕНИЕ СЛЕДОВ
    analyzeFootprintDistribution(predictions) {
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
       
        if (outlines.length < 2) {
            return outlines.length === 1 ? ['один след'] : ['следов нет'];
        }
       
        // Простая группировка по расстоянию (только факт наличия нескольких)
        return [`${outlines.length} отдельных следов`];
    }

    // 📐 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (только для группировки)
    getCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
}

module.exports = { PracticalAnalyzer };

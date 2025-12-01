// modules/analysis/practical-analyzer.js
class PracticalAnalyzer {
    constructor() {
        console.log('🎯 PracticalAnalyzer: Практический анализ для ПСО');
    }

    analyzeForPSO(predictions, userContext = {}) {
        const analysis = {
            // 🔍 КЛЮЧЕВЫЕ ПРИЗНАКИ ДЛЯ ИСКЛЮЧЕНИЯ
            exclusionCheck: {
                isAnimal: this.checkForAnimal(predictions),
                hasHeel: this.analyzeHeelCharacteristics(predictions),
                hasToe: this.checkForToe(predictions),
                hasGroundDisturbance: this.checkForGroundDisturbance(predictions), // 🆕 ПОВОЛОКА/ВЫВОЛОКА
                footprintCount: this.countFootprints(predictions),
                isComplete: this.checkFootprintCompleteness(predictions)
            },
          
            // 🎯 РЕКОМЕНДАЦИИ ДЛЯ СЛЕДОПЫТА
            recommendations: this.generatePSORecommendations(predictions),
          
            // 📊 ПРАКТИЧЕСКИЕ ВЫВОДЫ
            practicalInsights: {
                likelyGender: this.estimateGender(predictions),
                shoeCategory: this.categorizeShoe(predictions),
                distinctiveFeatures: this.findDistinctiveFeatures(predictions),
                heelType: this.determineHeelType(predictions),
                surfaceInteraction: this.analyzeSurfaceInteraction(predictions) // 🆕 ВЗАИМОДЕЙСТВИЕ С ПОВЕРХНОСТЬЮ
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
                ? `🚫 Обнаружены отпечатки лап животных (${animalPaws.length})`
                : '✅ Отпечатков животных нет'
        };
    }

    // 👠 АНАЛИЗ КАБЛУКА (с правильным классом "Heel")
    analyzeHeelCharacteristics(predictions) {
        const heels = predictions.filter(p => p.class === 'Heel');
        const toes = predictions.filter(p => p.class === 'Toe');
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
      
        if (heels.length === 0) {
            return {
                hasHeel: false,
                message: '👟 Без каблука',
                type: 'без каблука',
                count: 0
            };
        }
      
        // Определяем характеристики каблука
        const heelAnalysis = this.analyzeHeelDetails(heels, outlines, toes);
      
        return {
            hasHeel: true,
            count: heels.length,
            positions: heelAnalysis.positions,
            heightEstimation: heelAnalysis.heightEstimation,
            likelyGender: heelAnalysis.likelyGender,
            message: `👠 Каблук обнаружен (${heels.length}) - ${heelAnalysis.type}`,
            type: heelAnalysis.type,
            details: heelAnalysis
        };
    }

    // 🦶 ПРОВЕРКА МЫСОЧНОЙ ЧАСТИ ПРОТЕКТОРА
    checkForToe(predictions) {
        const toes = predictions.filter(p => p.class === 'Toe');
        return {
            hasToe: toes.length > 0,
            count: toes.length,
            message: toes.length > 0
                ? `🦶 Мысочная часть протектора (${toes.length})`
                : '🦶 Мысочная часть не выражена'
        };
    }

    // 🌊 ПРОВЕРКА ПОВОЛОКИ/ВЫВОЛОКИ (динамический рисунок края протектора)
    checkForGroundDisturbance(predictions) {
        const disturbances = predictions.filter(p => p.class === 'Dragged and dragged');
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
       
        return {
            hasDisturbance: disturbances.length > 0,
            count: disturbances.length,
            protectorRatio: protectors.length > 0 ? (disturbances.length / protectors.length).toFixed(2) : 0,
            message: disturbances.length > 0
                ? `🌊 Динамический рисунок по краям (${disturbances.length}) - выдавливание грунта`
                : '🌊 Четкие края без выдавливания грунта'
        };
    }

    // 🆕 АНАЛИЗ ВЗАИМОДЕЙСТВИЯ С ПОВЕРХНОСТЬЮ
    analyzeSurfaceInteraction(predictions) {
        const disturbances = this.checkForGroundDisturbance(predictions);
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
        const heels = predictions.filter(p => p.class === 'Heel');
        const toes = predictions.filter(p => p.class === 'Toe');
       
        const interactions = [];
       
        if (disturbances.hasDisturbance) {
            // Много выдавливаний - мягкий грунт или большой вес
            if (disturbances.count > 5) {
                interactions.push('интенсивное выдавливание грунта');
               
                // Если есть и каблук и мысок - вероятно полный отпечаток на мягкой поверхности
                if (heels.length > 0 && toes.length > 0) {
                    interactions.push('полный контакт с мягкой поверхностью');
                }
            } else {
                interactions.push('умеренное выдавливание грунта');
            }
        }
       
        // Анализ распределения протектора
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
        if (protectors.length > 0 && outlines.length > 0) {
            const protectorCount = protectors.length;
            const disturbanceCount = disturbances.count;
           
            // Если протекторов мало, но много выдавливаний - возможно проскальзывание
            if (protectorCount < 5 && disturbanceCount > 3) {
                interactions.push('возможно проскальзывание');
            }
           
            // Если протекторов много и мало выдавливаний - твердая поверхность
            if (protectorCount > 10 && disturbanceCount < 2) {
                interactions.push('твердая поверхность, четкий отпечаток');
            }
        }
       
        return interactions.length > 0 ? interactions : ['стандартное взаимодействие с поверхностью'];
    }

    // 🆕 АНАЛИЗ ДЕТАЛЕЙ КАБЛУКА
    analyzeHeelDetails(heels, outlines, toes = []) {
        if (outlines.length === 0) {
            return {
                positions: [],
                heightEstimation: 'неизвестно',
                likelyGender: 'неопределен',
                type: 'неизвестный тип каблука',
                toePresence: toes.length > 0
            };
        }
       
        const outline = outlines[0];
        const outlinePoints = outline.points;
       
        // Определяем размер контура
        const xs = outlinePoints.map(p => p.x);
        const ys = outlinePoints.map(p => p.y);
        const outlineWidth = Math.max(...xs) - Math.min(...xs);
        const outlineHeight = Math.max(...ys) - Math.min(...ys);
       
        // Анализируем каждый каблук
        const positions = heels.map(heel => {
            const heelPoints = heel.points;
            const heelXs = heelPoints.map(p => p.x);
            const heelYs = heelPoints.map(p => p.y);
            const heelWidth = Math.max(...heelXs) - Math.min(...heelXs);
            const heelHeight = Math.max(...heelYs) - Math.min(...heelYs);
           
            // Относительный размер каблука
            const relativeWidth = heelWidth / outlineWidth;
            const relativeHeight = heelHeight / outlineHeight;
           
            // Определяем тип каблука
            let type = 'стандартный';
            if (relativeWidth < 0.15) type = 'узкий';
            if (relativeWidth > 0.25) type = 'широкий';
            if (relativeHeight / relativeWidth > 2.5) type = 'высокий';
           
            // Определяем положение
            const heelCenter = this.getCenter(heelPoints);
            const outlineCenter = this.getCenter(outlinePoints);
            const distance = this.getDistance(heelCenter, outlineCenter);
            const position = distance < outlineWidth * 0.3 ? 'центральный' : 'задний';
           
            return {
                type: type,
                position: position,
                relativeWidth: Math.round(relativeWidth * 100),
                relativeHeight: Math.round(relativeHeight * 100),
                width: Math.round(heelWidth),
                height: Math.round(heelHeight),
                distanceFromCenter: Math.round(distance)
            };
        });
       
        // Анализируем общие характеристики
        const heelTypes = positions.map(p => p.type);
        const dominantType = this.getDominantType(heelTypes);
        const likelyGender = this.estimateGenderFromHeel(positions, toes.length);
       
        return {
            positions: positions,
            heightEstimation: this.estimateHeelHeight(positions),
            likelyGender: likelyGender,
            type: dominantType,
            toePresence: toes.length > 0,
            totalHeels: heels.length,
            totalToes: toes.length
        };
    }

    // 🆕 ОПРЕДЕЛЕНИЕ ТИПА КАБЛУКА
    determineHeelType(predictions) {
        const heels = predictions.filter(p => p.class === 'Heel');
        if (heels.length === 0) return 'без каблука';
       
        const heelAnalysis = this.analyzeHeelDetails(
            heels,
            predictions.filter(p => p.class === 'Outline-trail'),
            predictions.filter(p => p.class === 'Toe')
        );
       
        return heelAnalysis.type;
    }

    // 🆕 ОПРЕДЕЛЕНИЕ ДОМИНИРУЮЩЕГО ТИПА
    getDominantType(types) {
        const counts = {};
        types.forEach(type => {
            counts[type] = (counts[type] || 0) + 1;
        });
       
        let maxCount = 0;
        let dominant = 'стандартный';
       
        for (const [type, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                dominant = type;
            }
        }
       
        return dominant;
    }

    // 🆕 ОЦЕНКА ВЫСОТЫ КАБЛУКА
    estimateHeelHeight(heelPositions) {
        if (heelPositions.length === 0) return 'неизвестно';
       
        const avgHeight = heelPositions.reduce((sum, pos) => sum + pos.height, 0) / heelPositions.length;
       
        if (avgHeight < 30) return 'низкий (< 3 см)';
        if (avgHeight < 50) return 'средний (3-5 см)';
        if (avgHeight < 80) return 'высокий (5-8 см)';
        return 'очень высокий (> 8 см)';
    }

    // 🆕 ОЦЕНКА ПОЛА ПО КАБЛУКУ С УЧЕТОМ ПАЛЬЦЕВ
    estimateGenderFromHeel(heelPositions, toeCount) {
        if (heelPositions.length === 0) return 'неопределен';
       
        // Анализируем все каблуки
        const types = heelPositions.map(p => p.type);
        const heights = heelPositions.map(p => p.height);
        const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
       
        // Узкий и высокий каблук - вероятно женский
        const hasNarrow = types.includes('узкий');
        const hasHigh = types.includes('высокий');
        const hasWide = types.includes('широкий');
       
        // Женские признаки
        if (hasNarrow && avgHeight > 40) {
            return 'женский (узкий высокий каблук)';
        }
       
        // Широкий каблук - может быть мужским или женским на платформе
        if (hasWide) {
            if (avgHeight < 30) {
                return 'мужской (возможно)';
            } else if (avgHeight > 50) {
                return 'женский (платформа)';
            }
            return 'унисекс (широкий каблук)';
        }
       
        // Высокий каблук без узости
        if (hasHigh && avgHeight > 50) {
            return toeCount > 0 ? 'женский (с выраженной мысочной частью)' : 'женский (возможно)';
        }
       
        // Стандартный каблук с выраженной мысочной частью
        if (types.every(t => t === 'стандартный') && toeCount > 0) {
            return 'унисекс или спортивная обувь';
        }
       
        return 'пол определить сложно';
    }

    // 👣 АНАЛИЗ НЕСКОЛЬКИХ СЛЕДОВ
    countFootprints(predictions) {
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
        const distinctFootprints = this.separateFootprints(outlines);
      
        return {
            count: distinctFootprints.length,
            footprints: distinctFootprints.map(fp => ({
                completeness: this.calculateCompleteness(fp),
                orientation: this.calculateOrientation(fp)
            })),
            message: distinctFootprints.length > 1
                ? `👣 Несколько следов в кадре: ${distinctFootprints.length}`
                : '👣 Один след в кадре'
        };
    }

    // ПРОВЕРКА ПОЛНОТЫ СЛЕДА
    checkFootprintCompleteness(predictions) {
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
       
        if (outlines.length === 0) {
            return {
                isComplete: false,
                message: '❌ Контур следа не обнаружен'
            };
        }
       
        // Проверяем полноту каждого следа
        const completenessResults = outlines.map(outline => {
            const points = outline.points;
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const width = Math.max(...xs) - Math.min(...xs);
            const height = Math.max(...ys) - Math.min(...ys);
           
            // Считаем след полным если его размеры больше порога
            const isComplete = width > 150 && height > 300;
           
            return {
                isComplete: isComplete,
                width: Math.round(width),
                height: Math.round(height)
            };
        });
       
        const completeCount = completenessResults.filter(r => r.isComplete).length;
       
        return {
            isComplete: completeCount > 0,
            count: outlines.length,
            completeCount: completeCount,
            details: completenessResults,
            message: completeCount > 0
                ? `✅ Полных следов: ${completeCount} из ${outlines.length}`
                : `⚠️ Следы частичные или малого размера`
        };
    }

    // 💡 ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ ДЛЯ ПОИСКА (ОБНОВЛЕННАЯ)
    generatePSORecommendations(predictions) {
        const recommendations = [];
        const animalCheck = this.checkForAnimal(predictions);
        const heelCheck = this.analyzeHeelCharacteristics(predictions);
        const toeCheck = this.checkForToe(predictions);
        const disturbanceCheck = this.checkForGroundDisturbance(predictions);
        const footprintCheck = this.countFootprints(predictions);
        const completenessCheck = this.checkFootprintCompleteness(predictions);
        const heelType = this.determineHeelType(predictions);
        const surfaceInteraction = this.analyzeSurfaceInteraction(predictions);
      
        // 1. ИСКЛЮЧЕНИЕ ЖИВОТНЫХ
        if (animalCheck.hasAnimal) {
            recommendations.push(`🚫 ИСКЛЮЧИТЬ: ${animalCheck.message}`);
        }
      
        // 2. АНАЛИЗ КАБЛУКА
        if (heelCheck.hasHeel) {
            let heelMessage = `👠 ${heelCheck.message}`;
           
            // Добавляем детали в зависимости от типа
            if (heelType === 'узкий') {
                heelMessage += ' - узкий каблук';
                if (heelCheck.details.heightEstimation.includes('высокий')) {
                    heelMessage += ', вероятно женская обувь';
                }
            } else if (heelType === 'широкий') {
                heelMessage += ' - широкий каблук (платформа)';
                heelMessage += ', пол определить сложно';
            } else if (heelType === 'высокий') {
                heelMessage += ' - высокий каблук';
                heelMessage += ', чаще женская обувь';
            } else {
                heelMessage += ' - стандартный каблук';
            }
           
            recommendations.push(heelMessage);
        } else {
            recommendations.push('👟 Без каблука - возможно спортивная или повседневная обувь');
        }
       
        // 3. МЫСОЧНАЯ ЧАСТЬ
        if (toeCheck.hasToe) {
            recommendations.push(`🦶 ${toeCheck.message} - выраженная мысочная часть протектора`);
        }
       
        // 4. ДИНАМИЧЕСКИЙ РИСУНОК (ПОВОЛОКА/ВЫВОЛОКА)
        if (disturbanceCheck.hasDisturbance) {
            let disturbanceMessage = `🌊 ${disturbanceCheck.message}`;
           
            // Интерпретация для поисковиков
            if (disturbanceCheck.count > 3) {
                disturbanceMessage += ' - интенсивное выдавливание, возможно:';
                disturbanceMessage += '\n   • Мягкий/влажный грунт';
                disturbanceMessage += '\n   • Большой вес/давление';
                disturbanceMessage += '\n   • Резкое движение';
            } else {
                disturbanceMessage += ' - умеренное взаимодействие с поверхностью';
            }
           
            recommendations.push(disturbanceMessage);
        }
       
        // 5. ВЗАИМОДЕЙСТВИЕ С ПОВЕРХНОСТЬЮ
        if (surfaceInteraction.length > 0 && !surfaceInteraction.includes('стандартное взаимодействие с поверхностью')) {
            recommendations.push(`🏞️ Взаимодействие с поверхностью: ${surfaceInteraction.join(', ')}`);
        }
      
        // 6. НЕСКОЛЬКО СЛЕДОВ
        if (footprintCheck.count > 1) {
            recommendations.push(`👣 ${footprintCheck.message} - проверьте группировку`);
        }
       
        // 7. ПОЛНОТА СЛЕДА
        if (!completenessCheck.isComplete) {
            recommendations.push(completenessCheck.message);
        }
      
        // 8. КАЧЕСТВО АНАЛИЗА
        const detailCount = predictions.filter(p => p.class === 'shoe-protector').length;
        if (detailCount < 5) {
            recommendations.push('🔍 Мало деталей протектора - фото может быть нечетким');
        }
       
        // 9. ВАЖНОЕ ЗАМЕЧАНИЕ О ПОВОЛОКЕ
        if (disturbanceCheck.hasDisturbance && detailCount > 0) {
            const ratio = disturbanceCheck.protectorRatio;
            if (ratio > 0.5) {
                recommendations.push('⚠️ Много динамических элементов - не путать с деталями протектора!');
            }
        }
      
        return recommendations.length > 0 ? recommendations : ['✅ След пригоден для анализа'];
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    separateFootprints(outlines) {
        // Простая группировка по расстоянию
        if (outlines.length <= 1) return outlines;
      
        const groups = [];
        const used = new Set();
      
        outlines.forEach((outline, i) => {
            if (used.has(i)) return;
          
            const group = [outline];
            used.add(i);
          
            outlines.forEach((other, j) => {
                if (used.has(j) || i === j) return;
              
                const center1 = this.getCenter(outline.points);
                const center2 = this.getCenter(other.points);
                const distance = this.getDistance(center1, center2);
              
                if (distance < 100) { // Следы ближе 100px - одна группа
                    group.push(other);
                    used.add(j);
                }
            });
          
            groups.push(group);
        });
      
        return groups;
    }

    calculateCompleteness(footprint) {
        const points = Array.isArray(footprint)
            ? footprint.flatMap(f => f.points)
            : footprint.points;
      
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
      
        return width > 100 && height > 100 ? 'полный' : 'частичный';
    }

    calculateOrientation(footprint) {
        const points = Array.isArray(footprint)
            ? footprint.flatMap(f => f.points)
            : footprint.points;
      
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
      
        return width > height ? 'горизонтальный' : 'вертикальный';
    }

    // ОЦЕНКА ПОЛА (ОБНОВЛЕННАЯ)
    estimateGender(predictions) {
        const heelCheck = this.analyzeHeelCharacteristics(predictions);
        const toeCheck = this.checkForToe(predictions);
        const disturbanceCheck = this.checkForGroundDisturbance(predictions);
        const outlineCount = predictions.filter(p => p.class === 'Outline-trail').length;
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
      
        // Если есть анализ каблука - используем его
        if (heelCheck.hasHeel && heelCheck.likelyGender !== 'неопределен') {
            const genderText = heelCheck.likelyGender;
            let confidence = 0.6;
            if (genderText.includes('женский')) confidence = 0.7;
            if (genderText.includes('мужской')) confidence = 0.65;
           
            return {
                gender: genderText.split(' ')[0],
                confidence: confidence,
                reason: 'определено по характеристикам каблука'
            };
        }
       
        // Много выдавливаний + выраженная мысочная часть
        if (disturbanceCheck.count > 3 && toeCheck.hasToe) {
            return {
                gender: 'возможно активное движение',
                confidence: 0.5,
                reason: 'интенсивное выдавливание + выраженная мысочная часть'
            };
        }
      
        // Если много деталей протектора - возможно спортивная обувь
        if (protectors.length > 15) {
            return { gender: 'унисекс', confidence: 0.5, reason: 'спортивная обувь' };
        }
      
        // Если один след без каблука
        if (outlineCount === 1 && !heelCheck.hasHeel) {
            return { gender: 'неизвестно', confidence: 0.3, reason: 'мало данных' };
        }
      
        return { gender: 'неизвестно', confidence: 0.2, reason: 'недостаточно признаков' };
    }

    categorizeShoe(predictions) {
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
        const heelCheck = this.analyzeHeelCharacteristics(predictions);
        const heelType = this.determineHeelType(predictions);
        const toeCheck = this.checkForToe(predictions);
        const disturbanceCheck = this.checkForGroundDisturbance(predictions);
      
        // Определяем по каблуку
        if (heelCheck.hasHeel) {
            if (heelType === 'узкий') return 'обувь с узким каблуком';
            if (heelType === 'широкий') return 'обувь на платформе';
            if (heelType === 'высокий') return 'обувь с высоким каблуком';
            if (toeCheck.hasToe) return 'обувь с каблуком и выраженной мысочной частью';
            return 'обувь с каблуком';
        }
       
        // Если много динамических элементов
        if (disturbanceCheck.count > 5) {
            return 'обувь с интенсивным взаимодействием с поверхностью';
        }
       
        // Спортивная обувь
        if (protectors.length > 10) return 'спортивная обувь';
        if (protectors.length < 5) return 'легкая обувь';
       
        // С выраженной мысочной частью
        if (toeCheck.hasToe) return 'обувь с выраженной мысочной частью';
       
        return 'повседневная обувь';
    }

    findDistinctiveFeatures(predictions) {
        const features = [];
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
        const heelCheck = this.analyzeHeelCharacteristics(predictions);
        const toeCheck = this.checkForToe(predictions);
        const disturbanceCheck = this.checkForGroundDisturbance(predictions);
      
        // Основные признаки
        if (protectors.length > 15) features.push('плотный протектор');
        if (protectors.length < 5) features.push('мало деталей протектора');
       
        if (heelCheck.hasHeel) {
            features.push(`каблук: ${heelCheck.type}`);
            if (heelCheck.heightEstimation) {
                features.push(`высота каблука: ${heelCheck.heightEstimation}`);
            }
        }
       
        if (toeCheck.hasToe) {
            features.push('выраженная мысочная часть');
        }
       
        if (disturbanceCheck.hasDisturbance) {
            features.push('динамические элементы выдавливания');
            if (disturbanceCheck.count > 3) {
                features.push('интенсивное выдавливание грунта');
            }
        }
      
        // Необычные элементы
        const unusual = predictions.filter(p =>
            !['Outline-trail', 'shoe-protector', 'Heel', 'Animal', 'Toe', 'Dragged and dragged'].includes(p.class)
        );
      
        if (unusual.length > 0) features.push('необычные элементы');
      
        return features.length > 0 ? features : ['стандартный протектор'];
    }

    // 📐 ГЕОМЕТРИЧЕСКИЕ МЕТОДЫ
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

    getCentroid(points) {
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }
}

module.exports = { PracticalAnalyzer };

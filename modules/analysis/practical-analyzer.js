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
                hasHeel: this.analyzeHeelCharacteristics(predictions), // 🆕 ИЗМЕНЕНО
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
                heelType: this.determineHeelType(predictions) // 🆕 ДОБАВЛЕНО
            }
        };
      
        return analysis;
    }

    // 🐕 ФИЛЬТРАЦИЯ ЛАП ЖИВОТНЫХ (твой класс!)
    checkForAnimal(predictions) {
        const animalPaws = predictions.filter(p => p.class === 'animal-paw');
        return {
            hasAnimal: animalPaws.length > 0,
            count: animalPaws.length,
            message: animalPaws.length > 0
                ? `🚫 Обнаружены отпечатки лап животных (${animalPaws.length})`
                : '✅ Отпечатков животных нет'
        };
    }

    // 👠 АНАЛИЗ КАБЛУКА (расширенная версия)
    analyzeHeelCharacteristics(predictions) {
        const heels = predictions.filter(p => p.class === 'heel');
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
      
        if (heels.length === 0) {
            return {
                hasHeel: false,
                message: '👟 Без каблука',
                type: 'без каблука'
            };
        }
      
        // Определяем характеристики каблука
        const heelAnalysis = this.analyzeHeelDetails(heels, outlines);
      
        return {
            hasHeel: true,
            count: heels.length,
            positions: heelAnalysis.positions,
            heightEstimation: heelAnalysis.heightEstimation,
            likelyGender: heelAnalysis.likelyGender,
            message: `👠 Каблук обнаружен (${heels.length}) - ${heelAnalysis.type}`,
            type: heelAnalysis.type
        };
    }

    // 🆕 АНАЛИЗ ДЕТАЛЕЙ КАБЛУКА
    analyzeHeelDetails(heels, outlines) {
        if (outlines.length === 0) {
            return {
                positions: [],
                heightEstimation: 'неизвестно',
                likelyGender: 'неопределен',
                type: 'неизвестный тип каблука'
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
            if (relativeWidth < 0.1) type = 'шпилька';
            if (relativeWidth > 0.3) type = 'платформа';
            if (relativeHeight / relativeWidth > 3) type = 'высокий';
           
            // Определяем положение
            const heelCenter = this.getCenter(heelPoints);
            const outlineCenter = this.getCenter(outlinePoints);
            const distance = this.getDistance(heelCenter, outlineCenter);
            const position = distance < 50 ? 'центральный' : 'задний';
           
            return {
                type: type,
                position: position,
                relativeWidth: Math.round(relativeWidth * 100),
                relativeHeight: Math.round(relativeHeight * 100),
                width: Math.round(heelWidth),
                height: Math.round(heelHeight)
            };
        });
       
        // Анализируем общие характеристики
        const heelTypes = positions.map(p => p.type);
        const dominantType = this.getDominantType(heelTypes);
        const likelyGender = this.estimateGenderFromHeel(positions);
       
        return {
            positions: positions,
            heightEstimation: this.estimateHeelHeight(positions),
            likelyGender: likelyGender,
            type: dominantType
        };
    }

    // 🆕 ОПРЕДЕЛЕНИЕ ТИПА КАБЛУКА
    determineHeelType(predictions) {
        const heels = predictions.filter(p => p.class === 'heel');
        if (heels.length === 0) return 'без каблука';
       
        const heelAnalysis = this.analyzeHeelDetails(heels,
            predictions.filter(p => p.class === 'Outline-trail'));
       
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

    // 🆕 ОЦЕНКА ПОЛА ПО КАБЛУКУ (БОЛЕЕ ТОЧНАЯ)
    estimateGenderFromHeel(heelPositions) {
        if (heelPositions.length === 0) return 'неопределен';
       
        // Анализируем все каблуки
        const types = heelPositions.map(p => p.type);
        const heights = heelPositions.map(p => p.height);
       
        // Правила определения
        const hasSpike = types.includes('шпилька');
        const hasPlatform = types.includes('платформа');
        const hasHigh = types.includes('высокий');
        const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
       
        // Женские признаки
        if (hasSpike) return 'женский (высокая вероятность)';
        if (hasPlatform && avgHeight > 40) return 'женский';
        if (hasHigh && avgHeight > 50) return 'женский';
       
        // Мужские признаки
        if (types.every(t => t === 'стандартный') && avgHeight < 30) {
            return 'мужской (возможно)';
        }
       
        // Нейтральные/унисекс
        return 'унисекс или спортивная обувь';
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
        const footprintCheck = this.countFootprints(predictions);
        const completenessCheck = this.checkFootprintCompleteness(predictions);
        const heelType = this.determineHeelType(predictions);
      
        // 1. ИСКЛЮЧЕНИЕ ЖИВОТНЫХ
        if (animalCheck.hasAnimal) {
            recommendations.push(`🚫 ИСКЛЮЧИТЬ: ${animalCheck.message}`);
        }
      
        // 2. АНАЛИЗ КАБЛУКА (более точный)
        if (heelCheck.hasHeel) {
            let heelMessage = `👠 ${heelCheck.message}`;
           
            // Добавляем детали в зависимости от типа
            if (heelType === 'шпилька') {
                heelMessage += ' - характерно для женской вечерней обуви';
            } else if (heelType === 'платформа') {
                heelMessage += ' - может быть как мужской, так и женской обувью';
            } else if (heelType === 'высокий') {
                heelMessage += ' - чаще женская обувь, но возможна и мужская';
            } else {
                heelMessage += ' - стандартный каблук, пол определить сложно';
            }
           
            recommendations.push(heelMessage);
        } else {
            recommendations.push('👟 Без каблука - возможно спортивная или повседневная обувь');
        }
      
        // 3. НЕСКОЛЬКО СЛЕДОВ
        if (footprintCheck.count > 1) {
            recommendations.push(`👣 ${footprintCheck.message} - проверьте группировку`);
        }
       
        // 4. ПОЛНОТА СЛЕДА
        if (!completenessCheck.isComplete) {
            recommendations.push(completenessCheck.message);
        }
      
        // 5. КАЧЕСТВО АНАЛИЗА
        const detailCount = predictions.filter(p => p.class === 'shoe-protector').length;
        if (detailCount < 5) {
            recommendations.push('🔍 Мало деталей протектора - фото может быть нечетким');
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
        const outlineCount = predictions.filter(p => p.class === 'Outline-trail').length;
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
      
        // Если есть анализ каблука - используем его
        if (heelCheck.hasHeel && heelCheck.likelyGender !== 'неопределен') {
            const confidence = heelCheck.type === 'шпилька' ? 0.9 : 0.6;
            return {
                gender: heelCheck.likelyGender.split(' ')[0], // берем только первое слово
                confidence: confidence,
                reason: 'определено по характеристикам каблука'
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
      
        if (heelCheck.hasHeel) {
            if (heelType === 'шпилька') return 'женская вечерняя обувь';
            if (heelType === 'платформа') return 'обувь на платформе';
            if (heelType === 'высокий') return 'обувь с высоким каблуком';
            return 'обувь с каблуком';
        }
       
        if (protectors.length > 10) return 'спортивная обувь';
        if (protectors.length < 5) return 'легкая обувь';
        return 'повседневная обувь';
    }

    findDistinctiveFeatures(predictions) {
        const features = [];
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
        const heelCheck = this.analyzeHeelCharacteristics(predictions);
      
        if (protectors.length > 15) features.push('плотный протектор');
        if (protectors.length < 5) features.push('мало деталей протектора');
       
        if (heelCheck.hasHeel) {
            features.push(`каблук: ${heelCheck.type}`);
            if (heelCheck.heightEstimation) {
                features.push(`высота: ${heelCheck.heightEstimation}`);
            }
        }
      
        const unusual = predictions.filter(p =>
            !['Outline-trail', 'shoe-protector', 'heel', 'animal-paw'].includes(p.class)
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

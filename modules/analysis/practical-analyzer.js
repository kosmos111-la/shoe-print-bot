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
                hasHeel: this.checkForHeel(predictions),
                footprintCount: this.countFootprints(predictions),
                isComplete: this.isFootprintComplete(predictions)
            },
          
            // 🎯 РЕКОМЕНДАЦИИ ДЛЯ СЛЕДОПЫТА
            recommendations: this.generatePSORecommendations(predictions),
          
            // 📊 ПРАКТИЧЕСКИЕ ВЫВОДЫ
            practicalInsights: {
                likelyGender: this.estimateGender(predictions),
                shoeCategory: this.categorizeShoe(predictions),
                distinctiveFeatures: this.findDistinctiveFeatures(predictions)
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

    // 👠 АНАЛИЗ КАБЛУКА (твой класс!)
    checkForHeel(predictions) {
        const heels = predictions.filter(p => p.class === 'heel');
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
      
        if (heels.length === 0) return { hasHeel: false, message: '👟 Без каблука' };
      
        // Определяем положение каблука относительно контура
        const heelPositions = this.analyzeHeelPosition(heels, outlines);
      
        return {
            hasHeel: true,
            count: heels.length,
            positions: heelPositions,
            message: `👠 Каблук обнаружен (${heels.length})`
        };
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

    // 💡 ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ ДЛЯ ПОИСКА
    generatePSORecommendations(predictions) {
        const recommendations = [];
        const animalCheck = this.checkForAnimal(predictions);
        const heelCheck = this.checkForHeel(predictions);
        const footprintCheck = this.countFootprints(predictions);
      
        // 1. ИСКЛЮЧЕНИЕ ЖИВОТНЫХ
        if (animalCheck.hasAnimal) {
            recommendations.push(`🚫 ИСКЛЮЧИТЬ: ${animalCheck.message}`);
        }
      
        // 2. ПРИЗНАК КАБЛУКА
        if (heelCheck.hasHeel) {
            recommendations.push(`👠 ${heelCheck.message} - характерно для женской обуви`);
        } else {
            recommendations.push('👟 Без каблука - возможно мужская/спортивная обувь');
        }
      
        // 3. НЕСКОЛЬКО СЛЕДОВ
        if (footprintCheck.count > 1) {
            recommendations.push(`👣 ${footprintCheck.message} - проверьте группировку`);
        }
      
        // 4. КАЧЕСТВО АНАЛИЗА
        const detailCount = predictions.filter(p => p.class === 'shoe-protector').length;
        if (detailCount < 5) {
            recommendations.push('🔍 Мало деталей протектора - фото может быть нечетким');
        }
      
        return recommendations.length > 0 ? recommendations : ['✅ След пригоден для анализа'];
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    analyzeHeelPosition(heels, outlines) {
        if (outlines.length === 0) return [];
      
        const outlineCenter = this.getCentroid(outlines.flatMap(o => o.points));
        return heels.map(heel => {
            const heelCenter = this.getCenter(heel.points);
            const distance = this.getDistance(heelCenter, outlineCenter);
            return {
                relativePosition: distance < 50 ? 'center' : 'edge',
                distance: Math.round(distance)
            };
        });
    }

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

    estimateGender(predictions) {
        const hasHeel = predictions.some(p => p.class === 'heel');
        const outlineCount = predictions.filter(p => p.class === 'Outline-trail').length;
      
        if (hasHeel) return { gender: 'женский', confidence: 0.7 };
        if (outlineCount > 1) return { gender: 'неизвестно', confidence: 0.3 };
        return { gender: 'мужской', confidence: 0.5 };
    }

    categorizeShoe(predictions) {
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
        const hasHeel = predictions.some(p => p.class === 'heel');
      
        if (hasHeel) return 'обувь с каблуком';
        if (protectors.length > 10) return 'спортивная обувь';
        if (protectors.length < 5) return 'легкая обувь';
        return 'повседневная обувь';
    }

    findDistinctiveFeatures(predictions) {
        const features = [];
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
      
        if (protectors.length > 15) features.push('плотный протектор');
        if (protectors.length < 5) features.push('мало деталей протектора');
      
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

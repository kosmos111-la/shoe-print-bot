// modules/session/session-analyzer.js
class SessionAnalyzer {
    constructor() {
        console.log('🔍 SessionAnalyzer: анализатор сессий');
    }

    analyzeSession(session) {
        const results = {
            peopleCount: this.countDifferentPeople(session),
            movementAnalysis: this.analyzeMovement(session),
            shoeReconstruction: this.reconstructShoes(session),
            timeline: this.buildTimeline(session),
            anomalies: this.findAnomalies(session)
        };
       
        return results;
    }

    countDifferentPeople(session) {
        // Анализируем разные типы следов
        const shoePatterns = new Set();
       
        session.analysisResults.forEach(analysis => {
            if (analysis.intelligentAnalysis?.summary?.footprintType) {
                shoePatterns.add(analysis.intelligentAnalysis.summary.footprintType);
            }
           
            // Анализ протекторов
            const protectors = analysis.predictions?.filter(p => p.class === 'shoe-protector') || [];
            if (protectors.length > 0) {
                // Создаем "отпечаток" протектора
                const patternHash = this.createPatternHash(protectors);
                shoePatterns.add(patternHash);
            }
        });
       
        return {
            estimatedCount: Math.max(1, shoePatterns.size),
            confidence: shoePatterns.size > 1 ? 0.8 : 0.5,
            patterns: Array.from(shoePatterns)
        };
    }

    analyzeMovement(session) {
        // Если есть геометка в фото
        const photosWithLocation = session.photos.filter(p => p.location);
       
        if (photosWithLocation.length < 2) {
            return { available: false, message: "Недостаточно геоданных" };
        }
       
        // Строим маршрут
        const path = photosWithLocation.map(p => p.location);
        const totalDistance = this.calculatePathDistance(path);
        const direction = this.calculateAverageDirection(path);
       
        return {
            available: true,
            path: path,
            totalDistance: totalDistance,
            direction: direction,
            estimatedSpeed: this.estimateSpeed(session, totalDistance)
        };
    }

    reconstructShoes(session) {
        // Группируем похожие следы
        const footprints = session.analysisResults
            .filter(a => a.predictions?.some(p => p.class === 'Outline-trail'))
            .map(a => ({
                footprint: a,
                type: a.intelligentAnalysis?.summary?.footprintType,
                size: a.intelligentAnalysis?.summary?.sizeEstimation,
                orientation: a.intelligentAnalysis?.summary?.orientation
            }));
       
        // Группировка по типу обуви
        const groups = {};
        footprints.forEach(fp => {
            const key = `${fp.type}_${fp.size}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(fp);
        });
       
        // Для каждой группы создаем "супер-след"
        const reconstructions = Object.entries(groups).map(([type, groupFootprints]) => {
            return this.createSuperFootprint(groupFootprints);
        });
       
        return {
            reconstructions: reconstructions,
            totalGroups: Object.keys(groups).length
        };
    }

    createSuperFootprint(footprints) {
        // Объединяем данные из нескольких следов
        const avgSize = this.calculateAverageSize(footprints);
        const avgOrientation = this.calculateAverageOrientation(footprints);
        const compositePattern = this.createCompositePattern(footprints);
       
        return {
            estimatedSize: avgSize,
            orientation: avgOrientation,
            pattern: compositePattern,
            confidence: footprints.length > 2 ? 0.9 : 0.7,
            sampleCount: footprints.length
        };
    }

    createCompositePattern(footprints) {
        // Собираем ВСЕ протекторы со всех следов группы
        const allProtectors = footprints.flatMap(fp =>
            fp.footprint.predictions?.filter(p => p.class === 'shoe-protector') || []
        );
       
        // Создаем "идеализированный" паттерн
        return {
            totalProtectors: allProtectors.length,
            density: allProtectors.length / footprints.length,
            patternType: this.classifyPattern(allProtectors),
            uniqueFeatures: this.extractUniqueFeatures(allProtectors)
        };
    }

    buildTimeline(session) {
        // Восстанавливаем хронологию
        const events = session.photos.map((photo, index) => ({
            time: photo.timestamp,
            sequence: index + 1,
            analysis: session.analysisResults[index] || null,
            estimatedTimeBetween: index > 0 ?
                (photo.timestamp - session.photos[index-1].timestamp) / 1000 :
                null
        }));
       
        return {
            events: events,
            totalDuration: session.endTime ?
                (session.endTime - session.startTime) / 1000 :
                (new Date() - session.startTime) / 1000,
            averageInterval: this.calculateAverageInterval(events)
        };
    }

    findAnomalies(session) {
        const anomalies = [];
       
        // 1. Разные направления в одной сессии
        const orientations = session.analysisResults
            .map(a => a.intelligentAnalysis?.summary?.orientation)
            .filter(Boolean);
       
        if (orientations.length > 1) {
            const maxDiff = this.maxOrientationDifference(orientations);
            if (maxDiff > 45) {
                anomalies.push({
                    type: "direction_change",
                    message: "Резкая смена направления движения",
                    confidence: 0.7
                });
            }
        }
       
        // 2. Внезапное появление нового типа обуви
        // 3. Необычные промежутки между следами
        // 4. Аномалии в размерах
       
        return anomalies;
    }

    // 🔧 Вспомогательные методы
    createPatternHash(protectors) {
        // Создаем уникальный хеш паттерна протектора
        const centers = protectors.map(p => this.getCenter(p.points));
        const centroid = this.getCentroid(centers);
        const distances = centers.map(c => this.getDistance(c, centroid));
       
        // Сортируем расстояния и берем первые 5
        const sorted = distances.sort((a, b) => a - b).slice(0, 5);
        return sorted.map(d => Math.round(d)).join('-');
    }

    calculatePathDistance(path) {
        let total = 0;
        for (let i = 1; i < path.length; i++) {
            total += this.getDistance(path[i-1], path[i]);
        }
        return total;
    }

    calculateAverageDirection(path) {
        if (path.length < 2) return null;
       
        const first = path[0];
        const last = path[path.length - 1];
       
        const dx = last.lon - first.lon;
        const dy = last.lat - first.lat;
       
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    estimateSpeed(session, distance) {
        if (!session.endTime || distance === 0) return null;
       
        const duration = (session.endTime - session.startTime) / 1000 / 3600; // в часах
        return distance / duration; // км/ч
    }

    calculateAverageSize(footprints) {
        const sizes = footprints.map(fp => {
            const sizeText = fp.size || "";
            const match = sizeText.match(/\d+/);
            return match ? parseInt(match[0]) : null;
        }).filter(Boolean);
       
        if (sizes.length === 0) return "неизвестно";
       
        const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
        return Math.round(avg);
    }

    calculateAverageOrientation(footprints) {
        const orientations = footprints
            .map(fp => {
                const match = fp.orientation?.match(/(\d+\.?\d*)/);
                return match ? parseFloat(match[1]) : null;
            })
            .filter(Boolean);
       
        if (orientations.length === 0) return "0°";
       
        // Усреднение углов
        const sinSum = orientations.reduce((sum, angle) => sum + Math.sin(angle * Math.PI / 180), 0);
        const cosSum = orientations.reduce((sum, angle) => sum + Math.cos(angle * Math.PI / 180), 0);
        const avgAngle = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
       
        return `${Math.round(avgAngle)}°`;
    }

    classifyPattern(protectors) {
        const count = protectors.length;
        if (count > 20) return "очень плотный";
        if (count > 10) return "плотный";
        if (count > 5) return "средний";
        return "редкий";
    }

    extractUniqueFeatures(protectors) {
        const features = [];
       
        // Анализ формы протекторов
        const areas = protectors.map(p => this.calculateArea(p.points));
        const avgArea = areas.reduce((a, b) => a + b, 0) / areas.length;
       
        if (avgArea > 500) features.push("крупные элементы");
        if (avgArea < 100) features.push("мелкие элементы");
       
        // Анализ распределения
        const centers = protectors.map(p => this.getCenter(p.points));
        const clusterAnalysis = this.analyzeClusters(centers);
       
        if (clusterAnalysis.clusters > 1) {
            features.push(`распределен по ${clusterAnalysis.clusters} зонам`);
        }
       
        return features;
    }

    calculateAverageInterval(events) {
        const intervals = events
            .map(e => e.estimatedTimeBetween)
            .filter(Boolean);
       
        if (intervals.length === 0) return null;
       
        return intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    maxOrientationDifference(orientations) {
        let maxDiff = 0;
        for (let i = 0; i < orientations.length; i++) {
            for (let j = i + 1; j < orientations.length; j++) {
                const diff = Math.abs(orientations[i] - orientations[j]);
                maxDiff = Math.max(maxDiff, diff);
            }
        }
        return maxDiff;
    }

    analyzeClusters(points) {
        if (points.length < 3) return { clusters: 1, separation: "low" };
       
        // Простая кластеризация по расстоянию
        const clusters = [];
        const visited = new Set();
       
        for (let i = 0; i < points.length; i++) {
            if (visited.has(i)) continue;
           
            const cluster = [points[i]];
            visited.add(i);
           
            for (let j = 0; j < points.length; j++) {
                if (visited.has(j)) continue;
               
                const distance = this.getDistance(points[i], points[j]);
                if (distance < 100) { // 100px - порог кластера
                    cluster.push(points[j]);
                    visited.add(j);
                }
            }
           
            clusters.push(cluster);
        }
       
        return {
            clusters: clusters.length,
            sizes: clusters.map(c => c.length),
            separation: clusters.length > 1 ? "high" : "low"
        };
    }

    // 📐 Геометрические утилиты
    getCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    getCentroid(points) {
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    getDistance(p1, p2) {
        if (p1.lat && p1.lon) {
            // Географическое расстояние (упрощенное)
            const R = 6371; // радиус Земли в км
            const dLat = (p2.lat - p1.lat) * Math.PI / 180;
            const dLon = (p2.lon - p1.lon) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c * 1000; // в метрах
        } else {
            // Евклидово расстояние в пикселях
            return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }
    }

    calculateArea(points) {
        if (points.length < 3) return 0;
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
       
        return width * height;
    }
}

module.exports = { SessionAnalyzer };

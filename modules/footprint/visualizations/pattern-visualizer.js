// modules/footprint/visualizations/pattern-visualizer.js
// 🎯 ВИЗУАЛИЗАЦИЯ СРАВНЕНИЯ ПАТТЕРНОВ (решение проблемы поворота)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PatternVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/patterns',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 900,
            debug: options.debug || true,
            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 PatternVisualizer создан (сравнение паттернов)');
    }

    // 🎯 ОСНОВНОЙ МЕТОД: Визуализировать сравнение паттернов
    async visualizePatternComparison(footprint1, footprint2, matchingPatterns, options = {}) {
        console.log(`🎨 Визуализирую сравнение ${matchingPatterns?.length || 0} паттернов...`);

        try {
            // Получаем паттерны из следов (если не переданы)
            const patterns1 = footprint1.getInvariantFeatures ? footprint1.getInvariantFeatures() : [];
            const patterns2 = footprint2.getInvariantFeatures ? footprint2.getInvariantFeatures() : [];

            const effectivePatterns = matchingPatterns || this.findMatchingPatterns(patterns1, patterns2);

            console.log(`📊 Статистика паттернов:`);
            console.log(`   След 1: ${patterns1.length} паттернов`);
            console.log(`   След 2: ${patterns2.length} паттернов`);
            console.log(`   Совпало: ${effectivePatterns.length} паттернов`);

            if (effectivePatterns.length === 0) {
                console.log('⚠️ Нет совпадающих паттернов для визуализации');
                return this.createNoPatternsReport(footprint1, footprint2);
            }

            // Создаем визуализацию
            const result = await this.createPatternVisualization(
                footprint1, footprint2,
                patterns1, patterns2,
                effectivePatterns,
                options
            );

            return result;

        } catch (error) {
            console.error('❌ Ошибка визуализации паттернов:', error);
            return this.createFallbackPatternReport(footprint1, footprint2, matchingPatterns);
        }
    }

    // 🎯 СОЗДАНИЕ ВИЗУАЛИЗАЦИИ ПАТТЕРНОВ
    async createPatternVisualization(footprint1, footprint2, patterns1, patterns2, matchingPatterns, options = {}) {
        let canvas;
        try {
            canvas = require('canvas');
        } catch (error) {
            console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
            return this.createTextPatternReport(footprint1, footprint2, matchingPatterns);
        }

        const canvasWidth = options.width || this.config.canvasWidth;
        const canvasHeight = options.height || this.config.canvasHeight;

        const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
        const ctx = canvasInstance.getContext('2d');

        // 1. ФОН
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. ЗАГОЛОВОК
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎯 СРАВНЕНИЕ ПАТТЕРНОВ (не зависящее от поворота)', canvasWidth / 2, 50);

        // 3. ИНФОРМАЦИЯ О СЛЕДАХ
        ctx.font = '16px Arial';
        ctx.fillStyle = '#495057';
        ctx.textAlign = 'center';

        const name1 = footprint1.name || 'След 1';
        const name2 = footprint2.name || 'След 2';

        ctx.fillText(`${name1} vs ${name2}`, canvasWidth / 2, 85);

        // 🔥 ИНФОРМАЦИЯ О ПОВОРОТАХ
        const trans1 = footprint1.getTransformation ? footprint1.getTransformation() : null;
        const trans2 = footprint2.getTransformation ? footprint2.getTransformation() : null;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#6C757D';

        if (trans1) {
            ctx.fillText(`📐 ${name1}: ${trans1.rotationAngle?.toFixed(1)}°`, canvasWidth / 4, 110);
        }
        if (trans2) {
            ctx.fillText(`📐 ${name2}: ${trans2.rotationAngle?.toFixed(1)}°`, canvasWidth * 3/4, 110);
        }

        // 4. СТАТИСТИКА ПАТТЕРНОВ
        const totalPatterns = Math.max(patterns1.length, patterns2.length);
        const matchRate = matchingPatterns.length / totalPatterns;
        const similarity = matchRate;

        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#28A745';
        ctx.textAlign = 'center';
        ctx.fillText(`СХОЖЕСТЬ: ${(similarity * 100).toFixed(1)}%`, canvasWidth / 2, 150);

        ctx.font = '14px Arial';
        ctx.fillStyle = '#6C757D';
        ctx.fillText(`Совпало паттернов: ${matchingPatterns.length} из ${totalPatterns}`, canvasWidth / 2, 175);

        // 5. ТИПЫ ПАТТЕРНОВ
        const patternTypes = this.analyzePatternTypes(matchingPatterns);
       
        let yPos = 200;
        ctx.fillStyle = '#495057';
        ctx.textAlign = 'left';
        ctx.fillText('📊 ТИПЫ СОВПАВШИХ ПАТТЕРНОВ:', 50, yPos);
        yPos += 25;

        patternTypes.forEach((type, index) => {
            const x = 70 + (index % 2) * (canvasWidth / 2 - 100);
            const y = yPos + Math.floor(index / 2) * 25;

            // Иконка паттерна
            ctx.fillStyle = type.color;
            ctx.beginPath();
            ctx.arc(x, y + 5, 8, 0, Math.PI * 2);
            ctx.fill();

            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.fillText(`${type.name}: ${type.count} (${type.confidence}%)`, x + 15, y + 9);
        });

        // 6. РАЗДЕЛИТЕЛЬНАЯ ЛИНИЯ
        yPos += Math.ceil(patternTypes.length / 2) * 25 + 20;
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, yPos);
        ctx.lineTo(canvasWidth - 50, yPos);
        ctx.stroke();

        // 7. ВИЗУАЛИЗАЦИЯ ПАТТЕРНОВ
        yPos += 20;
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🔍 ПРИМЕРЫ СОВПАВШИХ ПАТТЕРНОВ (первые 6):', 50, yPos);
        yPos += 30;

        // Отображаем примеры паттернов
        const examples = matchingPatterns.slice(0, 6);
        this.drawPatternExamples(ctx, examples, yPos, canvasWidth);

        // 8. ЛЕГЕНДА
        this.drawPatternLegend(ctx, canvasWidth, canvasHeight);

        // 9. ИНФОРМАЦИЯ О МЕТОДЕ
        ctx.fillStyle = '#ADB5BD';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Метод сравнения: инвариантные паттерны (не зависит от поворота, масштаба, положения)',
                     canvasWidth / 2, canvasHeight - 25);
        ctx.fillText(`Визуализация создана: ${new Date().toLocaleString('ru-RU')}`,
                     canvasWidth / 2, canvasHeight - 10);

        // 10. СОХРАНЯЕМ
        const filename = options.filename || `patterns_${footprint1.id}_${footprint2.id}_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvasInstance.createPNGStream();

            stream.pipe(out);

            out.on('finish', () => {
                console.log(`✅ Визуализация паттернов сохранена: ${outputPath}`);
                resolve({
                    path: outputPath,
                    success: true,
                    similarity: similarity,
                    matchingPatterns: matchingPatterns.length,
                    totalPatterns: totalPatterns,
                    method: 'pattern_based'
                });
            });

            out.on('error', reject);
        });
    }

    // 🎯 РИСОВАНИЕ ПРИМЕРОВ ПАТТЕРНОВ
    drawPatternExamples(ctx, patterns, startY, canvasWidth) {
        const examplesPerRow = 3;
        const exampleWidth = (canvasWidth - 100) / examplesPerRow;
        const exampleHeight = 120;

        patterns.forEach((pattern, index) => {
            const row = Math.floor(index / examplesPerRow);
            const col = index % examplesPerRow;

            const x = 50 + col * exampleWidth;
            const y = startY + row * (exampleHeight + 20);

            this.drawSinglePattern(ctx, pattern, x, y, exampleWidth - 20, exampleHeight);
        });
    }

    // 🎯 РИСОВАНИЕ ОДНОГО ПАТТЕРНА
    drawSinglePattern(ctx, pattern, x, y, width, height) {
        // Фон паттерна
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Заголовок паттерна
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${pattern.type || 'Паттерн'} (${pattern.confidence}%)`, x + width/2, y + 15);

        // Информация о паттерне
        ctx.font = '10px Arial';
        ctx.fillStyle = '#6C757D';
       
        const infoLines = [
            `Точек: ${pattern.pointCount || '?'}`,
            `Углы: ${pattern.angles || '?'}`,
            `Расстояния: ${pattern.distances || '?'}`
        ];

        infoLines.forEach((line, i) => {
            ctx.fillText(line, x + width/2, y + 35 + i * 12);
        });

        // Графическое представление паттерна
        const centerX = x + width/2;
        const centerY = y + height - 40;
        const radius = 25;

        // Центральная точка
        ctx.fillStyle = pattern.confidence > 0.8 ? '#28A745' :
                       pattern.confidence > 0.5 ? '#FFC107' : '#DC3545';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Соседние точки
        const neighborCount = pattern.neighborCount || 3;
        for (let i = 0; i < neighborCount; i++) {
            const angle = (i * (2 * Math.PI)) / neighborCount;
            const nx = centerX + radius * Math.cos(angle);
            const ny = centerY + radius * Math.sin(angle);

            ctx.fillStyle = '#2196F3';
            ctx.beginPath();
            ctx.arc(nx, ny, 4, 0, Math.PI * 2);
            ctx.fill();

            // Линия к центру
            ctx.strokeStyle = 'rgba(33, 150, 243, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(nx, ny);
            ctx.stroke();
        }
    }

    // 🎯 АНАЛИЗ ТИПОВ ПАТТЕРНОВ
    analyzePatternTypes(patterns) {
        const types = {
            triangle: { name: 'Треугольник', count: 0, confidence: 0, color: '#FF5252' },
            line: { name: 'Линия', count: 0, confidence: 0, color: '#2196F3' },
            cluster: { name: 'Кластер', count: 0, confidence: 0, color: '#4CAF50' },
            corner: { name: 'Угол', count: 0, confidence: 0, color: '#FF9800' },
            other: { name: 'Другие', count: 0, confidence: 0, color: '#9C27B0' }
        };

        patterns.forEach(pattern => {
            const type = pattern.type || 'other';
            if (types[type]) {
                types[type].count++;
                types[type].confidence = (types[type].confidence + pattern.confidence) / 2;
            } else {
                types.other.count++;
                types.other.confidence = (types.other.confidence + pattern.confidence) / 2;
            }
        });

        // Фильтруем и форматируем
        return Object.values(types)
            .filter(t => t.count > 0)
            .map(t => ({
                ...t,
                confidence: (t.confidence * 100).toFixed(1)
            }));
    }

    // 🎯 ЛЕГЕНДА ПАТТЕРНОВ
    drawPatternLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 150;
        const startX = canvasWidth * 0.1;

        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 120);

        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 120);

        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА ПАТТЕРНОВ', startX, legendY);

        // Элементы
        const legendItems = [
            { color: '#FF5252', text: '🔺 Треугольник - 3 точки, стабильные углы' },
            { color: '#2196F3', text: '📏 Линия - коллинеарные точки' },
            { color: '#4CAF50', text: '🔴 Кластер - плотная группа точек' },
            { color: '#FF9800', text: '📐 Угол - L-образная конфигурация' },
            { color: '#28A745', text: '✅ Высокая уверенность (>80%)' },
            { color: '#FFC107', text: '⚠️ Средняя уверенность (50-80%)' },
            { color: '#DC3545', text: '❌ Низкая уверенность (<50%)' }
        ];

        legendItems.forEach((item, index) => {
            const x = startX + (index % 2) * (canvasWidth * 0.4);
            const y = legendY + 20 + Math.floor(index / 2) * 25;

            // Цветной кружок
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 10, y + 5, 6, 0, Math.PI * 2);
            ctx.fill();

            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.fillText(item.text, x + 25, y + 8);
        });
    }

    // 🎯 ПОИСК СОВПАДАЮЩИХ ПАТТЕРНОВ
    findMatchingPatterns(patterns1, patterns2, threshold = 0.7) {
        console.log(`🔍 Ищу совпадающие паттерны (порог: ${threshold})...`);

        const matches = [];

        patterns1.forEach((pattern1, i) => {
            let bestMatch = null;
            let bestScore = 0;

            patterns2.forEach((pattern2, j) => {
                const score = this.comparePatterns(pattern1, pattern2);
               
                if (score > bestScore && score >= threshold) {
                    bestScore = score;
                    bestMatch = {
                        pattern1: pattern1,
                        pattern2: pattern2,
                        score: score,
                        pattern1Index: i,
                        pattern2Index: j
                    };
                }
            });

            if (bestMatch) {
                matches.push({
                    ...bestMatch,
                    type: this.classifyPattern(bestMatch.pattern1),
                    confidence: bestScore,
                    pointCount: bestMatch.pattern1.points?.length || 3,
                    neighborCount: bestMatch.pattern1.neighbors?.length || 3
                });
            }
        });

        // Убираем дубликаты
        const uniqueMatches = [];
        const usedIndices2 = new Set();

        matches.sort((a, b) => b.score - a.score).forEach(match => {
            if (!usedIndices2.has(match.pattern2Index)) {
                uniqueMatches.push(match);
                usedIndices2.add(match.pattern2Index);
            }
        });

        console.log(`✅ Найдено ${uniqueMatches.length} уникальных совпадений`);
        return uniqueMatches;
    }

    // 🎯 СРАВНЕНИЕ ДВУХ ПАТТЕРНОВ
    comparePatterns(pattern1, pattern2) {
        if (!pattern1 || !pattern2) return 0;

        let totalScore = 0;
        let weightSum = 0;

        // 1. Сравнение углов (важнейший признак, инвариантен к повороту)
        if (pattern1.angles && pattern2.angles) {
            const angleScore = this.compareAngles(pattern1.angles, pattern2.angles);
            totalScore += angleScore * 0.4;
            weightSum += 0.4;
        }

        // 2. Сравнение относительных расстояний (инвариантно к масштабу)
        if (pattern1.distances && pattern2.distances) {
            const distanceScore = this.compareDistances(pattern1.distances, pattern2.distances);
            totalScore += distanceScore * 0.3;
            weightSum += 0.3;
        }

        // 3. Сравнение топологии (количество соседей, связи)
        if (pattern1.topology && pattern2.topology) {
            const topologyScore = this.compareTopology(pattern1.topology, pattern2.topology);
            totalScore += topologyScore * 0.2;
            weightSum += 0.2;
        }

        // 4. Сравнение конфигурации (тип паттерна)
        if (pattern1.config && pattern2.config) {
            const configScore = pattern1.config === pattern2.config ? 1.0 : 0.5;
            totalScore += configScore * 0.1;
            weightSum += 0.1;
        }

        return weightSum > 0 ? totalScore / weightSum : 0;
    }

    // 🎯 СРАВНЕНИЕ УГЛОВ (циклическое, инвариантно к повороту)
    compareAngles(angles1, angles2) {
        if (!angles1 || !angles2 || angles1.length !== angles2.length) return 0;

        // Нормализуем углы (сортировка + циклический сдвиг)
        const sorted1 = [...angles1].sort((a, b) => a - b);
        const sorted2 = [...angles2].sort((a, b) => a - b);

        let bestMatch = 0;
        const n = sorted1.length;

        // Пробуем все циклические сдвиги
        for (let shift = 0; shift < n; shift++) {
            let match = 0;
            for (let i = 0; i < n; i++) {
                const angle1 = sorted1[i];
                const angle2 = sorted2[(i + shift) % n];
                const diff = Math.abs(angle1 - angle2);
                const normalizedDiff = Math.min(diff, 2 * Math.PI - diff) / Math.PI;
                match += 1 - normalizedDiff;
            }
            match /= n;
            bestMatch = Math.max(bestMatch, match);
        }

        return bestMatch;
    }

    // 🎯 СРАВНЕНИЕ РАССТОЯНИЙ (нормализованное, инвариантно к масштабу)
    compareDistances(distances1, distances2) {
        if (!distances1 || !distances2 || distances1.length !== distances2.length) return 0;

        // Нормализуем расстояния относительно максимального
        const max1 = Math.max(...distances1);
        const max2 = Math.max(...distances2);
       
        if (max1 === 0 || max2 === 0) return 0;

        const norm1 = distances1.map(d => d / max1);
        const norm2 = distances2.map(d => d / max2);

        // Сравниваем нормализованные расстояния
        let totalDiff = 0;
        for (let i = 0; i < norm1.length; i++) {
            totalDiff += Math.abs(norm1[i] - norm2[i]);
        }

        return 1 - (totalDiff / norm1.length);
    }

    // 🎯 СРАВНЕНИЕ ТОПОЛОГИИ
    compareTopology(topology1, topology2) {
        let score = 0;
        let weight = 0;

        // Количество соседей
        if (topology1.neighborCount && topology2.neighborCount) {
            const diff = Math.abs(topology1.neighborCount - topology2.neighborCount);
            score += (1 - Math.min(1, diff / 3)) * 0.4;
            weight += 0.4;
        }

        // Степень связности
        if (topology1.connectivity && topology2.connectivity) {
            const diff = Math.abs(topology1.connectivity - topology2.connectivity);
            score += (1 - Math.min(1, diff)) * 0.3;
            weight += 0.3;
        }

        // Тип связей
        if (topology1.edgeTypes && topology2.edgeTypes) {
            const typeMatch = this.compareArrays(topology1.edgeTypes, topology2.edgeTypes);
            score += typeMatch * 0.3;
            weight += 0.3;
        }

        return weight > 0 ? score / weight : 0;
    }

    // 🎯 КЛАССИФИКАЦИЯ ПАТТЕРНА
    classifyPattern(pattern) {
        if (!pattern) return 'other';

        // По углам определяем тип
        if (pattern.angles && pattern.angles.length === 3) {
            // Треугольник
            return 'triangle';
        } else if (pattern.angles && pattern.angles.length === 2) {
            // Линия или угол
            const angleDiff = Math.abs(pattern.angles[0] - pattern.angles[1]);
            const normalized = Math.min(angleDiff, 2 * Math.PI - angleDiff);
           
            if (normalized < Math.PI / 6) return 'line'; // Почти 0° - линия
            if (Math.abs(normalized - Math.PI / 2) < Math.PI / 6) return 'corner'; // ~90° - угол
        }

        // По плотности точек
        if (pattern.density && pattern.density > 0.8) {
            return 'cluster';
        }

        return 'other';
    }

    // 🎯 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    compareArrays(arr1, arr2) {
        if (!arr1 || !arr2) return 0;
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
       
        let intersection = 0;
        for (const item of set1) {
            if (set2.has(item)) intersection++;
        }
       
        const union = set1.size + set2.size - intersection;
        return union > 0 ? intersection / union : 0;
    }

    // 🎯 ТЕКСТОВЫЙ ОТЧЕТ
    createTextPatternReport(footprint1, footprint2, matchingPatterns) {
        const filename = `pattern_report_${footprint1.id}_${footprint2.id}_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);

        const trans1 = footprint1.getTransformation ? footprint1.getTransformation() : null;
        const trans2 = footprint2.getTransformation ? footprint2.getTransformation() : null;

        let report = `🎯 ОТЧЕТ О СРАВНЕНИИ ПАТТЕРНОВ (не зависит от поворота)\n`;
        report += `═`.repeat(60) + `\n\n`;

        report += `📋 ИНФОРМАЦИЯ О СЛЕДАХ:\n`;
        report += `След 1: ${footprint1.name || 'Неизвестный'} (ID: ${footprint1.id?.slice(0, 8) || 'N/A'})\n`;
        if (trans1) report += `   Поворот: ${trans1.rotationAngle?.toFixed(1)}°\n`;
       
        report += `\nСлед 2: ${footprint2.name || 'Неизвестный'} (ID: ${footprint2.id?.slice(0, 8) || 'N/A'})\n`;
        if (trans2) report += `   Поворот: ${trans2.rotationAngle?.toFixed(1)}°\n`;

        report += `\n📊 СТАТИСТИКА СРАВНЕНИЯ:\n`;
        report += `Совпало паттернов: ${matchingPatterns?.length || 0}\n`;
       
        const similarity = matchingPatterns ? matchingPatterns.length / Math.max(1, Math.max(
            footprint1.pointTracker?.points?.size || 0,
            footprint2.pointTracker?.points?.size || 0
        )) : 0;
       
        report += `Сходство: ${(similarity * 100).toFixed(1)}%\n`;

        report += `\n🔍 ДЕТАЛИ СОВПАВШИХ ПАТТЕРНОВ:\n`;
        if (matchingPatterns && matchingPatterns.length > 0) {
            matchingPatterns.slice(0, 10).forEach((match, i) => {
                report += `${i + 1}. ${match.type || 'Паттерн'} (уверенность: ${(match.confidence * 100).toFixed(1)}%)\n`;
                if (match.pattern1 && match.pattern1.points) {
                    report += `   Точки в следе 1: ${match.pattern1.points.length}\n`;
                }
                if (match.pattern2 && match.pattern2.points) {
                    report += `   Точки в следе 2: ${match.pattern2.points.length}\n`;
                }
                report += `   Оценка совпадения: ${(match.score * 100).toFixed(1)}%\n\n`;
            });
           
            if (matchingPatterns.length > 10) {
                report += `... и еще ${matchingPatterns.length - 10} паттернов\n`;
            }
        } else {
            report += `Нет совпадающих паттернов\n`;
        }

        report += `\n💡 ВЫВОД:\n`;
        if (similarity > 0.7) {
            report += `✅ ВЫСОКАЯ СХОЖЕСТЬ - вероятно, тот же протектор\n`;
        } else if (similarity > 0.4) {
            report += `⚠️ УМЕРЕННАЯ СХОЖЕСТЬ - похожий тип протектора\n`;
        } else {
            report += `❌ НИЗКАЯ СХОЖЕСТЬ - разные следы\n`;
        }

        report += `\n🎯 ПРЕИМУЩЕСТВА МЕТОДА:\n`;
        report += `• Не зависит от поворота следов\n`;
        report += `• Не зависит от масштаба\n`;
        report += `• Не зависит от положения на фото\n`;
        report += `• Сравнивает структурные особенности, а не координаты\n`;

        report += `\n═`.repeat(60) + `\n`;
        report += `Отчет создан: ${new Date().toLocaleString('ru-RU')}\n`;
        report += `Для графической визуализации установите: npm install canvas\n`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            similarity: similarity,
            matchingPatterns: matchingPatterns?.length || 0,
            method: 'pattern_based_text'
        };
    }

    // 🎯 ОТЧЕТ ЕСЛИ НЕТ ПАТТЕРНОВ
    createNoPatternsReport(footprint1, footprint2) {
        const outputPath = path.join(this.config.outputDir, `no_patterns_${Date.now()}.txt`);

        const report = `⚠️ НЕТ ДАННЫХ ДЛЯ СРАВНЕНИЯ ПАТТЕРНОВ\n\n`;

        report += `Причина: Не удалось извлечь инвариантные паттерны из следов.\n\n`;
        report += `Рекомендации:\n`;
        report += `1. Убедитесь что следы содержат достаточно точек\n`;
        report += `2. Проверьте что следы были правильно нормализованы\n`;
        report += `3. Используйте метод getInvariantFeatures() в SimpleFootprint\n`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            similarity: 0,
            matchingPatterns: 0,
            method: 'pattern_based_no_data'
        };
    }

    // 🎯 ФАЛЛБЭК ОТЧЕТ
    createFallbackPatternReport(footprint1, footprint2, matchingPatterns) {
        const outputPath = path.join(this.config.outputDir, `fallback_pattern_${Date.now()}.txt`);

        const report = `🎯 УПРОЩЕННЫЙ ОТЧЕТ О СРАВНЕНИИ\n\n`;

        report += `Для полноценного сравнения паттернов нужно:\n`;
        report += `1. Добавить метод getInvariantFeatures() в SimpleFootprint\n`;
        report += `2. Реализовать извлечение инвариантных признаков\n`;
        report += `3. Настроить сравнение в feature-пространстве\n\n`;

        report += `📞 Следующие шаги:\n`;
        report += `• Доработать template-builder.js для работы с паттернами\n`;
        report += `• Использовать уже существующие invariantCells\n`;
        report += `• Сравнивать neighborDistances и angularDistribution\n`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            similarity: matchingPatterns?.length > 0 ? 0.5 : 0,
            note: 'Требуется доработка системы паттернов'
        };
    }
}

module.exports = PatternVisualizer;

// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                       АНАЛИЗАТОР СЛЕДОВ ОБУВИ (WEBHOOK ВЕРСИЯ)               🔵
// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// =============================================================================
// 📤 YANDEX DISK SERVICE - ЗАГРУЗКА ФОТО НА ЯНДЕКС.ДИСК
// =============================================================================
let YandexDiskService;
let yandexDisk;

try {
    YandexDiskService = require('./yandex-disk-service');
    yandexDisk = new YandexDiskService(process.env.YANDEX_DISK_TOKEN);
    console.log('✅ Яндекс.Диск service инициализирован');
} catch (error) {
    console.log('❌ Яндекс.Диск service не доступен:', error.message);
    yandexDisk = null;
}

// =============================================================================
// 📊 КОНФИГ МОДЕЛИ ДЛЯ ОТЧЕТОВ - ПРОЗРАЧНОСТЬ СИСТЕМЫ
// =============================================================================
const MODEL_METADATA = {
    name: "Shoe Print Detective",
    version: "dynamic",
    status: "ACTIVE_DEVELOPMENT",
    accuracy: "Обновляется при переобучении",
    dataset: "База расширяется",
    trained: "Периодически обновляется",
    confidence: "ЗАВИСИТ ОТ КАЧЕСТВА СЛЕДА",
    limitations: [
        "Модель в активной разработке",
        "Точность варьируется от 30% до 50%",
        "Требует очень четкие следы для надежности",
        "Регулярно улучшается на новых данных",
        "Может пропускать мелкие детали"
    ],
    recommendations: [
        "Фотографируйте под прямым углом",
        "Идеальное освещение без теней",
        "Максимальная четкость снимка",
        "Крупный план следа",
        "Контрастный фон"
    ]
};

// 🔧 Функция для добавления информации о модели
function addModelTransparency(caption, predictionsCount = 0) {
    const confidenceLevel = predictionsCount > 15 ? "СРЕДНЯЯ" : "НИЗКАЯ";
   
    return `${caption}\n\n` +
           `🔍 **ИНФОРМАЦИЯ О СИСТЕМЕ:**\n` +
           `• Модель: ${MODEL_METADATA.name} (${MODEL_METADATA.status})\n` +
           `• Версия: ${MODEL_METADATA.version}\n` +
           `• Уверенность анализа: ${confidenceLevel}\n` +
           `• Состояние: Активная разработка\n\n` +
           `💡 **Рекомендации по съемке:**\n` +
           `- ${MODEL_METADATA.recommendations.join('\n- ')}\n\n` +
           `⚠️ **Важные ограничения:**\n` +
           `- ${MODEL_METADATA.limitations.join('\n- ')}`;
}

// =============================================================================
// 🎯 НАСТРОЙКИ И ИНИЦИАЛИЗАЦИЯ
// =============================================================================

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = `https://shoe-print-bot.onrender.com/bot${TELEGRAM_TOKEN}`;

console.log('🚀 Запуск бота с Webhook...');
console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);

// =============================================================================
// 📊 СИСТЕМА СТАТИСТИКИ И ДАННЫХ
// =============================================================================

const userStats = new Map();
const globalStats = {
    totalUsers: 0,
    totalPhotos: 0,
    totalAnalyses: 0,
    comparisonsMade: 0
};

const referencePrints = new Map();
const photoSessions = new Map();

// =============================================================================
// 🕵️‍♂️ СИСТЕМА СЕССИЙ ТРОПЫ
// =============================================================================

const trailSessions = new Map();

// 🕵️‍♂️ СИСТЕМА СЕССИЙ ТРОПЫ - ОБНОВЛЕННАЯ ВЕРСИЯ

class TrailSession {
    constructor(chatId, username) {
        this.chatId = chatId;
        this.expert = username;
        this.sessionId = `session_${chatId}_${Date.now()}`;
        this.startTime = new Date();
        this.footprints = [];
        this.comparisons = [];
        this.status = 'active';
        this.notes = '';
       
        this.assembledModels = [];
        this.footprintParts = new Map();
        this.compatibilityGroups = [];
    }

    addFootprint(analysisData) {
        const footprintRecord = {
            id: `footprint_${this.footprints.length + 1}`,
            timestamp: new Date(),
            imageUrl: analysisData.imageUrl,
            predictions: analysisData.predictions,
            features: analysisData.features,
            perspectiveAnalysis: analysisData.perspectiveAnalysis,
            orientation: analysisData.orientation
        };
       
        this.footprints.push(footprintRecord);
        console.log(`🕵️‍♂️ Добавлен отпечаток в сессию ${this.sessionId}: ${footprintRecord.id}`);
       
        if (this.footprints.length > 1) {
            this.autoCompareWithPrevious(footprintRecord);
        }
       
        return footprintRecord;
    }

    autoCompareWithPrevious(newFootprint) {
        console.log(`🕵️‍♂️ Автосравнение нового отпечатка с предыдущими...`);
       
        const previousFootprints = this.footprints.slice(0, -1);
       
        previousFootprints.forEach((previous, index) => {
            const comparison = compareFootprints(previous.features, newFootprint.features);
           
            const comparisonRecord = {
                id: `comparison_${this.comparisons.length + 1}`,
                timestamp: new Date(),
                footprintA: previous.id,
                footprintB: newFootprint.id,
                result: comparison,
                similarity: comparison.overallScore,
                notes: this.generateComparisonNotes(comparison, previous, newFootprint)
            };
           
            this.comparisons.push(comparisonRecord);
            console.log(`🔍 Сравнение ${previous.id} vs ${newFootprint.id}: ${comparison.overallScore}%`);
        });
    }

    generateComparisonNotes(comparison, footprintA, footprintB) {
        const notes = [];
       
        if (comparison.overallScore > 70) {
            notes.push('ВЫСОКАЯ СХОДИМОСТЬ - вероятно один источник');
        } else if (comparison.overallScore > 50) {
            notes.push('СРЕДНЯЯ СХОДИМОСТЬ - требуется дополнительный анализ');
        } else {
            notes.push('НИЗКАЯ СХОДИМОСТЬ - разные источники');
        }
        if (comparison.mirrorUsed) {
            notes.push('Учтена зеркальная симметрия (левый/правый)');
        }
        return notes.join('; ');
    }

    getSessionSummary() {
        return {
            sessionId: this.sessionId,
            expert: this.expert,
            duration: new Date() - this.startTime,
            footprintsCount: this.footprints.length,
            comparisonsCount: this.comparisons.length,
            averageSimilarity: this.comparisons.length > 0 ?
                this.comparisons.reduce((sum, comp) => sum + comp.similarity, 0) / this.comparisons.length : 0,
            status: this.status
        };
    }

    generateExpertReport() {
        const summary = this.getSessionSummary();
       
        let report = `🕵️‍♂️ **АНАЛИЗ ТРОПЫ**\n\n`;
        report += `**Сессия:** ${summary.sessionId}\n`;
        report += `**Эксперт:** ${summary.expert}\n`;
        report += `**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n`;
        report += `**Проанализировано отпечатков:** ${summary.footprintsCount}\n`;
        report += `**Выполнено сравнений:** ${summary.comparisonsCount}\n`;
        report += `**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n\n`;
       
        if (this.comparisons.length > 0) {
            report += `**КЛЮЧЕВЫЕ ВЫВОДЫ:**\n`;
           
            const highSimilarity = this.comparisons.filter(c => c.similarity > 70);
            if (highSimilarity.length > 0) {
                report += `• Обнаружено ${highSimilarity.length} пар с высокой сходимостью\n`;
            }
            const uniqueGroups = this.identifyUniqueGroups();
            report += `• Выявлено ${uniqueGroups.length} уникальных морфологических групп\n`;
        }
        report += `\n**СТАТУС:** ${this.status === 'active' ? 'АКТИВНА' : 'ЗАВЕРШЕНА'}`;
       
        return report;
    }

    identifyUniqueGroups() {
        const groups = [];
       
        this.footprints.forEach(footprint => {
            let assigned = false;
           
            for (let group of groups) {
                const avgSimilarity = group.members.reduce((sum, member) => {
                    const comparison = this.comparisons.find(c =>
                        (c.footprintA === footprint.id && c.footprintB === member) ||
                        (c.footprintB === footprint.id && c.footprintA === member)
                    );
                    return sum + (comparison ? comparison.similarity : 0);
                }, 0) / group.members.length;
               
                if (avgSimilarity > 60) {
                    group.members.push(footprint.id);
                    assigned = true;
                    break;
                }
            }
           
            if (!assigned) {
                groups.push({ id: `group_${groups.length + 1}`, members: [footprint.id] });
            }
        });
       
        return groups;
    }

    analyzeFootprintParts(imageWidth, imageHeight) {
        console.log(`🕵️‍♂️ Анализирую части следов для ${this.footprints.length} отпечатков...`);
       
        const assembler = new FootprintAssembler();
       
        this.footprints.forEach(footprint => {
            const partType = assembler.classifyFootprintPart(footprint.predictions, imageWidth, imageHeight);
            footprint.partType = partType;
            footprint.assemblyPotential = this.calculateAssemblyPotential(footprint);
            console.log(`📋 Отпечаток ${footprint.id}: ${partType} (потенциал: ${footprint.assemblyPotential})`);
        });
       
        this.updateCompatibilityGroups();
    }

    calculateAssemblyPotential(footprint) {
        if (!footprint.features) return 0;
       
        let score = 0;
        const details = footprint.features.detailCount || 0;
       
        if (details > 15) score += 40;
        else if (details > 8) score += 25;
        else if (details > 3) score += 15;
       
        if (footprint.features.hasOutline) score += 30;
       
        if (footprint.features.largeDetails > 2) score += 20;
       
        return Math.min(score, 100);
    }

    updateCompatibilityGroups() {
        const assembler = new FootprintAssembler();
        const filteredPrints = assembler.filterOutlierFootprints(this.footprints);
        this.compatibilityGroups = assembler.groupCompatiblePrints(filteredPrints);
        console.log(`🔄 Обновлено групп совместимости: ${this.compatibilityGroups.length}`);
    }

    assembleModelFromParts(imageWidth, imageHeight) {
        if (this.footprints.length < 2) {
            return { success: false, error: 'Недостаточно отпечатков для сборки' };
        }
       
        console.log(`🧩 Начинаю сборку модели из ${this.footprints.length} отпечатков...`);
       
        const assembler = new FootprintAssembler();
       
        if (!this.footprints[0].partType) {
            this.analyzeFootprintParts(imageWidth, imageHeight);
        }
       
        const result = assembler.assembleFullModel(this.footprints, imageWidth, imageHeight);
       
        if (result.success) {
            const assembledModel = {
                id: `assembled_${this.assembledModels.length + 1}`,
                timestamp: new Date(),
                model: result.model,
                sourcePrints: result.usedPrints.map(p => p.id),
                completeness: result.completeness,
                confidence: result.confidence
            };
           
            this.assembledModels.push(assembledModel);
            console.log(`✅ Модель собрана: ${result.completeness}% полноты, ${result.confidence}% уверенности`);
        }
       
        return result;
    }

    getPartsStatistics() {
        const parts = { full: 0, heel: 0, toe: 0, center: 0, unknown: 0 };
       
        this.footprints.forEach(footprint => {
            const partType = footprint.partType || 'unknown';
            parts[partType] = (parts[partType] || 0) + 1;
        });
       
        return parts;
    }

    generateEnhancedReport() {
        const summary = this.getSessionSummary();
        const partsStats = this.getPartsStatistics();
       
        let report = `🕵️‍♂️ **РАСШИРЕННЫЙ АНАЛИЗ ТРОПЫ**\n\n`;
        report += `**Сессия:** ${summary.sessionId}\n`;
        report += `**Эксперт:** ${this.expert}\n`;
        report += `**Статус:** ${this.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
        report += `**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n\n`;
       
        report += `📊 **СТАТИСТИКА ОТПЕЧАТКОВ:**\n`;
        report += `• Всего: ${summary.footprintsCount}\n`;
        report += `• Полные: ${partsStats.full}\n`;
        report += `• Пятки: ${partsStats.heel}\n`;
        report += `• Мыски: ${partsStats.toe}\n`;
        report += `• Центры: ${partsStats.center}\n`;
        report += `• Неизвестные: ${partsStats.unknown}\n\n`;
       
        report += `🔍 **СРАВНЕНИЯ:**\n`;
        report += `• Выполнено: ${summary.comparisonsCount}\n`;
        report += `• Средняя сходимость: ${summary.averageSimilarity.toFixed(1)}%\n\n`;
       
        report += `🧩 **СБОРКА МОДЕЛЕЙ:**\n`;
        report += `• Собрано моделей: ${this.assembledModels.length}\n`;
        report += `• Групп совместимости: ${this.compatibilityGroups.length}\n\n`;
       
        if (this.assembledModels.length > 0) {
            const bestModel = this.assembledModels.reduce((best, current) => current.completeness > best.completeness ? current : best);
            report += `🏆 **ЛУЧШАЯ МОДЕЛЬ:**\n`;
            report += `• Полнота: ${bestModel.completeness}%\n`;
            report += `• Уверенность: ${bestModel.confidence}%\n`;
            report += `• Источников: ${bestModel.sourcePrints.length}\n`;
        }
       
        if (this.notes) {
            report += `\n📝 **ЗАМЕТКИ ЭКСПЕРТА:**\n${this.notes}\n`;
        }
       
        return report;
    }
 }


// =============================================================================
// 🧩 УМНАЯ СБОРКА МОДЕЛЕЙ ИЗ ЧАСТИЧНЫХ ОТПЕЧАТКОВ
// =============================================================================

class FootprintAssembler {
    constructor() {
        this.partialPrints = new Map();
        this.assembledModels = new Map();
    }

    /**
     * Классифицирует часть следа по геометрии
     */
    classifyFootprintPart(predictions, imageWidth, imageHeight) {
        if (!predictions || predictions.length === 0) return 'unknown';
       
        const bbox = this.calculateOverallBoundingBox(predictions);
        const aspectRatio = bbox.width / bbox.height;
        const centerX = bbox.minX + bbox.width / 2;
        const centerY = bbox.minY + bbox.height / 2;
       
        const positionX = centerX / imageWidth;
        const positionY = centerY / imageHeight;
       
        // Определяем тип части по положению и пропорциям
        if (aspectRatio > 2.2) return 'full';
        if (positionY < 0.4 && aspectRatio < 1.3) return 'heel';     // Верхняя часть
        if (positionY > 0.6 && aspectRatio < 1.3) return 'toe';      // Нижняя часть
        if (aspectRatio > 1.4 && aspectRatio < 2.2) return 'center'; // Центральная часть
        if (bbox.width > imageWidth * 0.7) return 'full';            // Занимает большую часть кадра
       
        return 'unknown';
    }

    /**
     * Вычисляет общий bounding box для всех предсказаний
     */
    calculateOverallBoundingBox(predictions) {
        if (!predictions || predictions.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
       
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
       
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                pred.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            }
        });
       
        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Компоновка полной модели из частичных отпечатков
     */
    assembleFullModel(partialPrints, imageWidth, imageHeight) {
        if (partialPrints.length < 2) {
            return { success: false, error: 'Недостаточно отпечатков для сборки' };
        }
       
        // Классифицируем все отпечатки
        const classifiedPrints = partialPrints.map(print => ({
            ...print,
            partType: this.classifyFootprintPart(print.predictions, imageWidth, imageHeight),
            bbox: this.calculateOverallBoundingBox(print.predictions)
        }));
       
        // Группируем по совместимости
        const compatibleGroups = this.groupCompatiblePrints(classifiedPrints);
       
        if (compatibleGroups.length === 0) {
            return { success: false, error: 'Не найдено совместимых отпечатков' };
        }
       
        // Выбираем лучшую группу
        const bestGroup = this.selectBestGroup(compatibleGroups);
       
        // Собираем модель
        const assembledModel = this.mergeFootprints(bestGroup);
       
        return {
            success: true,
            model: assembledModel,
            usedPrints: bestGroup,
            completeness: this.calculateCompleteness(bestGroup),
            confidence: this.calculateConfidence(bestGroup)
        };
    }

    /**
     * Группирует совместимые отпечатки
     */
    groupCompatiblePrints(classifiedPrints) {
        const groups = [];
       
        classifiedPrints.forEach(print => {
            let assigned = false;
           
            for (let group of groups) {
                if (this.arePrintsCompatible(group, print)) {
                    group.push(print);
                    assigned = true;
                    break;
                }
            }
           
            if (!assigned) {
                groups.push([print]);
            }
        });
       
        return groups.filter(group => group.length >= 2);
    }

    /**
     * Проверяет совместимость отпечатков (ОБНОВЛЕННАЯ ВЕРСИЯ)
     */
    arePrintsCompatible(group, newPrint) {
        // Проверяем по типу частей (не должны дублироваться)
        const existingTypes = group.map(p => p.partType);
        if (existingTypes.includes(newPrint.partType)) {
            return false;
        }
       
        // Проверяем схожесть features
        const similarityScores = group.map(existing =>
            this.calculateSimilarity(existing.features, newPrint.features)
        );
       
        const avgSimilarity = similarityScores.reduce((a, b) => a + b) / similarityScores.length;
       
        // 🔄 ДОБАВЛЯЕМ ГЕОМЕТРИЧЕСКУЮ ПРОВЕРКУ
        const geometricScore = this.calculateGeometricSimilarity(group, newPrint);
        if (geometricScore < 0.4) {
            console.log(`📐 Геометрическое сходство слишком низкое: ${geometricScore.toFixed(2)}`);
            return false; // Слишком разные геометрически
        }
       
        console.log(`🎯 Совместимость: features=${avgSimilarity.toFixed(2)}, geometry=${geometricScore.toFixed(2)}`);
       
        return avgSimilarity > 0.6 && geometricScore > 0.4;
    }

    /**
     * Выбирает лучшую группу для сборки
     */
    selectBestGroup(groups) {
        return groups.reduce((best, current) => {
            const bestScore = this.calculateGroupScore(best);
            const currentScore = this.calculateGroupScore(current);
            return currentScore > bestScore ? current : best;
        });
    }

    /**
     * Вычисляет score группы
     */
    calculateGroupScore(group) {
        const typeDiversity = new Set(group.map(p => p.partType)).size;
        const avgConfidence = group.reduce((sum, p) => sum + (p.features?.detailCount || 0), 0) / group.length;
        return typeDiversity * avgConfidence;
    }

    /**
     * Объединяет отпечатки в одну модель
     */
    mergeFootprints(prints) {
        const mergedPredictions = [];
        const mergedFeatures = {
            detailCount: 0,
            hasOutline: false,
            largeDetails: 0,
            density: 0,
            spatialSpread: 0
        };
       
        prints.forEach(print => {
            if (print.predictions) {
                mergedPredictions.push(...print.predictions);
            }
            if (print.features) {
                mergedFeatures.detailCount += print.features.detailCount || 0;
                mergedFeatures.hasOutline = mergedFeatures.hasOutline || print.features.hasOutline;
                mergedFeatures.largeDetails += print.features.largeDetails || 0;
            }
        });
       
        return {
            predictions: mergedPredictions,
            features: mergedFeatures,
            sourcePrints: prints.map(p => p.id),
            timestamp: new Date()
        };
    }

    /**
     * Вычисляет полноту модели
     */
    calculateCompleteness(prints) {
        const uniqueTypes = new Set(prints.map(p => p.partType));
        const maxPossibleTypes = 4; // full, heel, toe, center
        return (uniqueTypes.size / maxPossibleTypes) * 100;
    }

    /**
     * Вычисляет уверенность в модели
     */
    calculateConfidence(prints) {
        const similarities = [];
       
        for (let i = 0; i < prints.length; i++) {
            for (let j = i + 1; j < prints.length; j++) {
                similarities.push(this.calculateSimilarity(prints[i].features, prints[j].features));
            }
        }
       
        const avgSimilarity = similarities.length > 0 ?
            similarities.reduce((a, b) => a + b) / similarities.length : 0;
           
        return Math.min(avgSimilarity * 100, 100);
    }

    /**
     * Вычисляет схожесть features
     */
    calculateSimilarity(featuresA, featuresB) {
        if (!featuresA || !featuresB) return 0;
       
        const countA = featuresA.detailCount || 0;
        const countB = featuresB.detailCount || 0;
       
        if (countA === 0 || countB === 0) return 0;
       
        const countRatio = Math.min(countA, countB) / Math.max(countA, countB);
        const outlineMatch = featuresA.hasOutline === featuresB.hasOutline ? 0.3 : 0;
       
        return countRatio * 0.7 + outlineMatch;
    }

    /**
     * Фильтрует "левые" следы
     */
    filterOutlierFootprints(footprints, similarityThreshold = 0.6) {
        if (footprints.length < 3) return footprints;
       
        return footprints.filter((footprint, index, array) => {
            const similarities = array
                .filter((_, i) => i !== index)
                .map(other => this.calculateSimilarity(footprint.features, other.features));
           
            if (similarities.length === 0) return true;
           
            const avgSimilarity = similarities.reduce((a, b) => a + b) / similarities.length;
            return avgSimilarity >= similarityThreshold;
        });
    }

 // ... существующие методы FootprintAssembler ...

    /**
     * Нормализует геометрию отпечатка (поворот, масштаб, смещение)
     */
    normalizeFootprintGeometry(predictions, imageWidth, imageHeight) {
        if (!predictions || predictions.length === 0) return predictions;
       
        try {
            // 1. НАХОДИМ КОНТУР ДЛЯ ОПРЕДЕЛЕНИЯ ОРИЕНТАЦИИ
            const outline = predictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            );
           
            if (!outline || !outline.points) return predictions;
           
            // 2. ВЫЧИСЛЯЕМ УГОЛ ПОВОРОТА
            const angle = this.calculateOrientationAngle(outline.points);
           
            // 3. ВЫЧИСЛЯЕМ ЦЕНТР МАСС
            const bbox = this.calculateOverallBoundingBox(predictions);
            const center = {
                x: bbox.minX + bbox.width / 2,
                y: bbox.minY + bbox.height / 2
            };
           
            // 4. ЕСЛИ УГОЛ БОЛЬШОЙ - ПОВОРАЧИВАЕМ
            if (Math.abs(angle) > 10) {
                console.log(`🔄 Нормализую ориентацию: поворот на ${angle.toFixed(1)}°`);
                return this.rotatePredictions(predictions, center, -angle);
            }
           
            return predictions;
           
        } catch (error) {
            console.log('⚠️ Ошибка геометрической нормализации:', error.message);
            return predictions;
        }
    }

    /**
     * Поворачивает все предсказания вокруг центра
     */
    rotatePredictions(predictions, center, angleDegrees) {
        const rad = angleDegrees * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
       
        return predictions.map(pred => {
            if (!pred.points) return pred;
           
            return {
                ...pred,
                points: pred.points.map(point => {
                    // ПЕРЕНОСИМ В ЦЕНТР КООРДИНАТ
                    const dx = point.x - center.x;
                    const dy = point.y - center.y;
                   
                    // ПОВОРАЧИВАЕМ
                    const newX = dx * cos - dy * sin;
                    const newY = dx * sin + dy * cos;
                   
                    // ВОЗВРАЩАЕМ НА МЕСТО
                    return {
                        x: newX + center.x,
                        y: newY + center.y
                    };
                })
            };
        });
    }

    /**
     * Вычисляет угол ориентации контура
     */
    calculateOrientationAngle(points) {
        if (!points || points.length < 3) return 0;
       
        try {
            // ВЫЧИСЛЯЕМ ЦЕНТР МАСС
            const center = points.reduce((acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            }, { x: 0, y: 0 });
           
            center.x /= points.length;
            center.y /= points.length;
           
            // МЕТОД ГЛАВНЫХ КОМПОНЕНТ
            let xx = 0, yy = 0, xy = 0;
           
            points.forEach(point => {
                const dx = point.x - center.x;
                const dy = point.y - center.y;
                xx += dx * dx;
                yy += dy * dy;
                xy += dx * dy;
            });
           
            const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
            return angle * (180 / Math.PI);
           
        } catch (error) {
            return 0;
        }
    }

    /**
     * Вычисляет геометрическое сходство отпечатков
     */
    calculateGeometricSimilarity(group, newPrint) {
        let totalScore = 0;
        let count = 0;
       
        group.forEach(existing => {
            // СРАВНИВАЕМ РАЗМЕРЫ И ФОРМУ
            const bboxA = this.calculateOverallBoundingBox(existing.predictions);
            const bboxB = this.calculateOverallBoundingBox(newPrint.predictions);
           
            // СРАВНЕНИЕ СООТНОШЕНИЯ СТОРОН
            const aspectRatioA = bboxA.width / bboxA.height;
            const aspectRatioB = bboxB.width / bboxB.height;
            const aspectScore = 1 - Math.abs(aspectRatioA - aspectRatioB) / Math.max(aspectRatioA, aspectRatioB);
           
            // СРАВНЕНИЕ ПЛОЩАДЕЙ (логарифмическое для устойчивости к масштабу)
            const areaA = bboxA.width * bboxA.height;
            const areaB = bboxB.width * bboxB.height;
            const areaScore = 1 - Math.abs(Math.log(areaA) - Math.log(areaB)) / 5; // нормализация
           
            totalScore += (aspectScore + areaScore) / 2;
            count++;
        });
       
        return count > 0 ? totalScore / count : 0;
    }
 
}

// =============================================================================
// 💾 СИСТЕМА СОХРАНЕНИЯ ДАННЫХ
// =============================================================================

class DataPersistence {
    constructor() {
        this.dataFile = 'trail_sessions.json';
        this.backupInterval = 5 * 60 * 1000; // 5 минут
        this.setupAutoSave();
    }

    /**
     * Настраивает автосохранение
     */
    setupAutoSave() {
        setInterval(() => {
            this.saveAllData();
        }, this.backupInterval);
    }

    /**
     * Сохраняет все данные
     */
    async saveAllData() {
        try {
            console.log('💾 Автосохранение данных...');
           
            const data = {
                trailSessions: this.serializeTrailSessions(),
                referencePrints: Array.from(referencePrints.entries()),
                userStats: Array.from(userStats.entries()),
                globalStats: globalStats,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };

            // Локальное сохранение
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
           
            // Сохранение в Яндекс.Диск
            if (yandexDisk) {
                try {
                    await yandexDisk.uploadFile(this.dataFile, 'sessions_backup.json');
                    console.log('✅ Данные сохранены в Яндекс.Диск');
                } catch (driveError) {
                    console.log('⚠️ Ошибка сохранения в Яндекс.Диск:', driveError.message);
                }
            }
           
            console.log('💾 Все данные сохранены локально');
        } catch (error) {
            console.log('❌ Ошибка сохранения данных:', error.message);
        }
    }

    /**
     * Сериализует сессии тропы
     */
    serializeTrailSessions() {
        const serialized = [];
       
        trailSessions.forEach((session, chatId) => {
            serialized.push([
                chatId,
                {
                    chatId: session.chatId,
                    expert: session.expert,
                    sessionId: session.sessionId,
                    startTime: session.startTime.toISOString(),
                    footprints: session.footprints.map(footprint => ({
                        ...footprint,
                        timestamp: footprint.timestamp.toISOString()
                    })),
                    comparisons: session.comparisons.map(comparison => ({
                        ...comparison,
                        timestamp: comparison.timestamp.toISOString()
                    })),
                    status: session.status,
                    notes: session.notes
                }
            ]);
        });
       
        return serialized;
    }

    /**
     * Восстанавливает данные после перезапуска
     */
    async loadAllData() {
        try {
            console.log('🔄 Восстановление данных...');
           
            let data = null;
           
            // Пробуем загрузить из Яндекс.Диска
            if (yandexDisk) {
                try {
                    if (await yandexDisk.fileExists('backup/sessions_backup.json')) {
                        await yandexDisk.downloadFile('backup/sessions_backup.json', this.dataFile);
                        console.log('✅ Данные загружены из Яндекс.Диска');
                    }
                } catch (driveError) {
                    console.log('⚠️ Не удалось загрузить из Яндекс.Диска:', driveError.message);
                }
            }
           
            // Загружаем из локального файла
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                data = JSON.parse(fileContent);
                console.log('✅ Локальные данные загружены');
            } else {
                console.log('📝 Локальные данные не найдены, начинаем с чистого листа');
                return;
            }
           
            // Восстанавливаем сессии тропы
            if (data.trailSessions) {
                trailSessions.clear();
                data.trailSessions.forEach(([chatId, sessionData]) => {
                    const session = new TrailSession(chatId, sessionData.expert);
                   
                    // Восстанавливаем свойства
                    session.sessionId = sessionData.sessionId;
                    session.startTime = new Date(sessionData.startTime);
                    session.status = sessionData.status;
                    session.notes = sessionData.notes;
                   
                    // Восстанавливаем отпечатки
                    session.footprints = sessionData.footprints.map(footprintData => ({
                        ...footprintData,
                        timestamp: new Date(footprintData.timestamp)
                    }));
                   
                    // Восстанавливаем сравнения
                    session.comparisons = sessionData.comparisons.map(comparisonData => ({
                        ...comparisonData,
                        timestamp: new Date(comparisonData.timestamp)
                    }));
                   
                    trailSessions.set(parseInt(chatId), session);
                });
                console.log(`✅ Восстановлено ${trailSessions.size} сессий`);
            }
           
            // Восстанавливаем эталоны
            if (data.referencePrints) {
                referencePrints.clear();
                data.referencePrints.forEach(([name, ref]) => {
                    referencePrints.set(name, {
                        ...ref,
                        timestamp: new Date(ref.timestamp)
                    });
                });
                console.log(`✅ Восстановлено ${referencePrints.size} эталонов`);
            }
           
            // Восстанавливаем статистику пользователей
            if (data.userStats) {
                userStats.clear();
                data.userStats.forEach(([userId, userData]) => {
                    userStats.set(userId, {
                        ...userData,
                        firstSeen: new Date(userData.firstSeen),
                        lastSeen: new Date(userData.lastSeen),
                        lastAnalysis: userData.lastAnalysis ? new Date(userData.lastAnalysis) : null
                    });
                });
            }
           
            // Восстанавливаем глобальную статистику
            if (data.globalStats) {
                Object.assign(globalStats, data.globalStats);
                if (data.globalStats.lastAnalysis) {
                    globalStats.lastAnalysis = new Date(data.globalStats.lastAnalysis);
                }
            }
           
            console.log('🎯 Данные полностью восстановлены');
           
        } catch (error) {
            console.log('❌ Ошибка восстановления данных:', error.message);
            console.log('💫 Начинаем со свежих данных');
        }
    }

    /**
     * Экспорт сессии в файл
     */
    async exportSession(chatId, format = 'json') {
        const session = trailSessions.get(chatId);
        if (!session) {
            throw new Error('Сессия не найдена');
        }
       
        const exportData = {
            session: session.getSessionSummary(),
            footprints: session.footprints,
            comparisons: session.comparisons,
            exportTime: new Date().toISOString(),
            version: '1.0'
        };
       
        const filename = `session_export_${session.sessionId}_${Date.now()}.${format}`;
       
        if (format === 'json') {
            fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        }
       
        return filename;
    }

    /**
     * Резервное копирование конфигурации
     */
    async backupConfiguration() {
        const config = {
            modelMetadata: MODEL_METADATA,
            backupTime: new Date().toISOString(),
            stats: {
                totalUsers: globalStats.totalUsers,
                totalPhotos: globalStats.totalPhotos,
                totalAnalyses: globalStats.totalAnalyses
            }
        };
       
        const configFile = `config_backup_${Date.now()}.json`;
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
       
        if (yandexDisk) {
            await yandexDisk.uploadFile(configFile, `backup/${configFile}`);
        }
       
        return configFile;
    }
}

/**
* Получает или создает сессию экспертизы (ОБНОВЛЕННАЯ ВЕРСИЯ)
*/
function getTrailSession(chatId, username) {
    console.log(`🔍 Поиск сессии для chatId: ${chatId}`);
   
    if (!trailSessions.has(chatId)) {
        console.log(`🌿 Создаю новую сессию для ${username}`);
        const newSession = new TrailSession(chatId, username);
        trailSessions.set(chatId, newSession);
        console.log(`✅ Сессия создана: ${newSession.sessionId}`);
        return newSession;
    }
   
    const existingSession = trailSessions.get(chatId);
    console.log(`✅ Сессия найдена: ${existingSession.sessionId}, статус: ${existingSession.status}`);
    return existingSession;
}

// =============================================================================
// 🎨 ДЕТАЛЬНАЯ ВИЗУАЛИЗАЦИЯ СРАВНЕНИЙ
// =============================================================================

class ComparisonVisualizer {
    constructor() {
        this.colors = {
            match: 'rgba(0, 255, 0, 0.6)',      // Зеленый - совпадения
            difference: 'rgba(255, 0, 0, 0.6)', // Красный - различия 
            missing: 'rgba(255, 255, 0, 0.6)',  // Желтый - отсутствующие
            partial: 'rgba(255, 165, 0, 0.6)',  // Оранжевый - частичные
            outline: 'rgba(0, 0, 255, 0.8)'     // Синий - контур
        };
    }

    /**
     * Создает визуализацию сравнения двух отпечатков
     */
    async createComparisonVisualization(footprintA, footprintB, imageUrl) {
        try {
            console.log('🎨 Создаю визуализацию сравнения...');
           
            const image = await loadImage(imageUrl);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
           
            // Рисуем исходное изображение с полупрозрачностью
            ctx.globalAlpha = 0.3;
            ctx.drawImage(image, 0, 0);
            ctx.globalAlpha = 1.0;
           
            // Анализируем различия
            const analysis = this.analyzeDifferences(footprintA, footprintB);
           
            // Рисуем совпадения (зеленый)
            this.drawPredictions(ctx, analysis.matches, this.colors.match, 'Совпадения');
           
            // Рисуем различия (красный)
            this.drawPredictions(ctx, analysis.differences, this.colors.difference, 'Различия');
           
            // Рисуем отсутствующие (желтый)
            this.drawPredictions(ctx, analysis.missingA, this.colors.missing, 'Отсутствует в A');
            this.drawPredictions(ctx, analysis.missingB, this.colors.missing, 'Отсутствует в B');
           
            // Добавляем легенду
            this.drawLegend(ctx, image.width, image.height);
           
            // Добавляем информацию о сравнении
            this.drawComparisonInfo(ctx, analysis, image.width, image.height);
           
            const tempPath = `comparison_${Date.now()}.png`;
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(tempPath, buffer);
           
            console.log('✅ Визуализация сравнения создана');
            return tempPath;
           
        } catch (error) {
            console.error('❌ Ошибка создания визуализации сравнения:', error);
            return null;
        }
    }

    /**
     * Анализирует различия между двумя отпечатками
     */
    analyzeDifferences(footprintA, footprintB) {
        const predsA = footprintA.predictions || [];
        const predsB = footprintB.predictions || [];
       
        // Находим совпадения (похожие классы в близких позициях)
        const matches = [];
        const differences = [];
        const missingA = [];
        const missingB = [];
       
        // Простой алгоритм сравнения по классам и позициям
        predsA.forEach(predA => {
            const similarInB = predsB.find(predB =>
                predB.class === predA.class &&
                this.calculateIOU(predA, predB) > 0.3
            );
           
            if (similarInB) {
                matches.push(predA);
            } else {
                differences.push(predA);
            }
        });
       
        // Находим элементы, отсутствующие в A
        predsB.forEach(predB => {
            const similarInA = predsA.find(predA =>
                predA.class === predB.class &&
                this.calculateIOU(predA, predB) > 0.3
            );
           
            if (!similarInA) {
                missingB.push(predB); // Отсутствует в A (но есть в B)
            }
        });
       
        return {
            matches,
            differences,
            missingA: [], // Можно реализовать более сложную логику
            missingB,
            similarity: this.calculateOverallSimilarity(footprintA, footprintB)
        };
    }

    /**
     * Вычисляет Intersection over Union для двух предсказаний
     */
    calculateIOU(predA, predB) {
        if (!predA.points || !predB.points) return 0;
       
        const bboxA = this.calculateBoundingBox(predA.points);
        const bboxB = this.calculateBoundingBox(predB.points);
       
        const intersection = this.calculateIntersection(bboxA, bboxB);
        const union = (bboxA.width * bboxA.height) + (bboxB.width * bboxB.height) - intersection;
       
        return union > 0 ? intersection / union : 0;
    }

    /**
     * Вычисляет площадь пересечения
     */
    calculateIntersection(bboxA, bboxB) {
        const xOverlap = Math.max(0, Math.min(bboxA.maxX, bboxB.maxX) - Math.max(bboxA.minX, bboxB.minX));
        const yOverlap = Math.max(0, Math.min(bboxA.maxY, bboxB.maxY) - Math.max(bboxA.minY, bboxB.minY));
        return xOverlap * yOverlap;
    }

    /**
     * Вычисляет общую схожесть
     */
    calculateOverallSimilarity(footprintA, footprintB) {
        const assembler = new FootprintAssembler();
        return assembler.calculateSimilarity(footprintA.features, footprintB.features) * 100;
    }

    /**
     * Рисует предсказания на canvas
     */
    drawPredictions(ctx, predictions, color, label) {
        if (!predictions || predictions.length === 0) return;
       
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
       
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 2) {
                ctx.beginPath();
                ctx.moveTo(pred.points[0].x, pred.points[0].y);
               
                for (let i = 1; i < pred.points.length; i++) {
                    ctx.lineTo(pred.points[i].x, pred.points[i].y);
                }
               
                ctx.closePath();
                ctx.stroke();
               
                // Подпись для крупных элементов
                if (pred.points.length > 4) {
                    const bbox = this.calculateBoundingBox(pred.points);
                    if (bbox.width > 50 && bbox.height > 50) {
                        ctx.fillStyle = color;
                        ctx.font = '12px Arial';
                        ctx.fillText(pred.class || 'unknown', bbox.minX, bbox.minY - 5);
                    }
                }
            }
        });
    }

    /**
     * Рисует легенду
     */
    drawLegend(ctx, width, height) {
        const legendX = width - 200;
        const legendY = 20;
        const itemHeight = 25;
       
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(legendX - 10, legendY - 10, 190, 130);
       
        const items = [
            { color: this.colors.match, text: '✅ Совпадения' },
            { color: this.colors.difference, text: '❌ Различия' },
            { color: this.colors.missing, text: '⚠️ Отсутствующие' },
            { color: this.colors.partial, text: '🔄 Частичные' }
        ];
       
        items.forEach((item, index) => {
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX, legendY + index * itemHeight, 20, 15);
           
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.fillText(item.text, legendX + 30, legendY + 12 + index * itemHeight);
        });
    }

    /**
     * Рисует информацию о сравнении
     */
    drawComparisonInfo(ctx, analysis, width, height) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, height - 120, 300, 110);
       
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('📊 РЕЗУЛЬТАТЫ СРАВНЕНИЯ', 20, height - 95);
       
        ctx.font = '14px Arial';
        ctx.fillText(`🎯 Общее сходство: ${analysis.similarity.toFixed(1)}%`, 20, height - 70);
        ctx.fillText(`✅ Совпадений: ${analysis.matches.length}`, 20, height - 50);
        ctx.fillText(`❌ Различий: ${analysis.differences.length}`, 20, height - 30);
        ctx.fillText(`⚠️ Отсутствующих: ${analysis.missingB.length}`, 20, height - 10);
    }

    /**
     * Вспомогательная функция для bounding box
     */
    calculateBoundingBox(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
}

// 📍 ОБНОВЛЯЕМ ФУНКЦИЮ updateUserStats - находим ее и изменяем:

function updateUserStats(userId, username, action = 'photo') {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            username: username || `user_${userId}`,
            photosCount: 0,
            analysesCount: 0,
            // ❌ УДАЛЯЕМ: sessionsCount: 0,  // Больше не отслеживаем сессии
            comparisonsCount: 0,
            firstSeen: new Date(),
            lastSeen: new Date(),
            lastAnalysis: null
        });
        globalStats.totalUsers++;
    }
   
    const user = userStats.get(userId);
    user.lastSeen = new Date();
   
    switch(action) {
        case 'photo':
            user.photosCount++;
            globalStats.totalPhotos++;
            break;
        case 'analysis':
            user.analysesCount++;
            globalStats.totalAnalyses++;
            user.lastAnalysis = new Date();
            globalStats.lastAnalysis = new Date();
            break;
        case 'comparison':
            user.comparisonsCount++;
            globalStats.comparisonsMade++;
            break;
        // ❌ УДАЛЯЕМ case 'session': - больше не используем
    }
   
    if (globalStats.totalPhotos % 10 === 0) {
        saveStats();
    }
}

// const referencePrints = new Map();
// const photoSessions = new Map();

// =============================================================================
// 🚀 ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ СБОРКИ И СОХРАНЕНИЯ
// =============================================================================

// 🔧 Инициализируем менеджер данных
const dataPersistence = new DataPersistence();

// 🔧 Инициализируем ассемблер и визуализатор (глобально для переиспользования)
const footprintAssembler = new FootprintAssembler();
const comparisonVisualizer = new ComparisonVisualizer();

// 🔧 Загружаем данные при старте
console.log('🔄 Инициализация системы сборки моделей...');

// =============================================================================
// 🤖 ИНИЦИАЛИЗАЦИЯ БОТА И WEBHOOK
// =============================================================================

const bot = new TelegramBot(TELEGRAM_TOKEN);

app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Анализатор следов обуви</title></head>
            <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                    <h1 style="text-align: center; margin-bottom: 30px;">🤖 Анализатор следов обуви</h1>
                    <div style="text-align: center; margin-bottom: 30px;">
                        <p style="font-size: 18px; margin-bottom: 20px;">Бот работает! Используйте Telegram:</p>
                        <a href="https://t.me/Sled_la_bot" style="display: inline-block; background: #0088cc; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            📲 @Sled_la_bot
                        </a>
                    </div>
                    <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin-top: 20px;">
                        <h3 style="text-align: center; margin-bottom: 15px;">📊 Статистика системы</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
                            <div>
                                <div style="font-size: 24px; font-weight: bold;">${globalStats.totalUsers}</div>
                                <div>👥 Пользователей</div>
                            </div>
                            <div>
                                <div style="font-size: 24px; font-weight: bold;">${globalStats.totalPhotos}</div>
                                <div>📸 Фото обработано</div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        statistics: {
            users: globalStats.totalUsers,
            photos: globalStats.totalPhotos,
            analyses: globalStats.totalAnalyses
        }
    });
});

// =============================================================================
// 🧠 УМНАЯ ПОСТОБРАБОТКА + НОРМАЛИЗАЦИЯ
// =============================================================================

function smartPostProcessing(predictions) {
    if (!predictions || predictions.length === 0) return [];
   // console.log(`🔧 Умная постобработка: ${predictions.length} объектов`);
   
    // ❌ УБИРАЕМ нормализацию ориентации из постобработки
    // const normalizedPredictions = normalizeOrientation(predictions); // УДАЛИТЬ ЭТУ СТРОКУ
   
    const filtered = predictions.filter(pred => {  // ← МЕНЯЕМ normalizedPredictions на predictions
        if (!pred.points || pred.points.length < 3) return false;
        const bbox = calculateBoundingBox(pred.points);
        const area = bbox.width * bbox.height;
        return area > 100;
    });

    const optimized = filtered.map(pred => {
        if (pred.points.length <= 6) return pred;
        const optimizedPoints = simplifyPolygon(pred.points, getEpsilonForClass(pred.class));
        return {
            ...pred,
            points: optimizedPoints
        };
    });

    // 📊 АНАЛИЗИРУЕМ ОРИЕНТАЦИЮ ДЛЯ ОТЧЕТА (но не меняем координаты)
    const orientationType = analyzeOrientationType(optimized);
   // console.log(`🧭 Тип ориентации: ${orientationType}`);
   
   // console.log(`✅ После постобработки: ${optimized.length} объектов`);
    return optimized;
}

function simplifyPolygon(points, epsilon = 1.0) {
    if (points.length <= 4) return points;

    function douglasPecker(points, epsilon) {
        if (points.length <= 2) return points;
        let maxDistance = 0;
        let index = 0;
        const start = points[0];
        const end = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }

        if (maxDistance > epsilon) {
            const left = douglasPecker(points.slice(0, index + 1), epsilon);
            const right = douglasPecker(points.slice(index), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [start, end];
        }
    }

    function perpendicularDistance(point, lineStart, lineEnd) {
        const area = Math.abs(
            (lineEnd.x - lineStart.x) * (lineStart.y - point.y) -
            (lineStart.x - point.x) * (lineEnd.y - lineStart.y)
        );
        const lineLength = Math.sqrt(
            Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2)
        );
        return area / lineLength;
    }

    return douglasPecker(points, epsilon);
}

function calculateBoundingBox(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
}

// =============================================================================
// 🧭 НОРМАЛИЗАЦИЯ ОРИЕНТАЦИИ СЛЕДОВ
// =============================================================================

/**
* Вычисляет угол поворота следа относительно горизонта
*/
function calculateOrientationAngle(points) {
    console.log('🧭 Вычисляю угол ориентации следа...');
   
    if (!points || points.length < 3) {
        console.log('⚠️ Недостаточно точек для вычисления ориентации');
        return 0;
    }

    try {
        // 1. ВЫЧИСЛЯЕМ ЦЕНТР МАСС
        const center = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
       
        center.x /= points.length;
        center.y /= points.length;

        // 2. ВЫЧИСЛЯЕМ УГОЛ ЧЕРЕЗ МЕТОД ГЛАВНЫХ КОМПОНЕНТ
        let xx = 0, yy = 0, xy = 0;
       
        points.forEach(point => {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            xx += dx * dx;
            yy += dy * dy;
            xy += dx * dy;
        });

        // 3. ВЫЧИСЛЯЕМ УГОЛ НАКЛОНА
        const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
        const degrees = angle * (180 / Math.PI);
       
        console.log(`📐 Вычисленный угол поворота: ${degrees.toFixed(2)}°`);
        return degrees;

    } catch (error) {
        console.log('❌ Ошибка вычисления ориентации:', error.message);
        return 0;
    }
}

/**
* Нормализует ориентацию предсказаний (поворачивает к горизонтали)
*/
function normalizeOrientation(predictions) {
    console.log('🔄 Нормализую ориентацию следов...');
   
    if (!predictions || predictions.length === 0) {
        return predictions;
    }

    try {
        // ИЩЕМ КОНТУР СЛЕДА ДЛЯ ОПРЕДЕЛЕНИЯ ОРИЕНТАЦИИ
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline || !outline.points) {
            console.log('⚠️ Контур не найден, ориентация не изменена');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ УГОЛ ПОВОРОТА
        const angle = calculateOrientationAngle(outline.points);
       
        // ЕСЛИ УГОЛ МАЛЕНЬКИЙ - НЕ ПОВОРАЧИВАЕМ
        if (Math.abs(angle) < 5) {
            console.log('✅ След уже ориентирован нормально (<5°)');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ ЦЕНТР КОНТУРА
        const bbox = calculateBoundingBox(outline.points);
        const center = {
            x: bbox.minX + bbox.width / 2,
            y: bbox.minY + bbox.height / 2
        };

        // ПОВОРАЧИВАЕМ ВСЕ ТОЧКИ ВСЕХ ПРЕДСКАЗАНИЙ
        const rad = -angle * (Math.PI / 180); // минус для компенсации
       
        const normalizedPredictions = predictions.map(pred => {
            if (!pred.points) return pred;
           
            return {
                ...pred,
                points: pred.points.map(point => {
                    // ПЕРЕНОСИМ В ЦЕНТР КООРДИНАТ
                    const dx = point.x - center.x;
                    const dy = point.y - center.y;
                   
                    // ПОВОРАЧИВАЕМ
                    const newX = dx * Math.cos(rad) - dy * Math.sin(rad);
                    const newY = dx * Math.sin(rad) + dy * Math.cos(rad);
                   
                    // ВОЗВРАЩАЕМ НА МЕСТО
                    return {
                        x: newX + center.x,
                        y: newY + center.y
                    };
                })
            };
        });

        console.log(`✅ Ориентация нормализована: поворот на ${angle.toFixed(1)}°`);
        return normalizedPredictions;

    } catch (error) {
        console.log('❌ Ошибка нормализации ориентации:', error.message);
        return predictions;
    }
}

/**
* Определяет тип ориентации (левый/правый/прямой) с порогами
*/
function analyzeOrientationType(predictions) {
    if (!predictions || predictions.length === 0) {
        return 'unknown';
    }

    try {
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline) return 'unknown';

        const angle = calculateOrientationAngle(outline.points);
       
        // 🔧 НАСТРАИВАЕМ ПОРОГИ ДЛЯ БОЛЕЕ ТОЧНОЙ КЛАССИФИКАЦИИ
        if (Math.abs(angle) < 8) return 'aligned';          // ±8° - нормально
        if (angle > 8 && angle <= 45) return 'rotated_clockwise';
        if (angle < -8 && angle >= -45) return 'rotated_counterclockwise';
        if (Math.abs(angle) > 45) return 'strongly_rotated'; // Сильный поворот
       
        return 'aligned';
       
    } catch (error) {
        return 'unknown';
    }
}

function getEpsilonForClass(className) {
    switch(className) {
        case 'shoe-protector': return 1.5;
        case 'Outline-trail': return 0.8;
        case 'Heel': return 1.0;
        case 'Toe': return 1.0;
        default: return 1.2;
    }
}

// =============================================================================
// 📐 АНАЛИЗ ПЕРСПЕКТИВНЫХ ИСКАЖЕНИЙ
// =============================================================================

/**
* Анализирует перспективные искажения на изображении следа
*/
function analyzePerspectiveDistortion(predictions, imageWidth, imageHeight) {
    console.log('📐 Анализирую перспективные искажения...');
   
    const analysis = {
        hasPerspectiveIssues: false,
        confidence: 'high',
        issues: [],
        recommendations: []
    };

    try {
        if (!predictions || predictions.length === 0) {
            analysis.confidence = 'low';
            return analysis;
        }

        // ИЩЕМ КОНТУР ДЛЯ АНАЛИЗА
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline || !outline.points) {
            analysis.confidence = 'medium';
            analysis.issues.push('контур_не_найден');
            return analysis;
        }

        const points = outline.points;
       
        // 1. АНАЛИЗ СООТНОШЕНИЯ СТОРОН
        const bbox = calculateBoundingBox(points);
        const aspectRatio = bbox.width / bbox.height;
       
        if (aspectRatio < 0.3 || aspectRatio > 3.0) {
            analysis.hasPerspectiveIssues = true;
            analysis.issues.push('неестественное_соотношение_сторон');
            analysis.recommendations.push('снимать под прямым углом к следу');
        }

        // 2. АНАЛИЗ РАЗМЕРА ОТНОСИТЕЛЬНО КАДРА
        const frameRatio = (bbox.width * bbox.height) / (imageWidth * imageHeight);
        if (frameRatio < 0.1) {
            analysis.issues.push('след_слишком_мал');
            analysis.recommendations.push('приблизьте камеру к следу');
        } else if (frameRatio > 0.8) {
            analysis.issues.push('след_занимает_весь_кадр');
            analysis.recommendations.push('немного отдалите камеру');
        }

        console.log(`📐 Результат анализа перспективы:`, {
            issues: analysis.issues.length,
            hasProblems: analysis.hasPerspectiveIssues
        });

        return analysis;

    } catch (error) {
        console.log('❌ Ошибка анализа перспективы:', error.message);
        analysis.confidence = 'low';
        return analysis;
    }
}

/**
* Вычисляет симметрию контура следа (упрощенная версия)
*/
function calculateOutlineSymmetry(points) {
    if (!points || points.length < 4) return 1.0;
   
    try {
        const bbox = calculateBoundingBox(points);
        // Упрощенный расчет симметрии
        return 0.8; // Базовая оценка
    } catch (error) {
        return 1.0;
    }
}

/**
* Анализирует равномерность распределения деталей (упрощенная версия)
*/
function analyzeDetailDistribution(predictions) {
    const details = predictions.filter(pred =>
        pred.class === 'shoe-protector' && pred.points
    );
   
    if (details.length < 3) return 1.0;
   
    try {
        // Упрощенный расчет равномерности
        return 0.7; // Базовая оценка
    } catch (error) {
        return 1.0;
    }
}
// =============================================================================
// 🎯 ИСПРАВЛЕННЫЙ АЛГОРИТМ СРАВНЕНИЯ (БЕЗ NaN)
// =============================================================================

function compareFootprints(referenceFeatures, footprintFeatures) {
    console.log('🔍 УЛУЧШЕННОЕ СРАВНЕНИЕ: эталон vs след');
   
    // ЗАЩИТА ОТ NaN - гарантируем числовые значения
    const refDetails = Math.max(referenceFeatures.detailCount || 0, 1);
    const footprintDetails = Math.max(footprintFeatures.detailCount || 0, 1);

    const scores = {
        patternSimilarity: 0,    // Схожесть узора (40%)
        spatialDistribution: 0,  // Пространственное распределение (30%)
        detailMatching: 0,       // Совпадение деталей (20%)
        shapeConsistency: 0,     // Соответствие форм (10%)
        overallScore: 0
    };

    // 1. Схожесть узора (40%) - сравниваем распределение деталей
    const countRatio = Math.min(refDetails, footprintDetails) / Math.max(refDetails, footprintDetails);
    scores.patternSimilarity = Math.round(countRatio * 25);
   
    // Бонус за достаточное количество деталей
    if (refDetails > 10 && footprintDetails > 10) {
        scores.patternSimilarity += 15;
    }
    scores.patternSimilarity = Math.min(scores.patternSimilarity, 40);

    // 2. Пространственное распределение (30%)
    const refDensity = referenceFeatures.density || 1;
    const footprintDensity = footprintFeatures.density || 1;
    const densitySimilarity = 1 - Math.abs(refDensity - footprintDensity) / Math.max(refDensity, footprintDensity);
    scores.spatialDistribution = Math.round(densitySimilarity * 30);

    // 3. Совпадение деталей (20%)
    const commonDetails = Math.min(refDetails, footprintDetails);
    const maxDetails = Math.max(refDetails, footprintDetails);
    scores.detailMatching = Math.round((commonDetails / maxDetails) * 20);

    // 4. Соответствие форм (10%) - базовый score
    scores.shapeConsistency = 8;
    if (referenceFeatures.hasOutline && footprintFeatures.hasOutline) {
        scores.shapeConsistency += 2;
    }

    // ОБЩИЙ СЧЕТ (гарантируем число)
    scores.overallScore = Math.min(
        scores.patternSimilarity + scores.spatialDistribution + scores.detailMatching + scores.shapeConsistency,
        100
    );

    console.log('📊 Улучшенные результаты:', scores);
    return scores;
}

// =============================================================================
// 🔄 ЗЕРКАЛЬНОЕ СРАВНЕНИЕ (ЛЕВЫЙ/ПРАВЫЙ БОТИНОК)
// =============================================================================

function mirrorFootprint(footprintFeatures) {
    // Простое зеркалирование - инвертируем spatial характеристики
    return {
        ...footprintFeatures,
        density: footprintFeatures.density,
        spatialSpread: -footprintFeatures.spatialSpread // упрощенное зеркалирование
    };
}

function compareWithMirror(referenceFeatures, footprintFeatures, footprintPredictions = []) {
    // Обычное сравнение
    const normalScore = compareFootprints(referenceFeatures, footprintFeatures);
   
    // Зеркальное сравнение (для левый/правый)
    const mirroredScore = compareFootprints(referenceFeatures, mirrorFootprint(footprintFeatures));
   
    // 🔥 ДОБАВЛЯЕМ УЧЕТ ОРИЕНТАЦИИ ПРИ СРАВНЕНИИ
    let orientationAdjustedScore = normalScore.overallScore;
   
    try {
        const orientationType = analyzeOrientationType(footprintPredictions);
        const orientationAngle = calculateOrientationAngle(
            footprintPredictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            )?.points || []
        );
       
        // 🔧 КОРРЕКТИРУЕМ SCORE В ЗАВИСИМОСТИ ОТ УГЛА ПОВОРОТА
        if (Math.abs(orientationAngle) > 15) {
            // Сильный поворот - снижаем точность
            const rotationPenalty = Math.min(Math.abs(orientationAngle) * 0.5, 25);
            orientationAdjustedScore = Math.max(0, normalScore.overallScore - rotationPenalty);
            console.log(`📐 Учет ориентации: угол ${orientationAngle.toFixed(1)}°, штраф ${rotationPenalty.toFixed(1)}%`);
        }
    } catch (error) {
        console.log('⚠️ Не удалось учесть ориентацию при сравнении:', error.message);
    }
   
    // Возвращаем лучший результат с учетом ориентации
    const bestScore = Math.max(orientationAdjustedScore, mirroredScore.overallScore);
   
    console.log(`🔄 Сравнение: обычный=${normalScore.overallScore}%, ориентация=${orientationAdjustedScore}%, зеркальный=${mirroredScore.overallScore}%`);
   
    return {
        ...normalScore,
        overallScore: bestScore,
        mirrorUsed: bestScore !== orientationAdjustedScore,
        orientationAdjusted: orientationAdjustedScore !== normalScore.overallScore,
        orientationAngle: calculateOrientationAngle(
            footprintPredictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            )?.points || []
        )
    };
}


// 🎯 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ:

function calculatePatternMatch(ref, footprint) {
    // Сравнение количества и типа деталей
    const baseScore = Math.min(
        (footprint.detailCount / Math.max(ref.detailCount, 1)) * 80,
        80
    );
    // Бонус за наличие контура
    const outlineBonus = (footprint.hasOutline && ref.hasOutline) ? 20 : 0;
    return Math.min(baseScore + outlineBonus, 100);
}

function calculateSpatialMatch(ref, footprint) {
    // Для пространственного анализа нужно минимум 3 детали
    if (ref.detailCount < 3 || footprint.detailCount < 3) return 40;
   
    // Сравнение плотности деталей
    const densitySimilarity = Math.min(
        footprint.detailCount / Math.max(ref.detailCount, 1),
        1
    ) * 60;
   
    return 40 + densitySimilarity; // Базовый 40% + плотность
}

function calculateDetailMatch(ref, footprint) {
    // Сравнение крупных деталей
    const largeDetailsScore = footprint.largeDetails > 0 ?
        Math.min((footprint.largeDetails / Math.max(ref.largeDetails, 1)) * 70, 70) : 0;
   
    // Бонус за сложность узора (много мелких деталей)
    const complexityBonus = (footprint.detailCount > 8) ? 30 : 0;
   
    return Math.min(largeDetailsScore + complexityBonus, 100);
}

function calculateShapeMatch(ref, footprint) {
    let score = 50; // Базовый счет
   
    // Бонусы за характерные особенности
    if (footprint.hasOutline) score += 30;
    if (footprint.largeDetails > 2) score += 20;
   
    return Math.min(score, 100);
}

// =============================================================================
// 📊 УЛУЧШЕННОЕ ИЗВЛЕЧЕНИЕ FEATURES (С ПЛОТНОСТЬЮ)
// =============================================================================

function extractFeatures(predictions) {
    console.log(`📊 Извлекаем улучшенные features из ${predictions.length} предсказаний`);
   
    const features = {
        detailCount: predictions.length,
        hasOutline: false,
        largeDetails: 0,
        density: 1,  // гарантируем значение по умолчанию
        spatialSpread: 0
    };

    // ЗАЩИТА ОТ ПУСТЫХ ДАННЫХ
    if (!predictions || predictions.length === 0) {
        return features;
    }

    let totalArea = 0;
    const centers = [];

    predictions.forEach(pred => {
        if (pred.class && pred.class.includes('Outline')) {
            features.hasOutline = true;
        }

        // Считаем площадь и центры для анализа распределения
        if (pred.points && pred.points.length > 3) {
            const bbox = calculateBoundingBox(pred.points);
            const area = bbox.width * bbox.height;
            totalArea += area;
           
            if (area > 1000) {
                features.largeDetails++;
            }

            // Сохраняем центры для анализа распределения
            centers.push({
                x: bbox.x + bbox.width / 2,
                y: bbox.y + bbox.height / 2
            });
        }
    });

    // Рассчитываем плотность деталей (защита от деления на ноль)
    if (centers.length > 0 && totalArea > 0) {
        features.density = centers.length / (totalArea / 1000); // деталей на 1000px²
    }

    console.log('📊 Улучшенные features:', features);
    return features;
}


// =============================================================================
// 🎨 ВИЗУАЛИЗАЦИЯ (БЕЗ ПОДПИСЕЙ)
// =============================================================================

async function createAnalysisVisualization(imageUrl, predictions, userData = {}) {
    if (!imageUrl || !predictions) {
        console.log('❌ Ошибка: нет imageUrl или predictions');
        return null;
    }

    if (predictions.length > 50) {
        console.log(`⚠️ Слишком много объектов (${predictions.length}), ограничиваем визуализацию`);
        predictions = predictions.slice(0, 50);
    }

    try {
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Рисуем оригинальное фото
        ctx.drawImage(image, 0, 0);

        // Цвета для разных классов
        const colors = {
            'Outline-trail': 'rgba(148, 0, 211, 0.8)',
            'shoe-protector': 'rgba(64, 224, 208, 0.7)',
            'Heel': 'rgba(0, 0, 255, 0.6)',
            'Toe': 'rgba(30, 144, 255, 0.6)'
        };

        // Рисуем полигоны БЕЗ ПОДПИСЕЙ
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 2) {
                const color = colors[pred.class] || 'rgba(255, 255, 255, 0.7)';
               
                ctx.strokeStyle = color;
                ctx.lineWidth = pred.class === 'Outline-trail' ? 4 : 2;
                ctx.beginPath();
               
                ctx.moveTo(pred.points[0].x, pred.points[0].y);
                for (let i = 1; i < pred.points.length; i++) {
                    ctx.lineTo(pred.points[i].x, pred.points[i].y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        });

        // Водяной знак
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, image.height - 80, 300, 70);
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`👤 ${userData.username || 'Пользователь'}`, 20, image.height - 55);
        ctx.fillText(`📅 ${new Date().toLocaleString('ru-RU')}`, 20, image.height - 35);
        ctx.fillText(`🔍 Анализатор следов обуви`, 20, image.height - 15);

        const vizPath = `viz_${Date.now()}.jpg`;
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
        fs.writeFileSync(vizPath, buffer);

        return vizPath;

    } catch (error) {
        console.log('❌ Ошибка визуализации:', error.message);
        return null;
    }
}

// =============================================================================
// 🦴 ВИЗУАЛИЗАЦИЯ "СКЕЛЕТ СЛЕДА" - ЦЕНТРЫ ДЕТАЛЕЙ ПРОТЕКТОРА
// =============================================================================

async function createSkeletonVisualization(imageUrl, predictions, userData) {
    try {
        console.log('🕵️‍♂️ Создаю карту морфологических признаков...');
       
        // Загружаем изображение
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // ВРЕМЕННО: уберем полупрозрачность для теста
        ctx.drawImage(image, 0, 0);

        // ФИЛЬТРУЕМ: ТОЛЬКО ДЕТАЛИ ПРОТЕКТОРА
        const details = predictions.filter(pred =>
            pred.class === 'shoe-protector'
        );

        console.log(`🕵️‍♂️ Найдено ${details.length} морфологических признаков`);
      
        // ВРЕМЕННО: простая функция для bounding box если нет calculateBoundingBox
        function getBoundingBox(points) {
            let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
            points.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }

        // Вычисляем центры
        const centers = details.map(pred => {
            const bbox = getBoundingBox(pred.points);
            return {
                x: bbox.x + bbox.width / 2,
                y: bbox.y + bbox.height / 2,
                class: pred.class
            };
        });

        console.log(`🕵️‍♂️ Вычислено ${centers.length} точек анализа`);

        // 1. РИСУЕМ СВЯЗИ МЕЖДУ ЦЕНТРАМИ
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)'; // Более яркий цвет
        ctx.lineWidth = 2; // Толще линии
       
        const MAX_DISTANCE = Math.min(image.width, image.height) * 0.15;
       
        for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
                const dist = Math.sqrt(
                    Math.pow(centers[i].x - centers[j].x, 2) +
                    Math.pow(centers[i].y - centers[j].y, 2)
                );
               
                if (dist < MAX_DISTANCE) {
                    ctx.beginPath();
                    ctx.moveTo(centers[i].x, centers[i].y);
                    ctx.lineTo(centers[j].x, centers[j].y);
                    ctx.stroke();
                }
            }
        }

        // 2. РИСУЕМ ТОЧКИ ЦЕНТРОВ (крупные и яркие)
        centers.forEach(center => {
            // Большие красные точки
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 8, 0, Math.PI * 2); // Увеличил радиус
            ctx.fill();

            // Белая обводка
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
        });

        // 3. КОНТУР СЛЕДА (если есть)
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );
       
        if (outline && outline.points) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]); // Более заметный пунктир
           
            ctx.beginPath();
            ctx.moveTo(outline.points[0].x, outline.points[0].y);
           
            for (let i = 1; i < outline.points.length; i++) {
                ctx.lineTo(outline.points[i].x, outline.points[i].y);
            }
           
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 4. ТЕКСТ
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 30px Arial';
        ctx.strokeText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
        ctx.fillText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
       
        ctx.font = '20px Arial';
        ctx.strokeText(`Признаки: ${details.length}`, 20, 70);
        ctx.fillText(`Признаки: ${details.length}`, 20, 70);       
        ctx.strokeText(`Точки анализа: ${centers.length}`, 20, 95);
        ctx.fillText(`Точки анализа: ${centers.length}`, 20, 95);

        // Сохраняем
        const tempPath = `skeleton_${Date.now()}.png`;
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(tempPath, buffer);

        console.log('✅ Скелетная визуализация создана успешно!');
        return tempPath;

    } catch (error) {
        console.error('❌ Ошибка создания скелетной визуализации:', error);
        return null;
    }
}

// =============================================================================
// 💾 СИСТЕМА СЕССИЙ И ЭТАЛОНОВ
// =============================================================================

function getSession(chatId) {
    if (!photoSessions.has(chatId)) {
        photoSessions.set(chatId, {
            active: false,
            photos: [],
            startTime: null,
            waitingForReference: null,
            waitingForComparison: null
        });
    }
    return photoSessions.get(chatId);
}

function updateUserStats(userId, username, action = 'photo') {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            username: username || `user_${userId}`,
            photosCount: 0,
            analysesCount: 0,
            sessionsCount: 0,
            comparisonsCount: 0,
            firstSeen: new Date(),
            lastSeen: new Date()
        });
        globalStats.totalUsers++;
    }

    const user = userStats.get(userId);
    user.lastSeen = new Date();

    switch(action) {
        case 'photo':
            user.photosCount++;
            globalStats.totalPhotos++;
            break;
        case 'analysis':
            user.analysesCount++;
            globalStats.totalAnalyses++;
            break;
        case 'session':
            user.sessionsCount++;
            globalStats.sessionsStarted++;
            break;
        case 'comparison':
            user.comparisonsCount++;
            globalStats.comparisonsMade++;
            break;
    }

    if (globalStats.totalPhotos % 10 === 0) {
        saveStats();
    }
}

function saveStats() {
    try {
        const statsData = {
            global: globalStats,
            users: Array.from(userStats.entries()),
            timestamp: new Date().toISOString()
        };

        console.log('💾 Статистика обновлена');

        // 🔄 СОХРАНЯЕМ В YANDEX DISK
        if (yandexDisk) {
            setTimeout(async () => {
                try {
                    const tempStatsPath = 'stats_backup.json';
                    fs.writeFileSync(tempStatsPath, JSON.stringify(statsData, null, 2));

                    await yandexDisk.uploadFile(tempStatsPath, 'stats.json');
                    console.log('✅ Статистика сохранена в Яндекс.Диск');

                    // Удаляем временный файл
                    try {
                        if (fs.existsSync(tempStatsPath)) {
                            fs.unlinkSync(tempStatsPath);
                        }
                    } catch (unlinkError) {
                        // Игнорируем ошибку удаления
                    }
                } catch (driveError) {
                    console.log('⚠️ Ошибка сохранения в Яндекс.Диск:', driveError.message);
                }
            }, 1000);
        }
    } catch (error) {
        console.log('❌ Ошибка сохранения статистики:', error.message);
    }
}

// 🔄 ЗАГРУЗКА СТАТИСТИКИ ИЗ ПУБЛИЧНОЙ ССЫЛКИ ЯНДЕКС.ДИСКА
async function loadStatsFromPublicLink() {
    try {
        console.log('🔄 Загрузка статистики по публичной ссылке...');

        const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=https://disk.yandex.ru/d/vjXtSXW8otwaNg`;

        const linkResponse = await axios.get(apiUrl, { timeout: 10000 });
        console.log('✅ Получена ссылка для скачивания');

        // Скачиваем как текст сначала
        const fileResponse = await axios.get(linkResponse.data.href, {
            timeout: 10000,
            responseType: 'text'
        });

        console.log('📥 Файл скачан, длина:', fileResponse.data.length);

        // Пробуем распарсить JSON
        const remoteStats = JSON.parse(fileResponse.data);

        // Проверяем структуру
        if (!remoteStats.global) {
            throw new Error('Неверная структура файла статистики');
        }

        // Обновляем статистику
        Object.assign(globalStats, remoteStats.global);
        userStats.clear();
       
        if (remoteStats.users && Array.isArray(remoteStats.users)) {
            remoteStats.users.forEach(([userId, userData]) => {
                userStats.set(userId, userData);
            });
        }

        console.log('🎯 Статистика загружена из облака');
        return true;

    } catch (error) {
        console.log('❌ Ошибка загрузки:', error.message);
        console.log('💫 Начинаем со свежей статистики');
        return false;
    }
}

// АВТОСОХРАНЕНИЕ КАЖДЫЕ 5 МИНУТ
setInterval(saveStats, 5 * 60 * 1000);

// =============================================================================
// 📱 ОСНОВНЫЕ КОМАНДЫ БОТА
// =============================================================================

bot.onText(/\/start/, async (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);
   
    await bot.sendMessage(msg.chat.id,
        `👟 **СИСТЕМА КРИМИНАЛИСТИЧЕСКОЙ ЭКСПЕРТИЗЫ ОТПЕЧАТКОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} экспертов, ${globalStats.totalPhotos} отпечатков\n\n` +
        `🔍 **ЭКСПЕРТНЫЕ РЕЖИМЫ:**\n` +
        `• **Базовый анализ** - отправьте фото отпечатка\n` +
        `• **/trail_start** - режим тропы\n` +
        `• **Сравнение с эталоном** - /compare\n\n` +
        `🕵️‍♂️ **РЕЖИМ ТРОПЫ:**\n` +
        `• Сессионный анализ multiple отпечатков\n` +
        `• Автоматическое сравнение внутри сессии\n` +
        `• Анализ тропы по результатам\n\n` +
        `📸 **Основные команды:**\n` +
        `• /save_reference - сохранить эталон подошвы\n` +
        `• /list_references - список эталонов\n` +
        `• /statistics - статистика системы\n` +
        `• /help - помощь\n\n` +
        `💡 **Для криминалистической точности:**\n` +
        `• Снимайте под прямым углом к отпечатку\n` +
        `• Избегайте теней и бликов\n` +
        `• Четкий фокус на деталях протектора\n\n` +
        `⚠️ *Система постоянно совершенствуется*`
    );
});

bot.onText(/\/statistics/, async (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;
   
    // ❌ УДАЛЯЕМ УПОМИНАНИЯ О СЕССИЯХ
    const stats = `📊 **СТАТИСТИКА БОТА:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `🔄 Сравнений сделано: ${globalStats.comparisonsMade}\n` +
                 `📅 Последний анализ: ${globalStats.lastAnalysis ?
                     globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;
   
    await bot.sendMessage(msg.chat.id, stats);
});

bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ И ИНФОРМАЦИЯ О СИСТЕМЕ**\n\n` +
        `🔍 **О СИСТЕМЕ:**\n` +
        `• Модель: ${MODEL_METADATA.name}\n` +
        `• Статус: ${MODEL_METADATA.status}\n` +
        `• Версия: ${MODEL_METADATA.version}\n\n` +
       
        `🎯 **ОСНОВНЫЕ КОМАНДЫ:**\n` +
        `• Просто отправьте фото - анализ следа\n` +
        `• /trail_start - режим анализа тропы\n` +
        `• /save_reference - сохранить эталон\n` +
        `• /compare - сравнить с эталоном\n\n` +
       
        `🧩 **НОВЫЕ ФУНКЦИИ СБОРКИ:**\n` +
        `• /assemble_model - собрать полную модель из частей\n` +
        `• /compare_footprints 1 3 - сравнить два отпечатка\n` +
        `• /show_groups - показать группы совместимости\n` +
        `• /save_assembled - сохранить собранную модель\n` +
        `• /detailed_stats - расширенная статистика\n` +
        `• /save_data - ручное сохранение данных\n\n` +
       
        `💡 **Рекомендации по съемке:**\n` +
        `- ${MODEL_METADATA.recommendations.join('\n- ')}\n\n` +
       
        `⚠️ **Ограничения системы:**\n` +
        `- ${MODEL_METADATA.limitations.join('\n- ')}`
    );
});

// =============================================================================
// 🔄 СИСТЕМА СРАВНЕНИЯ СЛЕДОВ
// =============================================================================

bot.onText(/\/compare$/, async (msg) => {
    const chatId = msg.chat.id;
   
    if (referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Сначала сохраните эталоны:\n' +
            '`/save_reference Название_Модели`\n\n' +
            'Или просто отправьте фото для быстрого анализа'
        );
        return;
    }

    let message = '🔍 **СРАВНЕНИЕ С ЭТАЛОНОМ**\n\n';
    message += '📝 **Укажите модель для сравнения:**\n';
   
    referencePrints.forEach((ref, modelName) => {
        const details = ref.features ? ref.features.detailCount : '?';
        message += `• \`/compare ${modelName}\` (${details} дет.)\n`;
    });
   
    message += '\n💡 **Или отправьте фото для быстрого анализа**';
   
    await bot.sendMessage(chatId, message);
});

bot.onText(/\/compare (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
    const session = getSession(chatId);

    const reference = referencePrints.get(modelName);
    if (!reference) {
        let message = `❌ Эталон "${modelName}" не найден\n\n`;
        message += '📋 **Доступные эталоны:**\n';
       
        referencePrints.forEach((ref, name) => {
            message += `• ${name}\n`;
        });
       
        await bot.sendMessage(chatId, message);
        return;
    }

    session.waitingForComparison = {
        modelName: modelName,
        reference: reference
    };
   
    await bot.sendMessage(chatId,
        `🔍 Сравниваю со следом: "${modelName}"\n\n` +
        '📸 **Отправьте фото следа:**\n' +
        '• След на грунте/песке\n' +
        '• Прямой угол съемки\n' +
        '• Хорошая четкость\n\n' +
        '🎯 **Алгоритм учитывает:**\n' +
        '• Крупные элементы узора\n' +
        '• Расположение деталей\n' +
        '• Характерные формы\n\n' +
        '❌ Для отмены: /cancel'
    );
});

// =============================================================================
// 💾 КОМАНДЫ ДЛЯ РАБОТЫ С ЭТАЛОНАМИ
// =============================================================================

bot.onText(/\/save_reference$/, async (msg) => {
    const chatId = msg.chat.id;
   
    await bot.sendMessage(chatId,
        '💾 **СОХРАНЕНИЕ ЭТАЛОННОГО ОТПЕЧАТКА**\n\n' +
        '📝 **Укажите название модели через пробел:**\n' +
        'Пример: `/save_reference Nike_Air_Max_90`\n\n' +
        '💡 **Рекомендации:**\n' +
        '• Фото чистой подошвы сверху\n' +
        '• Хорошее освещение без теней\n' +
        '• Четкий фокус на протекторе\n' +
        '• Название без пробелов (используйте _)\n\n' +
        '❌ Для отмены: /cancel'
    );
});

bot.onText(/\/save_reference (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
    const session = getSession(chatId);

    if (modelName.length < 2) {
        await bot.sendMessage(chatId, '❌ Название модели слишком короткое');
        return;
    }

    session.waitingForReference = modelName;
   
    await bot.sendMessage(chatId,
        `💾 Сохраняю эталон: "${modelName}"\n\n` +
        '📸 **Отправьте фото подошвы:**\n' +
        '• Чистая подошва, вид сверху\n' +
        '• Хорошее освещение\n' +
        '• Максимальная детализация\n\n' +
        '❌ Для отмены: /cancel'
    );
});

bot.onText(/\/list_references/, async (msg) => {
    const chatId = msg.chat.id;

    if (referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Для добавления эталонов:\n' +
            '`/save_reference Название_Модели`'
        );
        return;
    }

    let list = '📝 **СОХРАНЕННЫЕ ЭТАЛОНЫ:**\n\n';
    let counter = 1;

    referencePrints.forEach((ref, modelName) => {
        const date = ref.timestamp.toLocaleDateString('ru-RU');
        const details = ref.features ? ref.features.detailCount : '?';
        list += `${counter}. **${modelName}**\n`;
        list += `   📅 ${date} | 🔵 ${details} дет.\n\n`;
        counter++;
    });

    await bot.sendMessage(chatId, list);
});



bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getSession(chatId);
   
    session.waitingForReference = null;
    session.waitingForComparison = null; // ← ДОБАВЬТЕ ЭТУ СТРОКУ
   
    await bot.sendMessage(chatId, '❌ Операция отменена');
});



// =============================================================================
// 🕵️‍♂️ КОМАНДЫ РЕЖИМА ТРОПЫ
// =============================================================================

// 🚨 ВРЕМЕННОЕ РЕШЕНИЕ - добавить эту функцию
function getExpertSession(chatId, username) {
    console.log('⚠️ Вызвана старая функция getExpertSession - перенаправляю в getTrailSession');
    return getTrailSession(chatId, username);
}


bot.onText(/\/trail_start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
   
    console.log(`🕵️‍♂️ Запрос на создание сессии от ${username} (chatId: ${chatId})`);
   
    const session = getTrailSession(chatId, username);
   
    console.log(`✅ Сессия создана:`, {
        sessionId: session.sessionId,
        status: session.status,
        footprintsCount: session.footprints.length
    });
   
    await bot.sendMessage(chatId,
        `🕵️‍♂️ **РЕЖИМ ТРОПЫ АКТИВИРОВАН**\n\n` +
        `**Сессия:** ${session.sessionId}\n` +
        `**Эксперт:** ${username}\n` +
        `**Время начала:** ${session.startTime.toLocaleString('ru-RU')}\n\n` +
        `🔍 **Теперь все отпечатки будут автоматически:**\n` +
        `• Сохраняться в текущую сессию\n` +
        `• Сравниваться между собой\n` +
        `• Анализироваться на сходимость\n\n` +
        `📸 **Просто отправляйте фото отпечатков подошв**\n\n` +
        `**Команды эксперта:**\n` +
        `• /trail_status - статус сессии\n` +
        `• /trail_report - экспертное заключение\n` +
        `• /trail_notes - добавить заметки\n` +
        `• /trail_finish - завершить сессию\n\n` +
        `⚠️ *Все данные сохраняются только до перезапуска бота*`
    );
});

bot.onText(/\/trail_status/, async (msg) => {
    const chatId = msg.chat.id;
    const session = trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId,
            '❌ Активная сессия анализа тропы не найдена.\n' +
            'Используйте /trail_start для начала работы.'
        );
        return;
    }
   
    const summary = session.getSessionSummary();
   
    let status = `🕵️‍♂️ **РЕЖИМ ТРОПЫ АКТИВИРОВАН**\n\n`;
    status += `**ID:** ${summary.sessionId}\n`;
    status += `**Статус:** ${summary.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
    status += `**Отпечатков:** ${summary.footprintsCount}\n`;
    status += `**Сравнений:** ${summary.comparisonsCount}\n`;
    status += `**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n`;
    status += `**Длительность:** ${Math.round(summary.duration / 60000)} мин.\n`;
   
    if (session.notes) {
        status += `\n**Заметки эксперта:**\n${session.notes}`;
    }
   
    await bot.sendMessage(chatId, status);
});

bot.onText(/\/trail_report/, async (msg) => {
    const chatId = msg.chat.id;
    const session = trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для отчета.');
        return;
    }
   
    if (session.footprints.length < 2) {
        await bot.sendMessage(chatId,
            '📊 **Недостаточно данных для отчета**\n\n' +
            'Для генерации экспертного заключения требуется минимум 2 отпечатка.\n' +
            `Сейчас в сессии: ${session.footprints.length} отпечатков`
        );
        return;
    }
   
    const report = session.generateExpertReport();
    await bot.sendMessage(chatId, report);
});

bot.onText(/\/trail_notes(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const session = trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для добавления заметок.');
        return;
    }
   
    const notesText = match ? match[1] : null;
   
    if (!notesText) {
        await bot.sendMessage(chatId,
            '📝 **Добавление заметок к сессии**\n\n' +
            'Использование: `/expert_notes Ваш текст заметки`\n\n' +
            'Текущие заметки:\n' +
            (session.notes || 'Пока нет заметок')
        );
        return;
    }
   
    session.notes = notesText;
    await bot.sendMessage(chatId, '✅ Заметки эксперта сохранены');
});

bot.onText(/\/trail_finish/, async (msg) => {
    const chatId = msg.chat.id;
    const session = trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для завершения.');
        return;
    }
   
    session.status = 'completed';
    const report = session.generateExpertReport();
   
    await bot.sendMessage(chatId,
        `🔚 **СЕССИЯ АНАЛИЗА ТРОПЫ ЗАВЕРШЕНА**\n\n${report}\n\n` +
        `📁 Все данные сохранены до перезапуска бота.\n` +
        `🔄 Для новой сессии используйте /trail_start`
    );
});

// =============================================================================
// 🎯 НОВЫЕ КОМАНДЫ ДЛЯ СБОРКИ МОДЕЛЕЙ И СРАВНЕНИЙ
// =============================================================================

// 🔍 КОМАНДА ДЕТАЛЬНОГО СРАВНЕНИЯ
bot.onText(/\/compare_footprints (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const footprintIdA = parseInt(match[1]);
    const footprintIdB = parseInt(match[2]);
   
    console.log(`🔍 Запрос сравнения: ${footprintIdA} vs ${footprintIdB}`);
   
    const session = trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId,
            '❌ Активная сессия не найдена.\n' +
            'Используйте /trail_start для начала работы.'
        );
        return;
    }
   
    const footprintA = session.footprints.find(f => f.id === `footprint_${footprintIdA}`);
    const footprintB = session.footprints.find(f => f.id === `footprint_${footprintIdB}`);
   
    if (!footprintA || !footprintB) {
        await bot.sendMessage(chatId,
            '❌ Один или оба отпечатка не найдены.\n\n' +
            '📋 Доступные отпечатки:\n' +
            session.footprints.map(f => `• ${f.id.replace('footprint_', '')}: ${f.partType || 'неизвестно'}`).join('\n')
        );
        return;
    }
   
    await bot.sendMessage(chatId, '🎨 Создаю детальную визуализацию сравнения...');
   
    const visualizer = new ComparisonVisualizer();
    const vizPath = await visualizer.createComparisonVisualization(
        footprintA,
        footprintB,
        footprintA.imageUrl
    );
   
    if (vizPath) {
        const similarity = visualizer.calculateOverallSimilarity(footprintA, footprintB);
       
        await bot.sendPhoto(chatId, vizPath, {
            caption: `🔍 **ДЕТАЛЬНОЕ СРАВНЕНИЕ**\n\n` +
                    `🆔 Отпечатки: #${footprintIdA} vs #${footprintIdB}\n` +
                    `🎯 Общее сходство: ${similarity.toFixed(1)}%\n` +
                    `📊 Типы: ${footprintA.partType || 'неизв.'} vs ${footprintB.partType || 'неизв.'}\n\n` +
                    `💡 *Зеленый = совпадения, Красный = различия, Желтый = отсутствующие*`
        });
       
        // Удаляем временный файл
        fs.unlinkSync(vizPath);
    } else {
        await bot.sendMessage(chatId, '❌ Не удалось создать визуализацию сравнения');
    }
});

// 🧩 КОМАНДА СБОРКИ МОДЕЛИ
bot.onText(/\/assemble_model/, async (msg) => {
    const chatId = msg.chat.id;
   
    console.log(`🧩 Запрос сборки модели для чата ${chatId}`);
   
    const session = trailSessions.get(chatId);
    if (!session || session.footprints.length < 2) {
        await bot.sendMessage(chatId,
            '❌ Недостаточно отпечатков для сборки модели.\n\n' +
            'Требуется минимум 2 отпечатка.\n' +
            `Сейчас в сессии: ${session ? session.footprints.length : 0} отпечатков`
        );
        return;
    }
   
    await bot.sendMessage(chatId,
        '🧩 Начинаю сборку полной модели из доступных частей...\n' +
        '📊 Анализирую геометрию и совместимость...'
    );
   
    // Получаем размер изображения для анализа
    let imageWidth = 800, imageHeight = 600; // значения по умолчанию
    try {
        const firstFootprint = session.footprints[0];
        const image = await loadImage(firstFootprint.imageUrl);
        imageWidth = image.width;
        imageHeight = image.height;
    } catch (error) {
        console.log('⚠️ Не удалось получить размер изображения, использую значения по умолчанию');
    }
   
    const result = session.assembleModelFromParts(imageWidth, imageHeight);
   
    if (result.success) {
        const partsStats = session.getPartsStatistics();
       
        let message = `🧩 **МОДЕЛЬ УСПЕШНО СОБРАНА!**\n\n`;
        message += `📊 **Использовано отпечатков:** ${result.usedPrints.length}\n`;
        message += `🎯 **Полнота модели:** ${result.completeness}%\n`;
        message += `✅ **Уверенность:** ${result.confidence}%\n\n`;
       
        message += `📋 **Статистика частей:**\n`;
        message += `• Полные: ${partsStats.full}\n`;
        message += `• Пятки: ${partsStats.heel}\n`;
        message += `• Мыски: ${partsStats.toe}\n`;
        message += `• Центры: ${partsStats.center}\n\n`;
       
        message += `💾 **Сохранить как эталон:**\n`;
        message += '`/save_assembled "Название_Модели"`\n\n';
       
        message += `🔍 **Просмотреть группы:** /show_groups`;
       
        await bot.sendMessage(chatId, message);
    } else {
        await bot.sendMessage(chatId,
            `❌ **Сборка модели не удалась**\n\n` +
            `Причина: ${result.error}\n\n` +
            `💡 **Рекомендации:**\n` +
            `• Добавьте больше отпечатков\n` +
            `• Убедитесь в схожести следов\n` +
            `• Используйте /compare_footprints для проверки совместимости`
        );
    }
});

// 💾 КОМАНДА СОХРАНЕНИЯ СОБРАННОЙ МОДЕЛИ
bot.onText(/\/save_assembled (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
   
    console.log(`💾 Запрос сохранения собранной модели: "${modelName}"`);
   
    const session = trailSessions.get(chatId);
    if (!session || session.assembledModels.length === 0) {
        await bot.sendMessage(chatId,
            '❌ Нет собранных моделей для сохранения.\n' +
            'Сначала используйте /assemble_model'
        );
        return;
    }
   
    // Берем последнюю собранную модель
    const lastModel = session.assembledModels[session.assembledModels.length - 1];
   
    // Сохраняем как эталон
    referencePrints.set(modelName, {
        features: lastModel.model.features,
        imageUrl: lastModel.model.sourcePrints[0] ?
            session.footprints.find(f => f.id === lastModel.model.sourcePrints[0])?.imageUrl : '',
        timestamp: new Date(),
        predictions: lastModel.model.predictions,
        isAssembled: true,
        sourcePrints: lastModel.model.sourcePrints,
        completeness: lastModel.completeness,
        confidence: lastModel.confidence
    });
   
    await bot.sendMessage(chatId,
        `✅ **СОБРАННАЯ МОДЕЛЬ СОХРАНЕНА**\n\n` +
        `🏷️ **Название:** "${modelName}"\n` +
        `📊 **Источник:** ${lastModel.model.sourcePrints.length} отпечатков\n` +
        `🎯 **Полнота:** ${lastModel.completeness}%\n` +
        `✅ **Уверенность:** ${lastModel.confidence}%\n\n` +
        `💡 Используйте: \`/compare ${modelName}\` для сравнения`
    );
   
    // Автосохранение данных
    const dataManager = new DataPersistence();
    await dataManager.saveAllData();
});

// 📊 КОМАНДА ПОКАЗА ГРУПП СОВМЕСТИМОСТИ
bot.onText(/\/show_groups/, async (msg) => {
    const chatId = msg.chat.id;
   
    const session = trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId, '❌ Активная сессия не найдена');
        return;
    }
   
    session.updateCompatibilityGroups();
   
    if (session.compatibilityGroups.length === 0) {
        await bot.sendMessage(chatId,
            '❌ Группы совместимости не найдены.\n' +
            'Добавьте больше отпечатков для анализа.'
        );
        return;
    }
   
    let message = `📊 **ГРУППЫ СОВМЕСТИМОСТИ**\n\n`;
    message += `Обнаружено групп: ${session.compatibilityGroups.length}\n\n`;
   
    session.compatibilityGroups.forEach((group, index) => {
        message += `**Группа ${index + 1}** (${group.length} отпечатков):\n`;
       
        group.forEach(footprint => {
            const partType = footprint.partType || 'неизвестно';
            const footprintId = footprint.id.replace('footprint_', '');
            message += `• #${footprintId} - ${partType} (${footprint.assemblyPotential}% потенциал)\n`;
        });
       
        message += '\n';
    });
   
    message += `💡 **Для сборки модели используйте:** /assemble_model`;
   
    await bot.sendMessage(chatId, message);
});

// 💾 КОМАНДА РУЧНОГО СОХРАНЕНИЯ
bot.onText(/\/save_data/, async (msg) => {
    const chatId = msg.chat.id;
   
    await bot.sendMessage(chatId, '💾 Сохраняю все данные...');
   
    const dataManager = new DataPersistence();
    await dataManager.saveAllData();
   
    await bot.sendMessage(chatId,
        '✅ **Все данные сохранены!**\n\n' +
        '📊 Сохранено:\n' +
        `• Сессии: ${trailSessions.size}\n` +
        `• Эталоны: ${referencePrints.size}\n` +
        `• Пользователи: ${userStats.size}\n\n` +
        '💡 Данные будут восстановлены после перезапуска'
    );
});

// 📈 КОМАНДА РАСШИРЕННОЙ СТАТИСТИКИ
bot.onText(/\/detailed_stats/, async (msg) => {
    const chatId = msg.chat.id;
   
    const session = trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId, '❌ Активная сессия не найдена');
        return;
    }
   
    const report = session.generateEnhancedReport();
    await bot.sendMessage(chatId, report);
});

// 🔧 КОМАНДЫ ДЛЯ ТЕСТИРОВАНИЯ И ОТЛАДКИ

// Тест классификации частей
bot.onText(/\/test_classify/, async (msg) => {
    const chatId = msg.chat.id;
    const session = trailSessions.get(chatId);
   
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет отпечатков для тестирования');
        return;
    }
   
    let message = `🧪 **ТЕСТ КЛАССИФИКАЦИИ ЧАСТЕЙ**\n\n`;
   
    session.footprints.forEach((footprint, index) => {
        const partType = footprint.partType || 'не классифицирован';
        const potential = footprint.assemblyPotential || 0;
        message += `📸 Отпечаток ${index + 1}: ${partType} (потенциал: ${potential}%)\n`;
    });
   
    await bot.sendMessage(chatId, message);
});

// Сброс и очистка данных (для тестирования)
bot.onText(/\/debug_reset/, async (msg) => {
    const chatId = msg.chat.id;
   
    trailSessions.delete(chatId);
    const session = getTrailSession(chatId, msg.from.username || msg.from.first_name);
   
    await bot.sendMessage(chatId,
        '🔄 **СБРОС СЕССИИ ДЛЯ ТЕСТИРОВАНИЯ**\n\n' +
        'Сессия очищена и создана заново.\n' +
        'Можете начинать тестирование функций сборки.'
    );
});

// =============================================================================
// 📸 ОБРАБОТКА ФОТО
// =============================================================================

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        const session = getSession(chatId);

        // Проверка сохранения эталона
        if (session.waitingForReference) {
            const modelName = session.waitingForReference;

            await bot.sendMessage(chatId, '📥 Получено фото эталона, анализирую...');

            const photo = msg.photo[msg.photo.length - 1];
            const file = await bot.getFile(photo.file_id);
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

            const response = await axios({
                method: "POST",
                url: 'https://detect.roboflow.com/-zqyih/13',
                params: {
                    api_key: 'NeHOB854EyHkDbGGLE6G',
                    image: fileUrl,
                    confidence: 25,
                    overlap: 30,
                    format: 'json'
                },
                timeout: 30000
            });

            const predictions = response.data.predictions || [];
const processedPredictions = smartPostProcessing(predictions);
const finalPredictions = processedPredictions.length > 0 ? processedPredictions : predictions;

// 🔄 ДОБАВЛЯЕМ АНАЛИЗ ПЕРСПЕКТИВЫ ПРЯМО ЗДЕСЬ:
let perspectiveAnalysis = { hasPerspectiveIssues: false, issues: [], recommendations: [] };
try {
    // Получаем размеры изображения для анализа
    const image = await loadImage(fileUrl);
    perspectiveAnalysis = analyzePerspectiveDistortion(
        finalPredictions,
        image.width,
        image.height
    );
} catch (error) {
    console.log('⚠️ Не удалось проанализировать перспективу:', error.message);
}
              
            referencePrints.set(modelName, {
                features: {
                    detailCount: processedPredictions.length,
                    totalArea: 0
                },
                imageUrl: fileUrl,
                timestamp: new Date(),
                predictions: processedPredictions
            });

            session.waitingForReference = null;

            await bot.sendMessage(chatId,
                `✅ Эталон сохранен: "${modelName}"\n` +
                `📊 Детали: ${processedPredictions.length} элементов\n\n` +
                'Используйте `/list_references` для просмотра'
            );
            return;
        }

        // Обычная обработка фото
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');

        await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');

        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

        await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');

        const response = await axios({
            method: "POST",
            url: 'https://detect.roboflow.com/-zqyih/13',
            params: {
                api_key: 'NeHOB854EyHkDbGGLE6G',
                image: fileUrl,
                confidence: 25,
                overlap: 30,
                format: 'json'
            },
            timeout: 30000
        });

        const predictions = response.data.predictions || [];
        const processedPredictions = smartPostProcessing(predictions);
        const finalPredictions = processedPredictions.length > 0 ? processedPredictions : predictions;

// =============================================================================
// 📐 АНАЛИЗ ПЕРСПЕКТИВНЫХ ИСКАЖЕНИЙ
// =============================================================================

let perspectiveAnalysis = { hasPerspectiveIssues: false, issues: [], recommendations: [] };

try {
    console.log('📐 Запускаю анализ перспективных искажений...');
   
    // Получаем размеры изображения для анализа
    const image = await loadImage(fileUrl);
    console.log(`📏 Размер изображения: ${image.width}x${image.height}`);
   
    // ВЫЗЫВАЕМ ФУНКЦИЮ АНАЛИЗА ПЕРСПЕКТИВЫ
    perspectiveAnalysis = analyzePerspectiveDistortion(
        finalPredictions,
        image.width,
        image.height
    );
   
    console.log('📐 Результат анализа перспективы:', {
        hasIssues: perspectiveAnalysis.hasPerspectiveIssues,
        issues: perspectiveAnalysis.issues,
        confidence: perspectiveAnalysis.confidence
    });
   
} catch (error) {
    console.log('⚠️ Не удалось проанализировать перспективу:', error.message);
    perspectiveAnalysis = {
        hasPerspectiveIssues: false,
        issues: ['анализ_не_удался'],
        recommendations: ['не_удалось_оценить_качество_съемки'],
        confidence: 'low'
    };
}

// В обработчике bot.on('photo') - находим блок после perspectiveAnalysis:

// 🔧 ИСПРАВЛЕНИЕ: Создаем footprintFeatures если не существует
let footprintFeatures = extractFeatures(finalPredictions);     
     
// 🧩 АВТОМАТИЧЕСКИЙ АНАЛИЗ ЧАСТЕЙ СЛЕДА (ИСПРАВЛЕННАЯ ВЕРСИЯ)
try {
    console.log('🧩 Автоматический анализ части следа...');
   
    // Получаем размеры изображения для классификации
    const image = await loadImage(fileUrl);
    const imageWidth = image.width;
    const imageHeight = image.height;
   
    // Классифицируем часть следа
    const partType = footprintAssembler.classifyFootprintPart(
        finalPredictions,
        imageWidth,
        imageHeight
    );
   
    console.log(`📋 Классифицирован как: ${partType}`);
   
    // СОЗДАЕМ footprintFeatures ЕСЛИ ЕГО НЕТ
    if (!footprintFeatures) {
        footprintFeatures = extractFeatures(finalPredictions);
    }
   
    // Добавляем информацию в features
    footprintFeatures.partType = partType;
    footprintFeatures.imageSize = { width: imageWidth, height: imageHeight };
   
} catch (error) {
    console.log('⚠️ Не удалось проанализировать часть следа:', error.message);
}
          
        // Проверка сравнения с эталоном
        if (session.waitingForComparison) {
            const comparisonData = session.waitingForComparison;
            const modelName = comparisonData.modelName;
            const reference = comparisonData.reference;

            console.log(`🔍 Начинаем сравнение с эталоном "${modelName}"`);
            console.log('📊 Данные эталона:', reference);

            try {
                // ИСПРАВЛЕНИЕ: используем предсказания из эталона
                const referencePredictions = reference.predictions || [];
                const footprintPredictions = processedPredictions || finalPredictions || predictions || [];

                console.log(`📊 Эталон: ${referencePredictions.length} предсказаний`);
                console.log(`📊 След: ${footprintPredictions.length} предсказаний`);

                const footprintFeatures = extractFeatures(footprintPredictions);
                console.log('✅ Features следа:', footprintFeatures);

                const referenceFeatures = reference.features || { detailCount: 0 };
                console.log('✅ Features эталона:', referenceFeatures);

                // 🔥 ПЕРЕДАЕМ ПРЕДСКАЗАНИЯ ДЛЯ УЧЕТА ОРИЕНТАЦИИ
const comparisonResult = compareWithMirror(referenceFeatures, footprintFeatures, footprintPredictions);
                  
               // Формируем отчет
let report = `🔍 **СРАВНЕНИЕ С "${modelName}"**\n\n`;
report += `🎯 **Вероятность совпадения: ${Math.round(comparisonResult.overallScore)}%**\n\n`;

// 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ ОБ ОРИЕНТАЦИИ
if (comparisonResult.orientationAdjusted) {
    report += `📐 **Учет ориентации:** угол ${Math.abs(comparisonResult.orientationAngle).toFixed(1)}°\n`;
}
if (comparisonResult.mirrorUsed) {
    report += `🔄 **Учтена симметрия** (левый/правый ботинок)\n`;
}

report += `\n📈 **Детальный анализ:**\n`;
report += `• 🎨 Узор: ${Math.round(comparisonResult.patternSimilarity)}%\n`;
report += `• 📐 Расположение: ${Math.round(comparisonResult.spatialDistribution)}%\n`;
report += `• 🔍 Детали: ${Math.round(comparisonResult.detailMatching)}%\n`;
report += `• ⭐ Формы: ${Math.round(comparisonResult.shapeConsistency)}%\n\n`;

if (comparisonResult.mirrorUsed) {
    report += `🔄 **Учтена симметрия** (левый/правый ботинок)\n\n`;
}

// Интерпретация результата
if (comparisonResult.overallScore > 70) {
    report += `✅ **ВЫСОКАЯ ВЕРОЯТНОСТЬ** - след соответствует модели`;
} else if (comparisonResult.overallScore > 50) {
    report += `🟡 **СРЕДНЯЯ ВЕРОЯТНОСТЬ** - возможное соответствие`;
} else if (comparisonResult.overallScore > 30) {
    report += `🟠 **НИЗКАЯ ВЕРОЯТНОСТЬ** - слабое соответствие`;
} else {
    report += `❌ **ВЕРОЯТНО НЕСООТВЕТСТВИЕ** - разные модели`;
}
                  
// Добавляем прозрачность модели
report += `\n\n---\n`;
report += `🔍 **ИНФОРМАЦИЯ О СИСТЕМЕ:**\n`;
report += `• Модель: ${MODEL_METADATA.name} (${MODEL_METADATA.status})\n`;
report += `• Уверенность анализа: ${comparisonResult.confidence}\n\n`;
report += `💡 **Рекомендации:** ${MODEL_METADATA.recommendations.join(', ')}`;
await bot.sendMessage(chatId, report);

                console.log('✅ Сравнение завершено успешно');

            } catch (error) {
                console.error('❌ Ошибка при сравнении:', error);
                console.error('❌ Stack trace:', error.stack);
                await bot.sendMessage(chatId,
                    '❌ Ошибка при сравнении следов. Попробуйте другое фото.\n\n' +
                    '💡 **Советы:**\n' +
                    '• Убедитесь в четкости фото\n' +
                    '• Прямой угол съемки\n' +
                    '• Хорошее освещение'
                );
            }

            session.waitingForComparison = null;
            updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'comparison');
            return;
        }

         // 🕵️‍♂️ ДОБАВЛЕНИЕ В ЭКСПЕРТНУЮ СЕССИЮ (ОБНОВЛЕННАЯ ВЕРСИЯ)
const trailSession = trailSessions.get(chatId);
if (trailSession && trailSession.status === 'active') {
    console.log(`🕵️‍♂️ [DEBUG] Активная сессия найдена! Добавляем отпечаток...`);
   
    const footprintData = {
        imageUrl: fileUrl,
        predictions: finalPredictions,
        features: extractFeatures(finalPredictions),
        perspectiveAnalysis: perspectiveAnalysis,
        orientation: {
            type: analyzeOrientationType(finalPredictions),
            angle: calculateOrientationAngle(
                finalPredictions.find(pred =>
                    pred.class === 'Outline-trail' || pred.class.includes('Outline')
                )?.points || []
            )
        },
        // 🔄 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ЧАСТИ СЛЕДА
        partType: footprintFeatures.partType,
        assemblyPotential: 0 // Будет вычислено позже
    };
   
    try {
        const footprintRecord = trailSession.addFootprint(footprintData);
       
        // 🔄 ОБНОВЛЯЕМ ПОТЕНЦИАЛ СБОРКИ
        if (trailSession.calculateAssemblyPotential) {
            footprintRecord.assemblyPotential = trailSession.calculateAssemblyPotential(footprintRecord);
        }
       
        console.log(`✅ [DEBUG] Отпечаток успешно добавлен в сессию! Всего: ${trailSession.footprints.length}`);
       
        // 🔄 АВТОМАТИЧЕСКИЙ АНАЛИЗ ГРУПП ПРИ ДОСТАТОЧНОМ КОЛИЧЕСТВЕ
        if (trailSession.footprints.length >= 3) {
            setTimeout(async () => {
                try {
                    if (trailSession.updateCompatibilityGroups) {
                        trailSession.updateCompatibilityGroups();
                        const groupsCount = trailSession.compatibilityGroups?.length || 0;
                        if (groupsCount > 0) {
                            await bot.sendMessage(chatId,
                                `🔄 **Обновление групп совместимости**\n\n` +
                                `Обнаружено групп: ${groupsCount}\n` +
                                `Для просмотра: /show_groups\n` +
                                `Для сборки: /assemble_model`
                            );
                        }
                    }
                } catch (groupError) {
                    console.log('⚠️ Ошибка автоматического анализа групп:', groupError.message);
                }
            }, 2000);
        }
       
    } catch (error) {
        console.log(`❌ [DEBUG] Ошибка добавления отпечатка:`, error.message);
    }
}
          
// 📤 ЗАГРУЗКА ФОТО НА ЯНДЕКС.ДИСК
if (yandexDisk) {
    try {
        const timestamp = Date.now();
        const photoId = `user_${msg.from.id}_${timestamp}`;
       
        // Загружаем оригинальное фото
        const tempPhotoPath = `temp_${photoId}.jpg`;
        const photoResponse = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });
       
        const writer = fs.createWriteStream(tempPhotoPath);
        photoResponse.data.pipe(writer);
       
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
       
        // Загружаем на Яндекс.Диск
        await yandexDisk.uploadFile(tempPhotoPath, `${photoId}.jpg`);
       
        // Удаляем временный файл
        fs.unlinkSync(tempPhotoPath);
       
        console.log(`✅ Фото загружено на Яндекс.Диск: ${photoId}.jpg`);
       
    } catch (uploadError) {
        console.log('⚠️ Ошибка загрузки на Яндекс.Диск:', uploadError.message);
    }
}
      
        if (finalPredictions.length > 0) {
    await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');
    const userData = {
        username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name
    };
    const vizPath = await createAnalysisVisualization(fileUrl, finalPredictions, userData);
   
    // 🔄 ОБНОВЛЕННЫЙ БЛОК С ПРОЗРАЧНОСТЬЮ И АНАЛИЗОМ ПЕРСПЕКТИВЫ
let baseCaption = `✅ Анализ завершен!\n🎯 Выявлено морфологических признаков: ${finalPredictions.length}`;

// 🕵️‍♂️ ИНФОРМАЦИЯ О СЕССИИ (если активна)
const trailSession = trailSessions.get(chatId);
if (trailSession && trailSession.status === 'active') {
    baseCaption += `\n\n🕵️‍♂️ **СЕССИЯ АНАЛИЗА ТРОПЫ**\n`;
    baseCaption += `• Отпечаток #${trailSession.footprints.length} зарегистрирован\n`;
   
    if (trailSession.comparisons.length > 0) {
        const lastComparison = trailSession.comparisons[trailSession.comparisons.length - 1];
        baseCaption += `• Автосравнение: ${lastComparison.similarity.toFixed(1)}% сходства\n`;
    }
}

// ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ПЕРСПЕКТИВЕ
if (perspectiveAnalysis.hasPerspectiveIssues) {
    baseCaption += `\n⚠️ **Обнаружены искажения:** ${perspectiveAnalysis.issues.join(', ')}`;
    if (perspectiveAnalysis.recommendations.length > 0) {
        baseCaption += `\n💡 **Рекомендации:** ${perspectiveAnalysis.recommendations.join(', ')}`;
    }
} else {
    baseCaption += `\n📐 Перспектива: нормальная`;
}

// АНАЛИЗ ОРИЕНТАЦИИ
const orientationType = analyzeOrientationType(finalPredictions);
const orientationText = {
    'aligned': '✅ Нормальная ориентация',
    'rotated_clockwise': '🔄 Поворот по часовой',
    'rotated_counterclockwise': '🔄 Поворот против часовой',
    'strongly_rotated': '⚠️ Сильный поворот',
    'unknown': '❓ Ориентация не определена'
};
const orientationAngle = calculateOrientationAngle(
    finalPredictions.find(pred =>
        pred.class === 'Outline-trail' || pred.class.includes('Outline')
    )?.points || []
);

if (orientationType !== 'unknown' && Math.abs(orientationAngle) > 0) {
    baseCaption += `\n🧭 ${orientationText[orientationType]} (${Math.abs(orientationAngle).toFixed(1)}°)`;
} else {
    baseCaption += `\n🧭 ${orientationText[orientationType]}`;
}

const transparentCaption = addModelTransparency(baseCaption, finalPredictions.length);
   
    if (vizPath) {
        await bot.sendPhoto(chatId, vizPath, {
            caption: transparentCaption  // ← ТЕПЕРЬ С ПРОЗРАЧНОСТЬЮ
        });
        fs.unlinkSync(vizPath);
       
        // Скелетная визуализация
        console.log('🔍 Пытаюсь создать скелетную визуализацию...');
        try {
            const skeletonPath = await createSkeletonVisualization(fileUrl, finalPredictions, userData);
            if (skeletonPath) {
    console.log('✅ Карта признаков создана, отправляю...');
    await bot.sendPhoto(chatId, skeletonPath, {
        caption: `🕵️‍♂️ Карта морфологических признаков протектора`
    });
    fs.unlinkSync(skeletonPath);
}
        } catch (error) {
            console.error('💥 Ошибка при создании скелетной визуализации:', error);
        }
    } else {
        await bot.sendMessage(chatId, transparentCaption);  // ← ТЕПЕРЬ С ПРОЗРАЧНОСТЬЮ
    }
} else {
            await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
        }

        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'analysis');

    } catch (error) {
        console.log('❌ Ошибка анализа фото:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка при анализе фото. Попробуйте еще раз.');
    }
});

// =============================================================================
// 🚀 ЗАПУСК СИСТЕМЫ
// ===============================================================
async function loadStats() {
    try {
        console.log('🔄 Загрузка статистики из Яндекс.Диска...');
       
        const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=https://disk.yandex.ru/d/vjXtSXW8otwaNg`;
        const linkResponse = await axios.get(apiUrl, { timeout: 10000 });
       
        const fileResponse = await axios.get(linkResponse.data.href, {
            timeout: 10000,
            responseType: 'text'
        });

        const remoteStats = JSON.parse(fileResponse.data);
       
        if (remoteStats.global) {
            Object.assign(globalStats, remoteStats.global);
            userStats.clear();
           
            if (remoteStats.users && Array.isArray(remoteStats.users)) {
                remoteStats.users.forEach(([userId, userData]) => {
                    userStats.set(userId, userData);
                });
            }
           
            console.log('✅ Статистика загружена:');
            console.log(`   👥 Пользователей: ${globalStats.totalUsers}`);
            console.log(`   📸 Фото: ${globalStats.totalPhotos}`);
        }
    } catch (error) {
        console.log('❌ Ошибка загрузки статистики:', error.message);
        console.log('💫 Начинаем со свежей статистики');
    }
}

// Автосохранение каждые 5 минут
setInterval(saveStats, 5 * 60 * 1000);

// Анти-сон система
setInterval(() => {
    console.log('🔄 Keep-alive ping:', new Date().toISOString());
}, 4 * 60 * 1000);

// Запуск сервера
app.listen(PORT, async () => {
    console.log(`🟢 HTTP сервер запущен на порту ${PORT}`);
   
    try {
        await bot.setWebHook(WEBHOOK_URL);
        console.log('✅ Webhook установлен');
    } catch (error) {
        console.log('❌ Ошибка установки webhook:', error.message);
    }
   
    // 🔄 ЗАГРУЖАЕМ СТАТИСТИКУ ИЗ ПУБЛИЧНОЙ ССЫЛКИ
    await loadStatsFromPublicLink();
   
    // 🔄 ЗАГРУЖАЕМ ДАННЫЕ СЕССИЙ И ЭТАЛОНОВ
    await dataPersistence.loadAllData();
   
    console.log('🤖 Бот полностью готов к работе!');
    console.log(`📊 Текущая статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото`);
    console.log(`💾 Восстановлено сессий: ${trailSessions.size}, эталонов: ${referencePrints.size}`);
});
// Обработчики ошибок
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
});

// 🔧 ДОБАВЛЯЕМ В КОНЕЦ ФАЙЛА:

// Обработчики ошибок для новых функций
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
   
    // Автосохранение при критических ошибках
    if (dataPersistence) {
        dataPersistence.saveAllData().catch(e => {
            console.error('❌ Не удалось сохранить данные при ошибке:', e);
        });
    }
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
   
    // Экстренное сохранение
    if (dataPersistence) {
        try {
            dataPersistence.saveAllData();
        } catch (e) {
            console.error('❌ Критическая ошибка сохранения:', e);
        }
    }
   
    process.exit(1);
});

// 🔧 Функция для безопасного завершения
async function gracefulShutdown() {
    console.log('🔄 Грациозное завершение работы...');
   
    try {
        await dataPersistence.saveAllData();
        console.log('✅ Все данные сохранены');
    } catch (error) {
        console.error('❌ Ошибка при завершении:', error);
    }
   
    process.exit(0);
}

// Обработчики сигналов завершения
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

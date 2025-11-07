// modules/sessions/sessionManager.js
const fs = require('fs');
const path = require('path');

class TrailSession {
    constructor(chatId, username, footprintAssembler) {
        this.chatId = chatId;
        this.expert = username;
        this.sessionId = `session_${chatId}_${Date.now()}`;
        this.startTime = new Date();
        this.footprints = [];
        this.comparisons = [];
        this.status = 'active';
        this.notes = '';

        // 🔧 ДОБАВЛЯЕМ ASSEMBLER
        this.footprintAssembler = footprintAssembler;

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
            orientation: analysisData.orientation,
            patternType: analysisData.patternType,
            assemblyPotential: analysisData.assemblyPotential || 0
        };

        this.footprints.push(footprintRecord);
        console.log(`🕵️♂️ Добавлен отпечаток в сессию ${this.sessionId}: ${footprintRecord.id}`);

        if (this.footprints.length > 1) {
            this.autoCompareWithPrevious(footprintRecord);
        }

        return footprintRecord;
    }

    autoCompareWithPrevious(newFootprint) {
        console.log(`🕵️♂️ Автосравнение нового отпечатка с предыдущими...`);

        const previousFootprints = this.footprints.slice(0, -1);

        previousFootprints.forEach((previous, index) => {
            const comparison = this.compareFootprints(previous.features, newFootprint.features);

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

    compareFootprints(referenceFeatures, footprintFeatures) {
        // Упрощенная версия функции сравнения для автосравнения
        const refDetails = Math.max(referenceFeatures.detailCount || 0, 1);
        const footprintDetails = Math.max(footprintFeatures.detailCount || 0, 1);

        const scores = {
            patternSimilarity: 0,
            spatialDistribution: 0,
            detailMatching: 0,
            shapeConsistency: 0,
            overallScore: 0
        };

        const countRatio = Math.min(refDetails, footprintDetails) / Math.max(refDetails, footprintDetails);
        scores.patternSimilarity = Math.round(countRatio * 25);

        if (refDetails > 10 && footprintDetails > 10) {
            scores.patternSimilarity += 15;
        }
        scores.patternSimilarity = Math.min(scores.patternSimilarity, 40);

        const refDensity = referenceFeatures.density || 1;
        const footprintDensity = footprintFeatures.density || 1;
        const densitySimilarity = 1 - Math.abs(refDensity - footprintDensity) / Math.max(refDensity, footprintDensity);
        scores.spatialDistribution = Math.round(densitySimilarity * 30);

        const commonDetails = Math.min(refDetails, footprintDetails);
        const maxDetails = Math.max(refDetails, footprintDetails);
        scores.detailMatching = Math.round((commonDetails / maxDetails) * 20);

        scores.shapeConsistency = 8;
        if (referenceFeatures.hasOutline && footprintFeatures.hasOutline) {
            scores.shapeConsistency += 2;
        }

        scores.overallScore = Math.min(
            scores.patternSimilarity + scores.spatialDistribution + scores.detailMatching + scores.shapeConsistency,
            100
        );

        return scores;
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

        let report = `🕵️♂️ **АНАЛИЗ ТРОПЫ**\n\n`;
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
        console.log(`🕵️♂️ Анализирую узоры протектора для ${this.footprints.length} отпечатков...`);

        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ
    if (!this.footprintAssembler) {
    console.log('⚠️ FootprintAssembler не доступен, используем заглушку');
    return { success: false, error: 'Система анализа временно недоступна' };
}

        const assembler = this.footprintAssembler;

        this.footprints.forEach(footprint => {
            const patternType = assembler.classifyFootprintPattern(
                footprint.predictions,
                imageWidth,
                imageHeight
            );
            footprint.patternType = patternType;
            footprint.partType = patternType;
            footprint.assemblyPotential = this.calculateAssemblyPotential(footprint);
            console.log(`📋 Отпечаток ${footprint.id}: ${patternType} (потенциал: ${footprint.assemblyPotential})`);
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

    // 🔧 ИСПРАВЛЯЕМ: убираем параметр footprintAssembler
    updateCompatibilityGroups() {
        console.log(`🕵️♂️ Автоматическая группировка следов по людям...`);

        this.compatibilityGroups = [];

        this.footprints.forEach(footprint => {
            let assignedToGroup = false;

            for (let group of this.compatibilityGroups) {
                const groupCompatibility = this.assessGroupCompatibility(group, footprint);

                if (groupCompatibility > 0.6) {
                    group.push(footprint);
                    assignedToGroup = true;
                    console.log(`✅ След ${footprint.id} добавлен в группу (совместимость: ${groupCompatibility.toFixed(3)})`);
                    break;
                }
            }

            if (!assignedToGroup) {
                this.compatibilityGroups.push([footprint]);
                console.log(`🆕 Создана новая группа для следа ${footprint.id}`);
            }
        });

        console.log(`🎯 Обнаружено групп (людей): ${this.compatibilityGroups.length}`);
    }

    // 🔧 ИСПРАВЛЯЕМ: убираем параметр footprintAssembler
    assessGroupCompatibility(group, newFootprint) {
        if (group.length === 0) return 0.5;

        let totalCompatibility = 0;

        group.forEach(existingFootprint => {
            const compatibility = this.calculateFootprintCompatibility(existingFootprint, newFootprint);
            totalCompatibility += compatibility;
        });

        return totalCompatibility / group.length;
    }

    calculateFootprintCompatibility(footprintA, footprintB) {
        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ
        if (!this.footprintAssembler) {
            console.log('❌ FootprintAssembler не доступен для сравнения');
            return 0.5;
        }

        const assembler = this.footprintAssembler;

        let imageWidth = 800, imageHeight = 600;
        if (footprintA.features?.imageSize) {
            imageWidth = footprintA.features.imageSize.width;
            imageHeight = footprintA.features.imageSize.height;
        }

        return assembler.advancedCompatibilityAnalysis(
            [footprintA],
            footprintB,
            imageWidth,
            imageHeight
        ) ? 0.8 : 0.2;
    }

    // 🔧 ИСПРАВЛЯЕМ: убираем параметр footprintAssembler
    assembleModelFromGroup(group, imageWidth, imageHeight) {
        if (group.length < 2) {
            return { success: false, error: 'Недостаточно следов в группе для сборки' };
        }

        console.log(`🧩 Сборка модели для группы из ${group.length} следов...`);

        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ
        if (!this.footprintAssembler) {
            return { success: false, error: 'Система анализа временно недоступна' };
        }

        if (!group[0].patternType) {
            group.forEach(footprint => {
                const patternType = this.footprintAssembler.classifyFootprintPattern(
                    footprint.predictions,
                    imageWidth,
                    imageHeight
                );
                footprint.patternType = patternType;
            });
        }

        const result = this.footprintAssembler.assembleFullModel(group, imageWidth, imageHeight);

        if (result.success) {
            console.log(`✅ Модель собрана из группы: ${result.completeness}% полноты`);
        }

        return result;
    }

    // 🔧 ИСПРАВЛЯЕМ: убираем параметр footprintAssembler
    assembleModelFromParts(imageWidth, imageHeight) {
        if (this.footprints.length < 2) {
            return { success: false, error: 'Недостаточно отпечатков для сборки' };
        }

        console.log(`🧩 Начинаю сборку модели из ${this.footprints.length} отпечатков...`);

        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКУ
        if (!this.footprintAssembler) {
            return { success: false, error: 'Система анализа временно недоступна' };
        }

        if (!this.footprints[0].partType) {
            this.analyzeFootprintParts(imageWidth, imageHeight);
        }

        const result = this.footprintAssembler.assembleFullModel(this.footprints, imageWidth, imageHeight);

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
        const parts = {
            left_small: 0, left_medium: 0, left_large: 0,
            right_small: 0, right_medium: 0, right_large: 0,
            center_small: 0, center_medium: 0, center_large: 0,
            unknown: 0
        };

        this.footprints.forEach(footprint => {
            const patternType = footprint.patternType || 'unknown';
            parts[patternType] = (parts[patternType] || 0) + 1;
        });

        return parts;
    }

    generateEnhancedReport() {
        const summary = this.getSessionSummary();
        const partsStats = this.getPartsStatistics();

        let report = `🕵️♂️ **РАСШИРЕННЫЙ АНАЛИЗ ТРОПЫ**\n\n`;
        report += `**Сессия:** ${summary.sessionId}\n`;
        report += `**Эксперт:** ${this.expert}\n`;
        report += `**Статус:** ${this.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
        report += `**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n\n`;

        report += `📊 **СТАТИСТИКА УЗОРОВ:**\n`;
        report += `• Всего: ${summary.footprintsCount}\n`;
        report += `• Левые: ${partsStats.left_small + partsStats.left_medium + partsStats.left_large}\n`;
        report += `• Правые: ${partsStats.right_small + partsStats.right_medium + partsStats.right_large}\n`;
        report += `• Центральные: ${partsStats.center_small + partsStats.center_medium + partsStats.center_large}\n`;
        report += `• Неизвестные: ${partsStats.unknown}\n\n`;

        report += `🔍 **СРАВНЕНИЯ:**\n`;
        report += `• Выполнено: ${summary.comparisonsCount}\n`;
        report += `• Средняя сходимость: ${summary.averageSimilarity.toFixed(1)}%\n\n`;

        report += `🧩 **СБОРКА МОДЕЛЕЙ:**\n`;
        report += `• Собрано моделей: ${this.assembledModels.length}\n`;
        report += `• Групп совместимости: ${this.compatibilityGroups.length}\n\n`;

        if (this.assembledModels.length > 0) {
            const bestModel = this.assembledModels.reduce((best, current) =>
                current.completeness > best.completeness ? current : best
            );
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

class SessionManager {
    constructor(footprintAssembler) {
        this.userStats = new Map();
        this.globalStats = {
            totalUsers: 0,
            totalPhotos: 0,
            totalAnalyses: 0,
            comparisonsMade: 0,
            lastAnalysis: null
        };
        this.referencePrints = new Map();
        this.trailSessions = new Map();
        this.footprintAssembler = footprintAssembler;
       this.photoSessions = new Map();
    }
serializeForSave() {
        return {
            trailSessions: this.serializeTrailSessions(),
            referencePrints: Array.from(this.referencePrints.entries()),
            userStats: Array.from(this.userStats.entries()),
            globalStats: this.globalStats,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
    }
serializeTrailSessions() {
        const serialized = [];
        this.trailSessions.forEach((session, chatId) => {
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
                    notes: session.notes,
                    assembledModels: session.assembledModels,
                    compatibilityGroups: session.compatibilityGroups
                }
            ]);
        });
        return serialized;
    }
  
    getTrailSession(chatId, username) {
        if (!this.trailSessions.has(chatId)) {
            // 🔧 ПЕРЕДАЕМ ASSEMBLER В СЕССИЮ
            this.trailSessions.set(chatId, new TrailSession(
                chatId,
                username,
                this.footprintAssembler
            ));
        }
        return this.trailSessions.get(chatId);
    }

    // ... остальные методы SessionManager без изменений
     getSession(chatId) {
        // 🔧 ИСПРАВИТЬ: использовать this.photoSessions
        if (!this.photoSessions.has(chatId)) {
            this.photoSessions.set(chatId, {
                active: false,
                photos: [],
                startTime: null,
                waitingForReference: null,
                waitingForComparison: null
            });
        }
        return this.photoSessions.get(chatId);
    }

    updateUserStats(userId, username, action = 'visit') {
        if (!this.userStats.has(userId)) {
            this.userStats.set(userId, {
                username: username,
                firstSeen: new Date(),
                lastSeen: new Date(),
                photosAnalyzed: 0,
                comparisonsMade: 0,
                lastAnalysis: null
            });
            this.globalStats.totalUsers++;
        }

        const user = this.userStats.get(userId);
        user.lastSeen = new Date();

        switch (action) {
            case 'photo':
                user.photosAnalyzed++;
                this.globalStats.totalPhotos++;
                user.lastAnalysis = new Date();
                break;
            case 'comparison':
                user.comparisonsMade++;
                this.globalStats.comparisonsMade++;
                break;
        }

        this.globalStats.totalAnalyses++;
        this.globalStats.lastAnalysis = new Date();
    }

    // ... остальные методы

    getStatistics() {
        const activeUsers = Array.from(this.userStats.values()).filter(user =>
            (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
        ).length;

        const activeSessions = Array.from(this.trailSessions.values()).filter(s =>
            s.status === 'active'
        ).length;

        return {
            activeUsers,
            activeSessions,
            totalUsers: this.globalStats.totalUsers,
            totalPhotos: this.globalStats.totalPhotos,
            totalAnalyses: this.globalStats.totalAnalyses,
            comparisonsMade: this.globalStats.comparisonsMade,
            referencePrintsCount: this.referencePrints.size,
            trailSessionsCount: this.trailSessions.size
        };
    }
}

module.exports = { SessionManager, TrailSession };

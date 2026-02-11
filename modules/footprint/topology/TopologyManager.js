// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ЧИСТОЙ ТОПОЛОГИЕЙ С ДИНАМИЧЕСКИМ ДОВЕРИЕМ
// 🔥 ИСПРАВЛЕНО: НОВЫЕ УЗЛЫ ВИДНЫ В ВИЗУАЛИЗАЦИИ!

const TopologyBuilder = require('./TopologyBuilder');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const TopologicalAccumulator = require('./TopologicalAccumulator');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId || 'default';
        this.name = options.name || `Топология_${this.userId}`;
        this.debug = options.debug || false;
      
        // 🔥 ДИНАМИЧЕСКИЕ ПОРОГИ ДОВЕРИЯ
        this.trustConfig = {
            FORGET_AFTER: options.forgetAfter || 10,     // забыть после 10 неподтверждений
            HIDE_AFTER: options.hideAfter || 5,          // скрыть после 5 неподтверждений
            DEGRADE_AFTER: options.degradeAfter || 3,    // понизить уровень после 3 неподтверждений
            PROMOTE_AT: options.promoteAt || 2,          // повысить уровень при 2 подтверждениях
            CORE_AT: options.coreAt || 4,                // ядро при 4+ подтверждениях
            RESURRECTION_THRESHOLD: options.resurrectionThreshold || 0.9 // порог воскрешения
        };
      
        // Основные компоненты
        this.builder = new TopologyBuilder({ debug: this.debug });
        this.fingerprinter = new TopologicalFingerprint({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            bucketSize: 3,
            similarityThreshold: 0.7
        });
        this.accumulator = new TopologicalAccumulator({
            name: this.name,
            debug: this.debug,
            similarityThreshold: options.similarityThreshold || 0.6,
            minMatchesForEnhancement: options.minMatchesForEnhancement || 3,
            trustConfig: this.trustConfig
        });
      
        // Связь с существующей системой
        this.linkedFootprints = new Map(); // footprintId -> topologicalModelId
      
        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🎯 ФИЛОСОФИЯ: Чистая топология, координаты только для визуализации`);
        console.log(`   🔥 ДОВЕРИЕ: Динамическая система с затуханием шума`);
    }
  
    // 🔥 ГЛАВНЫЙ МЕТОД: Обработка следов (чистая топология)
    async processFootprint(footprint, analysis, photoInfo = {}) {
        console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${photoInfo.photoId || 'без ID'}...`);
      
        // Извлекаем точки ТОЛЬКО из текущего фото
        const points = this.extractPointsFromCurrentPhoto(analysis, photoInfo);
      
        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для топологии');
            return {
                success: false,
                error: 'Недостаточно точек для топологической обработки',
                points: points.length
            };
        }
      
        console.log(`📊 Извлечено ${points.length} точек ИЗ ТЕКУЩЕГО ФОТО`);
      
        // Определяем модель для сравнения
        let modelId = this.linkedFootprints.get(footprint.id);
        if (!modelId && this.accumulator.currentModelId) {
            modelId = this.accumulator.currentModelId;
            this.linkedFootprints.set(footprint.id, modelId);
            console.log(`🔗 Связал след ${footprint.id} с моделью ${modelId}`);
        }
      
        // Обрабатываем точки через топологический аккумулятор (ЧИСТАЯ ТОПОЛОГИЯ)
        const result = await this.accumulator.processPoints(points, {
            modelId: modelId,
            source: `photo_${photoInfo.photoId || Date.now()}`,
            name: photoInfo.name || `Фото_${new Date().toLocaleTimeString('ru-RU')}`,
            footprintId: footprint.id,
            photoInfo: photoInfo,
            photoId: photoInfo.photoId
        });
      
        // Обновляем связь след-модель
        if (result.modelId && result.modelId !== modelId) {
            this.linkedFootprints.set(footprint.id, result.modelId);
            console.log(`🔄 Обновлена связь: след ${footprint.id} → модель ${result.modelId}`);
        }
      
        // Получаем обновленную информацию о модели
        const modelInfo = this.accumulator.getModelInfo(result.modelId);
      
        return {
            success: true,
            topologicalResult: result,
            modelInfo: modelInfo,
            pointsCount: points.length,
            modelId: result.modelId,
            similarity: result.similarity || 0,
            decision: this.getDecisionFromResult(result),
            philosophy: 'pure_topology_coordinates_for_visualization_only',
            trustSystem: 'dynamic_fading_with_resurrection'
        };
    }
  
    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК (сохраняем координаты ТОЛЬКО для визуализации)
    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];
      
        if (!analysis?.predictions) {
            console.log('⚠️ Нет данных анализа для извлечения точек');
            return points;
        }
      
        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        const uniquePhotoId = `${photoId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
        const predictions = analysis.predictions || [];
        let protectorCount = 0;
      
        predictions.forEach((pred, idx) => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);
              
                // 🔥 Сохраняем координаты ТОЛЬКО для визуализации!
                // В топологической логике они не участвуют!
                points.push({
                    id: `${uniquePhotoId}_protector_${protectorCount}`,
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    source: 'current_photo',
                    photoId: photoId,
                    originalPhotoId: uniquePhotoId,
                    originalIndex: protectorCount,
                    originalPoints: pred.points,
                    note: 'coordinates_for_visualization_only'
                });
                protectorCount++;
            }
        });
      
        console.log(`📸 Извлечено ${points.length} точек из ТЕКУЩЕГО ФОТО ${photoId}`);
        console.log(`   Уникальный ID фото: ${uniquePhotoId}`);
      
        return points;
    }
  
    // 🔥 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ МОДЕЛИ (С ДИНАМИЧЕСКИМ ДОВЕРИЕМ)
    // 🔥 ИСПРАВЛЕНО: НОВЫЕ УЗЛЫ ВСЕГДА ВИДНЫ!
    getAccumulativeVisualizationData(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;
      
        if (!targetModelId) {
            console.log('⚠️ Нет активной топологической модели');
            return null;
        }
      
        const model = this.accumulator.models.get(targetModelId);
        if (!model) return null;
      
        const graph = model.graph;
        const fingerprints = model.fingerprints;
      
        console.log(`📊 Визуализация чисто топологической модели ${targetModelId}:`);
        console.log(`   Всего структурных узлов: ${graph.nodes.size}`);
      
        // 🔥 ПОДГОТАВЛИВАЕМ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
        const nodeInfoArray = [];
        let nodesWithConfirmations = 0;
        let hiddenNodes = 0;
        let forgottenNodes = 0;
        let structuralNodes = 0;
      
        for (const [nodeId, node] of graph.nodes) {
            // 🔥 ИСПРАВЛЕНИЕ 1: ГАРАНТИРУЕМ КООРДИНАТЫ ДЛЯ ВСЕХ УЗЛОВ
            if (node.x === undefined || node.y === undefined) {
                if (node.originalData) {
                    node.x = node.originalData.x;
                    node.y = node.originalData.y;
                    if (this.debug) {
                        console.log(`   📍 Использованы оригинальные координаты для узла ${nodeId.substring(0, 20)}...`);
                    }
                } else {
                    // Создаем случайные визуализационные координаты
                    node.x = 400 + (Math.random() - 0.5) * 300;
                    node.y = 300 + (Math.random() - 0.5) * 200;
                    if (this.debug) {
                        console.log(`   🎯 Созданы визуализационные координаты для узла ${nodeId.substring(0, 20)}...`);
                    }
                }
            }
          
            // 🔥 ГАРАНТИРУЕМ confirmationCount
            if (node.confirmationCount === undefined) {
                node.confirmationCount = 1;
            }
          
            // 🔥 ГАРАНТИРУЕМ unconfirmedStreak
            if (node.unconfirmedStreak === undefined) {
                node.unconfirmedStreak = 0;
            }
          
            // 🔥 ПОДСЧИТЫВАЕМ СТРУКТУРНЫЕ УЗЛЫ
            if (node.addedFrom === 'structural_enhancement') {
                structuralNodes++;
            }
          
            // 🔥 ПРОВЕРЯЕМ СТАТУС УЗЛА ПО СИСТЕМЕ ДОВЕРИЯ
            const trustStatus = this.calculateNodeTrustStatus(node);
            node.trustStatus = trustStatus;
          
            // 🔥 ПОДТВЕРЖДЕНИЯ
            const confirmations = node.confirmationCount || 0;
            if (confirmations > 0 && trustStatus.visible) nodesWithConfirmations++;
            if (!trustStatus.visible) hiddenNodes++;
            if (trustStatus.forgotten) forgottenNodes++;
          
            nodeInfoArray.push({
                id: nodeId,
                node: node,
                confirmations: confirmations,
                trustStatus: trustStatus
            });
        }
      
        console.log(`   Узлов с подтверждениями: ${nodesWithConfirmations}/${graph.nodes.size}`);
        console.log(`   Структурных узлов (новых): ${structuralNodes}`);
        console.log(`   Скрытых узлов: ${hiddenNodes}`);
        console.log(`   Забытых узлов: ${forgottenNodes}`);
      
        // 🔥 ГРУППИРОВКА ПО СИСТЕМЕ ДОВЕРИЯ
        const pointsByTrust = {
            core: [],          // 🔴 4+ подтверждений (ядра)
            stable: [],        // 🟠 3 подтверждения (стабильные)
            confirmed: [],     // 🟡 2 подтверждения (подтверждённые)
            newish: [],        // 🔵 1 подтверждение (новые)
            fading: [],        // ⚪ 0 подтверждений (затухающие)
            hidden: [],        // скрытые (не показываем)
            forgotten: []      // забытые (готовы к удалению)
        };
      
        // 🔥 ИСПРАВЛЕНИЕ 2: СОЗДАЁМ VIZDATA ДЛЯ ВСЕХ УЗЛОВ, ДАЖЕ ЕСЛИ ИХ НЕТ
        for (const info of nodeInfoArray) {
            const node = info.node;
            const confirmations = info.confirmations;
            const trustStatus = info.trustStatus;
          
            // 🔥 ЗАБЫТЫЕ УЗЛЫ - НЕ ПОКАЗЫВАЕМ
            if (trustStatus.forgotten) {
                pointsByTrust.forgotten.push(node);
                continue;
            }
          
            // 🔥 СОЗДАЁМ VIZData ЕСЛИ ЕГО НЕТ
            if (!node.vizData) {
                // Определяем цвет и размер на основе подтверждений и статуса
                let color, size, trustLevel;
              
                if (!trustStatus.visible) {
                    color = '#CCCCCC';
                    size = 3;
                    trustLevel = 'hidden';
                } else if (confirmations >= 4 && trustStatus.streak === 0) {
                    color = '#FF0000'; // 🔴 Ядра
                    size = 12 + (node.confidence || 0.5) * 4;
                    trustLevel = 'core';
                } else if (confirmations >= 3 && trustStatus.streak < 2) {
                    color = '#FF6B00'; // 🟠 Стабильные
                    size = 10 + (node.confidence || 0.5) * 3;
                    trustLevel = 'stable';
                } else if (confirmations >= 2 && trustStatus.streak < 3) {
                    color = '#FFC107'; // 🟡 Подтверждённые
                    size = 8 + (node.confidence || 0.5) * 2;
                    trustLevel = 'confirmed';
                } else if (confirmations >= 1 && trustStatus.streak < 4) {
                    color = '#2196F3'; // 🔵 Новые
                    size = 6 + (node.confidence || 0.5);
                    trustLevel = 'newish';
                } else {
                    color = '#BDBDBD'; // ⚪ Затухающие
                    size = 4;
                    trustLevel = 'fading';
                }
              
                node.vizData = {
                    color: color,
                    size: size,
                    trustLevel: trustLevel,
                    confirmations: confirmations,
                    unconfirmedStreak: node.unconfirmedStreak || 0,
                    degree: node.degree || 0,
                    source: node.addedFrom || 'original',
                    visible: trustStatus.visible,
                    id: info.id
                };
              
                if (this.debug && node.addedFrom === 'structural_enhancement') {
                    console.log(`   🎨 Создана vizData для нового узла ${node.id.substring(0, 20)}...`);
                    console.log(`      цвет: ${color}, подтверждений: ${confirmations}, видим: ${trustStatus.visible}`);
                }
            }
          
            // 🔥 ГРУППИРУЕМ ПО СТАТУСУ
            if (!trustStatus.visible) {
                pointsByTrust.hidden.push(node);
            } else if (confirmations >= 4 && trustStatus.streak === 0) {
                pointsByTrust.core.push(node);
            } else if (confirmations >= 3 && trustStatus.streak < 2) {
                pointsByTrust.stable.push(node);
            } else if (confirmations >= 2 && trustStatus.streak < 3) {
                pointsByTrust.confirmed.push(node);
            } else if (confirmations >= 1 && trustStatus.streak < 4) {
                pointsByTrust.newish.push(node);
            } else {
                pointsByTrust.fading.push(node);
            }
        }
      
        // 🔥 ИСПРАВЛЕНИЕ 3: ВСЕГДА ПОКАЗЫВАЕМ СТРУКТУРНЫЕ УЗЛЫ С КООРДИНАТАМИ!
        const visibleNodes = Array.from(graph.nodes.values()).filter(node => {
            // ✅ Узел видим если:
            // 1. Это структурный узел (добавленный при улучшении) И у него есть координаты
            const isStructuralNode = node.addedFrom === 'structural_enhancement';
            const hasCoordinates = node.x !== undefined && node.y !== undefined;
          
            // 2. ИЛИ у него есть vizData И visible !== false
            const hasVizData = node.vizData && node.vizData.visible !== false;
          
            // 3. ИЛИ он не забыт и не скрыт системой доверия
            const notForgotten = !node.trustStatus?.forgotten;
          
            return (isStructuralNode && hasCoordinates) || hasVizData || notForgotten;
        });
      
        // 🔥 ДИАГНОСТИКА ВИЗУАЛИЗАЦИИ
        console.log(`\n🔍 ДИАГНОСТИКА ВИЗУАЛИЗАЦИИ:`);
        console.log(`   Всего узлов в модели: ${graph.nodes.size}`);
        console.log(`   Узлов с координатами: ${Array.from(graph.nodes.values()).filter(n => n.x && n.y).length}`);
        console.log(`   Структурных узлов (новых): ${Array.from(graph.nodes.values()).filter(n => n.addedFrom === 'structural_enhancement').length}`);
        console.log(`   Узлов с vizData: ${Array.from(graph.nodes.values()).filter(n => n.vizData).length}`);
        console.log(`   Отобрано для визуализации: ${visibleNodes.length}`);
      
        // 🔥 СТАТИСТИКА ДЛЯ ВИЗУАЛИЗАЦИИ
        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            core: pointsByTrust.core.length,
            stable: pointsByTrust.stable.length,
            confirmed: pointsByTrust.confirmed.length,
            newish: pointsByTrust.newish.length,
            fading: pointsByTrust.fading.length,
            hidden: pointsByTrust.hidden.length,
            forgotten: pointsByTrust.forgotten.length,
            structuralNodes: structuralNodes,
            uniquenessRatio: fingerprints ?
                this.fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0,
            trustSystem: 'dynamic_with_fading'
        };
      
        console.log(`\n📊 Статистика системы доверия:`);
        console.log(`   Всего узлов: ${stats.totalNodes}`);
        console.log(`   🔴 Ядра (4+): ${stats.core} (непоколебимые)`);
        console.log(`   🟠 Стабильные (3): ${stats.stable} (уверенные)`);
        console.log(`   🟡 Подтверждённые (2): ${stats.confirmed} (рабочие)`);
        console.log(`   🔵 Новые (1): ${stats.newish} (сомнительные)`);
        console.log(`   ⚪ Затухающие: ${stats.fading} (почти исчезли)`);
        console.log(`   🙈 Скрытые: ${stats.hidden} (не показываем)`);
        console.log(`   💀 Забытые: ${stats.forgotten} (готовы к удалению)`);
        console.log(`   🆕 Структурные узлы: ${stats.structuralNodes} (добавленные при улучшении)`);
      
        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: visibleNodes,
            edges: Array.from(graph.edges),
            stats: stats,
            pointsByTrust: pointsByTrust,
            metadata: model.metadata,
            isTopological: true,
            visualizationMethod: 'pure_topological_with_dynamic_trust',
            philosophy: 'coordinates_for_visualization_only_structural_data_is_primary',
            trustSystem: 'dynamic_fading',
            diagnostics: {
                totalNodes: graph.nodes.size,
                visibleNodes: visibleNodes.length,
                structuralNodes: structuralNodes,
                hiddenNodes: hiddenNodes,
                forgottenNodes: forgottenNodes
            }
        };
    }
  
    // 🔥 РАСЧЁТ СТАТУСА ДОВЕРИЯ ДЛЯ УЗЛА
    calculateNodeTrustStatus(node) {
        const confirmations = node.confirmationCount || 0;
        const streak = node.unconfirmedStreak || 0;
      
        // 🔥 ПРАВИЛА СИСТЕМЫ ДОВЕРИЯ
        if (streak >= this.trustConfig.FORGET_AFTER) {
            return {
                visible: false,
                forgotten: true,
                streak: streak,
                status: 'forgotten'
            };
        }
      
        if (streak >= this.trustConfig.HIDE_AFTER) {
            return {
                visible: false,
                forgotten: false,
                streak: streak,
                status: 'hidden'
            };
        }
      
        if (streak >= this.trustConfig.DEGRADE_AFTER) {
            return {
                visible: true,
                degraded: true,
                streak: streak,
                status: 'degraded'
            };
        }
      
        return {
            visible: true,
            forgotten: false,
            streak: streak,
            status: 'normal'
        };
    }
  
    // 🔥 ВОСКРЕШЕНИЕ УЗЛА (если "забытая" точка вдруг появилась)
    checkNodeResurrection(oldNode, newNode) {
        if (!oldNode || !newNode) return false;
      
        const wasForgotten = oldNode.unconfirmedStreak >= this.trustConfig.FORGET_AFTER;
        const highConfidence = newNode.confidence > 0.8;
        const goodStructure = newNode.fingerprint && oldNode.fingerprint &&
                            newNode.fingerprint.signature === oldNode.fingerprint.signature;
      
        if (wasForgotten && (highConfidence || goodStructure)) {
            console.log(`🔥 ВОСКРЕШЕНИЕ узла: ${oldNode.id?.substring(0, 20)}...`);
          
            oldNode.confirmationCount = Math.max(2, (oldNode.confirmationCount || 1) + 1);
            oldNode.unconfirmedStreak = 0;
            oldNode.lastConfirmed = new Date();
            oldNode.resurrectionCount = (oldNode.resurrectionCount || 0) + 1;
            oldNode.markedForDeletion = false;
          
            return true;
        }
      
        return false;
    }
  
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ
    getDecisionFromResult(result) {
        if (!result) return 'unknown';
      
        if (result.status === 'created') {
            return 'new_footprint';
        } else if (result.status === 'enhanced') {
            return 'same_footprint_enhanced';
        } else if (result.similarity >= 0.6) {
            return 'same_footprint';
        } else {
            return 'different_footprint';
        }
    }
  
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ (ЧИСТАЯ СТРУКТУРА): "${footprint1.name}" vs "${footprint2.name}"`);
      
        const points1 = this.extractPointsFromCurrentPhoto(footprint1.analysis || {}, { photoId: 'footprint1' });
        const points2 = this.extractPointsFromCurrentPhoto(footprint2.analysis || {}, { photoId: 'footprint2' });
      
        if (points1.length < 3 || points2.length < 3) {
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Недостаточно точек для структурного сравнения'
            };
        }
      
        const graph1 = this.builder.buildDelaunayGraph(points1, footprint1.name);
        const graph2 = this.builder.buildDelaunayGraph(points2, footprint2.name);
      
        const fingerprints1 = this.fingerprinter.computeGraphFingerprints(graph1);
        const fingerprints2 = this.fingerprinter.computeGraphFingerprints(graph2);
      
        const comparison = this.fingerprinter.compareGraphs(
            graph1, fingerprints1,
            graph2, fingerprints2
        );
      
        const isSame = comparison.similarity >= (options.threshold || 0.6);
        const decision = isSame ? 'same' : 'different';
      
        console.log(`🎯 СТРУКТУРНОЕ РЕШЕНИЕ: ${decision.toUpperCase()} (${(comparison.similarity * 100).toFixed(1)}%)`);
      
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches || [],
            stats: comparison,
            method: 'pure_topological_comparison',
            philosophy: 'coordinates_not_used_in_comparison'
        };
    }
  
    getUserModelsInfo() {
        return this.accumulator.getStats();
    }
  
    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
      
        console.log(`🧹 Очищены все топологические модели пользователя ${this.userId}`);
        return { success: true, message: 'Топологические модели очищены' };
    }
  
    exportUserModels() {
        const models = [];
      
        for (const [modelId, model] of this.accumulator.models) {
            models.push(this.accumulator.exportModel(modelId));
        }
      
        return {
            userId: this.userId,
            models: models,
            linkedFootprints: Array.from(this.linkedFootprints.entries()),
            exportedAt: new Date().toISOString(),
            version: '2.1-dynamic-trust',
            philosophy: 'pure_topological_structure_coordinates_for_visualization_only',
            trustConfig: this.trustConfig
        };
    }
  
    importUserModels(data) {
        if (!data || !data.models || !Array.isArray(data.models)) {
            return { success: false, error: 'Неверный формат данных' };
        }
      
        let importedCount = 0;
      
        for (const modelData of data.models) {
            if (this.accumulator.importModel(modelData)) {
                importedCount++;
            }
        }
      
        if (data.linkedFootprints && Array.isArray(data.linkedFootprints)) {
            data.linkedFootprints.forEach(([footprintId, modelId]) => {
                this.linkedFootprints.set(footprintId, modelId);
            });
        }
      
        if (data.trustConfig) {
            this.trustConfig = { ...this.trustConfig, ...data.trustConfig };
        }
      
        console.log(`📥 Импортировано ${importedCount} моделей с динамическим доверием`);
      
        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size
        };
    }
  
    // 🔥 МЕТОД ДЛЯ ТЕСТИРОВАНИЯ СИСТЕМЫ ДОВЕРИЯ
    testTrustSystem(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;
      
        if (!targetModelId) {
            return { error: 'Нет активной модели' };
        }
      
        const model = this.accumulator.models.get(targetModelId);
        if (!model) return { error: 'Модель не найдена' };
      
        const stats = {
            total: 0,
            byConfirmation: { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 },
            byStreak: { 0: 0, '1-2': 0, '3-4': 0, '5+': 0 },
            trustStatus: {
                core: 0,
                stable: 0,
                confirmed: 0,
                newish: 0,
                fading: 0,
                hidden: 0,
                forgotten: 0
            },
            structuralNodes: 0
        };
      
        for (const node of model.graph.nodes.values()) {
            stats.total++;
          
            if (node.addedFrom === 'structural_enhancement') {
                stats.structuralNodes++;
            }
          
            const conf = node.confirmationCount || 0;
            if (conf >= 4) stats.byConfirmation['4+']++;
            else stats.byConfirmation[conf] = (stats.byConfirmation[conf] || 0) + 1;
          
            const streak = node.unconfirmedStreak || 0;
            if (streak >= 5) stats.byStreak['5+']++;
            else if (streak >= 3) stats.byStreak['3-4']++;
            else if (streak >= 1) stats.byStreak['1-2']++;
            else stats.byStreak[0]++;
          
            const status = this.calculateNodeTrustStatus(node);
            if (status.forgotten) stats.trustStatus.forgotten++;
            else if (!status.visible) stats.trustStatus.hidden++;
            else if (conf >= 4 && streak === 0) stats.trustStatus.core++;
            else if (conf >= 3 && streak < 2) stats.trustStatus.stable++;
            else if (conf >= 2 && streak < 3) stats.trustStatus.confirmed++;
            else if (conf >= 1 && streak < 4) stats.trustStatus.newish++;
            else stats.trustStatus.fading++;
        }
      
        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            stats: stats,
            trustConfig: this.trustConfig,
            timestamp: new Date()
        };
    }
}

module.exports = TopologyManager;

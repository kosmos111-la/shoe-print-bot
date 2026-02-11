// modules/footprint/topology/TrustLevel.js
// 🎯 УРОВНИ ДОВЕРИЯ И ИЕРАРХИЯ ТОЧЕК

const TRUST_LEVELS = {
    BEACON: 3,        // 🔴 Маяк - подтверждён 3+ раз, абсолютная опора
    STABLE: 2,        // 🟠 Стабильный - подтверждён 2 раза, может стать маяком
    CONFIRMED: 1,     // 🟡 Подтверждённый - 1 подтверждение
    NEW: 0,           // 🔵 Новый - только появился
    FADING: -1,       // ⚪ Затухающий - теряет доверие
    GHOST: -2         // 👻 Призрак - скрыт, но не забыт
};

class TrustLevelManager {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🎯 TrustLevelManager создан (иерархия доверия)');
    }

    // 🔥 ОПРЕДЕЛИТЬ УРОВЕНЬ ДОВЕРИЯ
    getTrustLevel(node) {
        const confirmations = node.confirmationCount || 0;
        const streak = node.unconfirmedStreak || 0;
       
        // Маяки - 3+ подтверждений
        if (confirmations >= 3) {
            return {
                level: TRUST_LEVELS.BEACON,
                name: 'BEACON',
                color: '#FF0000',
                size: 12,
                isBeacon: true,
                isAnchor: true,
                confidence: 1.0
            };
        }
       
        // Стабильные - 2 подтверждения
        if (confirmations >= 2) {
            return {
                level: TRUST_LEVELS.STABLE,
                name: 'STABLE',
                color: '#FF6B00',
                size: 10,
                isBeacon: false,
                isAnchor: true,
                confidence: 0.9
            };
        }
       
        // Подтверждённые - 1 подтверждение
        if (confirmations >= 1) {
            return {
                level: TRUST_LEVELS.CONFIRMED,
                name: 'CONFIRMED',
                color: '#FFC107',
                size: 8,
                isBeacon: false,
                isAnchor: false,
                confidence: 0.7
            };
        }
       
        // Затухающие - были, но теряются
        if (streak >= 3) {
            return {
                level: TRUST_LEVELS.FADING,
                name: 'FADING',
                color: '#BDBDBD',
                size: 5,
                isBeacon: false,
                isAnchor: false,
                confidence: 0.3
            };
        }
       
        // Призраки - скрыты
        if (streak >= 5) {
            return {
                level: TRUST_LEVELS.GHOST,
                name: 'GHOST',
                color: '#E0E0E0',
                size: 3,
                isBeacon: false,
                isAnchor: false,
                confidence: 0.1,
                visible: false
            };
        }
       
        // Новые - по умолчанию
        return {
            level: TRUST_LEVELS.NEW,
            name: 'NEW',
            color: '#2196F3',
            size: 6,
            isBeacon: false,
            isAnchor: false,
            confidence: 0.5
        };
    }

    // 🔥 ПОЛУЧИТЬ ТОЛЬКО МАЯКИ (абсолютные опоры)
    getBeacons(graph) {
        const beacons = [];
        for (const [nodeId, node] of graph.nodes) {
            if (node.confirmationCount >= 3) {
                beacons.push({
                    id: nodeId,
                    node: node,
                    confirmations: node.confirmationCount
                });
            }
        }
        return beacons;
    }

    // 🔥 ПОЛУЧИТЬ ВСЕ ЯКОРЯ (маяки + стабильные)
    getAnchors(graph) {
        const anchors = [];
        for (const [nodeId, node] of graph.nodes) {
            if (node.confirmationCount >= 2) {
                anchors.push({
                    id: nodeId,
                    node: node,
                    confirmations: node.confirmationCount
                });
            }
        }
        return anchors;
    }

    // 🔥 ПРОВЕРИТЬ, МОЖЕТ ЛИ ТОЧКА БЫТЬ МАЯКОМ
    canBeBeacon(node) {
        return (node.confirmationCount || 0) >= 3;
    }

    // 🔥 ПРОВЕРИТЬ, МОЖЕТ ЛИ ТОЧКА БЫТЬ ЯКОРЕМ
    canBeAnchor(node) {
        return (node.confirmationCount || 0) >= 2;
    }

    // 🔥 ПОВЫСИТЬ УРОВЕНЬ ПРИ ПОДТВЕРЖДЕНИИ
    promote(node) {
        const oldCount = node.confirmationCount || 0;
        node.confirmationCount = oldCount + 1;
        node.unconfirmedStreak = 0;
       
        const wasBeacon = oldCount >= 3;
        const isBeacon = node.confirmationCount >= 3;
       
        if (!wasBeacon && isBeacon) {
            console.log(`   🎉 НОВЫЙ МАЯК! ${node.id.substring(0, 20)}... (${node.confirmationCount} подтверждений)`);
        }
       
        return this.getTrustLevel(node);
    }

    // 🔥 ПОНИЗИТЬ УРОВЕНЬ ПРИ НЕПОДТВЕРЖДЕНИИ
    demote(node) {
        node.unconfirmedStreak = (node.unconfirmedStreak || 0) + 1;
        return this.getTrustLevel(node);
    }

    // 🔥 УДАЛИТЬ ПРИЗРАКОВ
    cleanupGhosts(graph) {
        const ghosts = [];
        for (const [nodeId, node] of graph.nodes) {
            const level = this.getTrustLevel(node);
            if (level.level === TRUST_LEVELS.GHOST && !this.canBeBeacon(node)) {
                ghosts.push(nodeId);
            }
        }
        return ghosts;
    }
}

module.exports = {
    TrustLevelManager,
    TRUST_LEVELS
};

// Тест логики Hover Focus: соседи по Делоне, соседи по графу, involvement рёбер
// Точки: pt_0..pt_4; Делоне-рёбра: 0-1, 1-2, 1-3, 2-3 (индексы)
const photoPoints = [
    { id: 'pt_0', x: 0, y: 0 },
    { id: 'pt_1', x: 10, y: 0 },
    { id: 'pt_2', x: 10, y: 10 },
    { id: 'pt_3', x: 0, y: 10 },
    { id: 'pt_4', x: 20, y: 5 }
];
const dtEdges = [[0, 1], [1, 2], [1, 3], [2, 3]];

function delaunayNeighbors(id) {
    const idx = photoPoints.findIndex(p => p.id === id);
    const set = new Set();
    if (idx < 0) return set;
    for (const [a, b] of dtEdges) {
        if (a === idx) set.add(photoPoints[b].id);
        else if (b === idx) set.add(photoPoints[a].id);
    }
    return set;
}
function graphNeighbors(edges, id) {
    const set = new Set();
    for (const e of edges) {
        if (e.from === id) set.add(e.to);
        else if (e.to === id) set.add(e.from);
    }
    return set;
}

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

// Делоне-соседи pt_1: 0, 2, 3 (по рёбрам 0-1, 1-2, 1-3)
{
    const nb = delaunayNeighbors('pt_1');
    check('Делоне-соседи pt_1 = {0,2,3}', nb.has('pt_0') && nb.has('pt_2') && nb.has('pt_3') && nb.size === 3);
    check('pt_4 не сосед pt_1', !nb.has('pt_4'));
}
// Делоне-соседи pt_4: нет рёбер — пусто
{
    const nb = delaunayNeighbors('pt_4');
    check('Делоне-соседи pt_4 пусты', nb.size === 0);
}
// Граф-соседи: рёбра a-b, b-c
{
    const nb = graphNeighbors([{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }], 'n2');
    check('Граф-соседи n2 = {n1, n3}', nb.has('n1') && nb.has('n3') && nb.size === 2);
}

// edgeInvolved: hover-режим — ребро подсвечено, если оба конца в {точка + соседи}
function edgeInvolvedHover(fs, a, b) {
    return (fs.neighbors.has(a) || a === fs.pointId) && (fs.neighbors.has(b) || b === fs.pointId);
}
{
    const fs = { pointId: 'pt_1', neighbors: delaunayNeighbors('pt_1') };
    check('ребро 1-2 подсвечено', edgeInvolvedHover(fs, 'pt_1', 'pt_2'));
    check('ребро 1-0 подсвечено', edgeInvolvedHover(fs, 'pt_1', 'pt_0'));
    check('ребро 2-3 подсвечено (оба соседи)', edgeInvolvedHover(fs, 'pt_2', 'pt_3'));
    check('ребро 0-4 НЕ подсвечено', !edgeInvolvedHover(fs, 'pt_0', 'pt_4'));
}
// pair-режим: ребро подсвечено, если инцидентно парной точке
{
    const pairId = 'pt_2';
    const involved = (a, b) => a === pairId || b === pairId;
    check('pair: ребро 2-3 подсвечено', involved('pt_2', 'pt_3'));
    check('pair: ребро 1-3 НЕ подсвечено', !involved('pt_1', 'pt_3'));
}

console.log(fail === 0 ? '\n🎉 Hover Focus логика OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

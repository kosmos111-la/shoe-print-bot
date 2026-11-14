// Тест уникальности коротких меток узлов модели (vis.js: «item with id already exists»)
function shortPointId(id) {
    if (!id) return id;
    const parts = id.split('_');
    if (parts[0] === 'pt' && parts.length >= 4) return `pt_${parts[parts.length - 2]}`;
    return id.slice(-12);
}
function buildModelLabelMap(model) {
    const map = new Map();
    const used = new Set();
    const nodes = model && model.graph && model.graph.nodes;
    if (!nodes) return map;
    const iter = nodes instanceof Map ? nodes.values() : (Array.isArray(nodes) ? nodes : Object.values(nodes || {}));
    for (const n of iter) {
        if (!n || !n.id) continue;
        let lab = shortPointId(n.id);
        if (!lab.startsWith('pt_') && n.originalPhotoId) {
            const src = shortPointId(n.originalPhotoId);
            if (src && src.startsWith('pt_')) lab = src;
        }
        if (used.has(lab)) lab = `${lab}_${String(n.id).slice(-4)}`;
        used.add(lab);
        map.set(n.id, lab);
    }
    return map;
}

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

// Модель: обычный узел pt_31 (фото 2) + НОВЫЙ узел node_... с originalPhotoId pt_31 (фото 3) — коллизия,
// + обычный pt_5 и контурный якорь.
const model = {
    graph: { nodes: new Map([
        ['pt_1794660000000_31_2', { id: 'pt_1794660000000_31_2', x: 1, y: 1 }],
        ['node_1794669535408_0_o5bq', { id: 'node_1794669535408_0_o5bq', x: 2, y: 2, originalPhotoId: 'pt_1794661111111_31_1' }],
        ['pt_1794660000000_5_0', { id: 'pt_1794660000000_5_0', x: 3, y: 3 }],
        ['contour_anchor_71', { id: 'contour_anchor_71', x: 4, y: 4, isContourAnchor: true }]
    ]) }
};

const map = buildModelLabelMap(model);
const labels = Array.from(map.values());
check('все метки уникальны', new Set(labels).size === labels.length);
check('регулярный узел pt_31 → pt_31', map.get('pt_1794660000000_31_2') === 'pt_31');
check('новый узел (originalPhotoId 31) → суффикс pt_31_... (не дубликат)',
    /^pt_31_o5bq$/.test(map.get('node_1794669535408_0_o5bq')));
check('pt_5 → pt_5', map.get('pt_1794660000000_5_0') === 'pt_5');
check('контурный якорь — не pt_ (хвост, уникален)', labels.includes('contour_anchor_71'.slice(-12)));

// без коллизии — новый узел получает чистую метку pt_<индекс>
const map2 = buildModelLabelMap({ graph: { nodes: new Map([
    ['node_1794669535408_0_abcd', { id: 'node_1794669535408_0_abcd', x: 5, y: 5, originalPhotoId: 'pt_1794661111111_7_1' }]
]) } });
check('без коллизии: новый узел → pt_7', map2.get('node_1794669535408_0_abcd') === 'pt_7');

console.log(fail === 0 ? '\n🎉 уникальные метки OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

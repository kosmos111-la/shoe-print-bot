// Тест маппинга контурных классов Roboflow → слои и цвета
const CONTOUR_CLASSES = [
    { key: 'outline-trail',        layer: 'contour', color: '#AA00FF' },
    { key: 'heel',                 layer: 'heel',    color: '#E53935' },
    { key: 'toe',                  layer: 'toe',     color: '#FDD835' },
    { key: 'dragged and dragged',  layer: 'dragged', color: '#29B6F6' },
    { key: 'dragged',              layer: 'dragged', color: '#29B6F6' }
];

function contourLayerOf(cls) {
    const c = String(cls || '').toLowerCase().trim();
    for (const item of CONTOUR_CLASSES) {
        if (item.key === c) return item;
    }
    return null;
}

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

const cases = [
    ['Outline-trail', 'contour', '#AA00FF'],
    ['Heel', 'heel', '#E53935'],
    ['Toe', 'toe', '#FDD835'],
    ['Dragged and dragged', 'dragged', '#29B6F6'],
    ['Dragged', 'dragged', '#29B6F6'],
    ['OUTLINE-TRAIL', 'contour', '#AA00FF'],   // регистр
    ['  toe  ', 'toe', '#FDD835'],              // пробелы
    ['shoe-protector', null, null],
    ['Outline-Trail-extra', null, null]
];
for (const [cls, layer, color] of cases) {
    const r = contourLayerOf(cls);
    check(`class «${cls}» → ${layer || 'нет слоя'}`, (r ? r.layer : null) === layer && (r ? r.color : null) === color);
}

// дубликатов классов в одном слое нет (каждый класс → один слой)
check('классы не пересекают слои', new Set(CONTOUR_CLASSES.map(c => c.layer)).size === CONTOUR_CLASSES.length - 1); // dragged продублирован намеренно (2 ключа → 1 слой)

console.log(fail === 0 ? '\n🎉 маппинг контуров OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

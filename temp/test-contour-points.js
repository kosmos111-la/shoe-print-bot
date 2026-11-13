// Шаг 1 (F3a): контурные классы (Heel/Toe/Dragged) НЕ становятся точками в ядре.
// Тест на реальном extractPointsAndContours без конструктора (Object.create).
const SM = require('../modules/footprint/simple-manager');
const sm = Object.create(SM.prototype);

const analysis = {
    predictions: [
        { class: 'Outline-trail', confidence: 0.95, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
        { class: 'shoe-protector', confidence: 0.9, points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }] },
        { class: 'shoe-protector', confidence: 0.85, points: [{ x: 110, y: 110 }, { x: 120, y: 110 }, { x: 115, y: 120 }] },
        { class: 'Heel', confidence: 0.93, points: [{ x: 40, y: 40 }, { x: 120, y: 40 }, { x: 120, y: 160 }, { x: 40, y: 160 }] },
        { class: 'Toe', confidence: 0.91, points: [{ x: 200, y: 200 }, { x: 280, y: 200 }, { x: 240, y: 280 }] },
        { class: 'Dragged', confidence: 0.8, points: [{ x: 300, y: 50 }, { x: 360, y: 50 }, { x: 330, y: 90 }] }
    ]
};

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

const { points, contours } = sm.extractPointsAndContours(analysis);

check('точки: только 2 протектора (Heel/Toe/Dragged исключены)',
    points.length === 2 && points.every(p => p.class === 'shoe-protector'));
check('нет точек от контурных классов',
    !points.some(p => /heel|toe|dragged/i.test(p.class)));
check('контуры: 6 (outline следа + 2 протектора + 3 контурных полигона)',
    contours.length === 6);
check('контурные полигоны сохранены в contours (для слоёв/визуализации)',
    contours.some(c => c.class === 'Heel') && contours.some(c => c.class === 'Toe') && contours.some(c => c.class === 'Dragged'));
check('Outline-trail: контур следа в contours, но НЕ точка',
    points.every(p => p.class !== 'Outline-trail') && contours.some(c => c.class === 'Outline-trail'));

// Смесь регистра/пробелов: 'dragged and dragged' тоже исключается
const mixed = Object.create(SM.prototype).extractPointsAndContours({
    predictions: [
        { class: 'shoe-protector', confidence: 0.8, points: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 3 }] },
        { class: 'Dragged and dragged', confidence: 0.7, points: [{ x: 5, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 7 }] }
    ]
});
check('"Dragged and dragged" (регистр/пробелы) — тоже не точка', mixed.points.length === 1);

console.log(fail === 0 ? '\n🎉 Шаг 1 (контуры не точки) OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

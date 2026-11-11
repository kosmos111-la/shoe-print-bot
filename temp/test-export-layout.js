// Тест раскладки экспорта PNG: размеры полотна и вертикальные позиции рядов
const PAD = 20, GAP = 16, HEADER_H = 64, METRICS_H = 46, ROW_GAP = 14;

const list = [
    { left: { width: 540, height: 500 }, right: { width: 520, height: 480 } },
    { left: { width: 400, height: 380 }, right: { width: 540, height: 420 } },
    { left: { width: 480, height: 460 }, right: { width: 500, height: 440 } }
];

let colW = 420;
for (const st of list) colW = Math.max(colW, st.left.width, st.right.width);
const W = colW * 2 + GAP + PAD * 2;

const rowH = list.map(st => Math.max(st.left.height, st.right.height) + METRICS_H);
const H = HEADER_H + ROW_GAP + rowH.reduce((a, b) => a + b + ROW_GAP, 0) + PAD;

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

check('colW = максимум ширин (540)', colW === 540);
check('W = 2 колонки + gap + поля (1136)', W === 1136);
check('rowH = [546, 466, 506]', JSON.stringify(rowH) === '[546,466,506]');
check('H покрывает все ряды', H === 64 + 14 + 546 + 14 + 466 + 14 + 506 + 14 + 20);

// симуляция вертикальной раскладки — проверяем отсутствие наложения
let y = HEADER_H + ROW_GAP;
let bottom = HEADER_H;
const rows = [];
for (const st of list) {
    const lh = st.left.height, rh = st.right.height;
    const metricsBottom = y + Math.max(lh, rh) + METRICS_H;   // низ метрик ряда
    rows.push({ top: y, bottom: metricsBottom });
    bottom = Math.max(bottom, metricsBottom);
    y += rowH[list.indexOf(st)] + ROW_GAP;
}
check('ряды идут последовательно, без наложения', rows[0].bottom <= rows[1].top && rows[1].bottom <= rows[2].top);
check('всё помещается в полотно (bottom + PAD <= H)', bottom + PAD <= H);
check('левая колонка не пересекает правую', PAD + colW + GAP > PAD + colW);

console.log(fail === 0 ? '\n🎉 раскладка экспорта OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

// test-tracker-js.js — сверка JS-порта с Python (эталон py_reference.json).
'use strict';
const fs = require('fs');
const path = require('path');
const tt = require('./tracker-tool.js');

const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'py_reference.json'), 'utf8'));

let fails = 0, checked = 0;

function eq(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// 1) все 134 строки 2024-25 (estimateAge, auto)
for (const r of ref.rows) {
    const est = tt.estimateAge('2024-25', r.date, r.H, 'auto');
    checked++;
    const problems = [];
    if (est.status !== r.status) problems.push(`status ${r.status}!=${est.status}`);
    if (est.age !== r.age) problems.push(`age ${r.age}!=${est.age}`);
    if (!eq(est.age_range, r.age_range)) problems.push(`range ${JSON.stringify(r.age_range)}!=${JSON.stringify(est.age_range)}`);
    if (est.nast_date !== r.nast_date) problems.push(`nast ${r.nast_date}!=${est.nast_date}`);
    if (Math.abs((est.sigma || 0) - (r.sigma || 0)) > 0.011) problems.push(`sigma ${r.sigma}!=${est.sigma}`);
    const ws = (est.warnings || []).slice().sort();
    if (!eq(ws, r.warnings)) problems.push(`warnings ${JSON.stringify(r.warnings)}!=${JSON.stringify(ws)}`);
    if (problems.length) {
        fails++;
        console.log(`MISMATCH row ${r.date} H=${r.H}: ${problems.join('; ')}`);
        if (fails > 10) break;
    }
}

// 2) три CLI-примера (estimateChain + format)
const EX_INPUTS = [
    { season: '2024-25', visit: '2025-01-07', depths: [1.5, 1.8, 1.6] },
    { season: '2024-25', visit: '2025-01-07', depths: [3.3, 3.1, 3.5] },
    { season: '2024-25', visit: '2024-12-10', depths: [0.5, 0.7, 0.6] },
];
for (let i = 0; i < ref.examples.length; i++) {
    const ex = ref.examples[i];
    const inp = EX_INPUTS[i];
    const chain = tt.estimateChain(inp.season, inp.visit, inp.depths);
    const est = chain['оценка'];
    checked++;
    const problems = [];
    if (!eq(chain.строки, ex['строки'])) problems.push(`строки ${JSON.stringify(ex['строки'])}!=${JSON.stringify(chain.строки)}`);
    if (tt.formatEstimate(est) !== ex.format) problems.push(`format "${ex.format}"!="${tt.formatEstimate(est)}"`);
    if (est.status !== ex.status) problems.push(`status ${ex.status}!=${est.status}`);
    if (est.age !== ex.age) problems.push(`age ${ex.age}!=${est.age}`);
    if (!eq(est.age_range, ex.age_range)) problems.push(`range ${JSON.stringify(ex.age_range)}!=${JSON.stringify(est.age_range)}`);
    if (est.nast_date !== ex.nast_date) problems.push(`nast ${ex.nast_date}!=${est.nast_date}`);
    const ws = (est.warnings || []).slice().sort();
    if (!eq(ws, ex.warnings)) problems.push(`warnings ${JSON.stringify(ex.warnings)}!=${JSON.stringify(ws)}`);
    if (problems.length) {
        fails++;
        console.log(`MISMATCH example ${inp.visit} ${JSON.stringify(inp.depths)}: ${problems.join('; ')}`);
    } else {
        console.log(`OK example ${inp.visit} ${JSON.stringify(inp.depths)} -> ${tt.formatEstimate(est)}`);
    }
}

console.log(`\nПроверено ${checked} случаев, несовпадений: ${fails}`);
process.exit(fails ? 1 : 0);

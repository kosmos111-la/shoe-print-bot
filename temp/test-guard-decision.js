// Тест: расширенный scale-диапазон guard'а + статус 'enhanced' → same_footprint_enhanced
// Guard теперь проверяет СОГЛАСОВАННОЕ ПОДМНОЖЕСТВО (≥5 пар с ошибкой ≤10px),
// а не медиану по всем якорям.
function guardPasses(guardScale, guardInliers, guardPoints) {
    const guardScaleOk = guardScale > 0.1 && guardScale < 10;
    const guardErrorOk = guardPoints < 5 || guardInliers >= 5;
    return guardScaleOk && guardErrorOk;
}

function getDecisionFromResult(result) {
    if (!result) return 'unknown';
    if (result.status === 'created') return 'new_footprint';
    if (result.status === 'enhanced_full' || result.status === 'enhanced_fast' ||
        result.status === 'enhanced_optimal' || result.status === 'enhanced') {
        return 'same_footprint_enhanced';
    }
    if (result.similarity >= 0.45) return 'same_footprint';
    return 'different_footprint';
}

let fail = 0;
const check = (n, ok) => { console.log((ok ? '  OK  ' : '  FAIL'), n); if (!ok) fail++; };

// --- Guard ---
// Случай из лога: scale 0.157, 18 согласованных из 18 → ПРОПУСК
check('scale 0.157, inliers 18/18 → ПРОПУСК', guardPasses(0.157, 18, 18) === true);
// Границы
check('scale 0.1 → отклонено (нижняя граница)', guardPasses(0.1, 18, 18) === false);
check('scale 10 → отклонено (верхняя граница)', guardPasses(10, 18, 18) === false);
check('scale 0.11 → пропуск', guardPasses(0.11, 18, 18) === true);
check('scale 9.9 → пропуск', guardPasses(9.9, 18, 18) === true);
// Консенсус-гейт: прежний блот-кейс (мусор, мало согласованных) → отклонение
check('блот-кейс (1 inlier из 20, scale 2.3) → отклонено', guardPasses(2.3, 1, 20) === false);
check('грязное фото (6 inliers из 29) → пропуск', guardPasses(0.175, 6, 29) === true);
check('фото 2 (100 inliers из 107) → пропуск', guardPasses(0.963, 100, 107) === true);
check('мало согласованных (4 из 10) → отклонено', guardPasses(1.0, 4, 10) === false);
check('ровно 5 согласованных → пропуск', guardPasses(1.0, 5, 10) === true);
check('мало пар (<5) → пропуск', guardPasses(0.5, 3, 3) === true);

// --- Decision ---
check('status enhanced (успешное слияние) → same_footprint_enhanced',
    getDecisionFromResult({ status: 'enhanced', similarity: 0.432 }) === 'same_footprint_enhanced');
check('status enhanced_fast → same_footprint_enhanced',
    getDecisionFromResult({ status: 'enhanced_fast', similarity: 0.3 }) === 'same_footprint_enhanced');
check('status created → new_footprint', getDecisionFromResult({ status: 'created' }) === 'new_footprint');
check('enhancement_failed + similarity 0.43 → different_footprint',
    getDecisionFromResult({ status: 'enhancement_failed', similarity: 0.43 }) === 'different_footprint');
check('enhancement_failed + similarity 0.50 → same_footprint',
    getDecisionFromResult({ status: 'enhancement_failed', similarity: 0.50 }) === 'same_footprint');
check('нет результата → unknown', getDecisionFromResult(null) === 'unknown');

console.log(fail === 0 ? '\n🎉 guard + decision OK' : `\n💥 FAIL: ${fail}`);
process.exit(fail ? 1 : 0);

// Тест: расширенный scale-диапазон guard'а + статус 'enhanced' → same_footprint_enhanced
function guardPasses(guardScale, guardError, guardPoints) {
    const guardScaleOk = guardScale > 0.1 && guardScale < 10;
    const guardErrorOk = guardPoints < 2 || guardError <= 30;
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
// Случай из лога: scale 0.157, medianError 13.8px → РАНЬШЕ отклонялось, ТЕПЕРЬ проходит
check('scale 0.157 + medianError 13.8 → ПРОПУСК (было отклонение)', guardPasses(0.157, 13.8, 18) === true);
// Границы
check('scale 0.1 → отклонено (нижняя граница)', guardPasses(0.1, 5, 18) === false);
check('scale 10 → отклонено (верхняя граница)', guardPasses(10, 5, 18) === false);
check('scale 0.11 → пропуск', guardPasses(0.11, 5, 18) === true);
check('scale 9.9 → пропуск', guardPasses(9.9, 5, 18) === true);
// Error-гейт остаётся главным: прежний блот-кейс (scale 2.3, medianError 306) всё ещё отклоняется
check('прежний блот-кейс (scale 2.3, medianError 306) → отклонено (error-гейт)',
    guardPasses(2.3, 306, 20) === false);
check('medianError 31 → отклонено', guardPasses(1.0, 31, 20) === false);
check('medianError 30 → пропуск', guardPasses(1.0, 30, 20) === true);
// <2 пар — не проверяем (guardErrorOk true)
check('мало пар → пропуск по error-гейту', guardPasses(0.5, 999, 1) === true);

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

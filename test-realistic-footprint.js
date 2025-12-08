// test-realistic-footprint.js
console.log('👟 СОЗДАЮ РЕАЛИСТИЧНУЮ МОДЕЛЬ ОТПЕЧАТКА ОБУВИ...');

// Параметры отпечатка (размер 42, примерно 27 см)
const FOOT_LENGTH = 270; // мм (27 см)
const FOOT_WIDTH = 100;  // мм (10 см)
const TOE_WIDTH = 110;   // мм (11 см, мысок шире)
const HEEL_WIDTH = 80;   // мм (8 см, пятка уже)

// Создаём точки в форме обуви (вид сверху)
function createShoeShapePoints(count = 40) {
    const points = [];
   
    // 1. Мысок (передняя часть, более широкая)
    const toePoints = Math.floor(count * 0.3);
    for (let i = 0; i < toePoints; i++) {
        const angle = Math.PI * (i / (toePoints - 1)); // 0-180 градусов
        const x = Math.cos(angle) * (TOE_WIDTH / 2);
        const y = Math.sin(angle) * (TOE_WIDTH / 4) - (FOOT_LENGTH * 0.4);
        points.push({ x: x + TOE_WIDTH/2, y, confidence: 0.9 });
    }
   
    // 2. Середина стопы (уже)
    const midPoints = Math.floor(count * 0.3);
    for (let i = 0; i < midPoints; i++) {
        const t = i / (midPoints - 1);
        const x = FOOT_WIDTH / 2 * Math.sin(t * Math.PI); // Синусоида для сужения
        const y = (t - 0.5) * FOOT_LENGTH * 0.4;
        points.push({ x: x + FOOT_WIDTH/2, y, confidence: 0.8 });
    }
   
    // 3. Пятка (задняя часть, самая узкая)
    const heelPoints = Math.floor(count * 0.4);
    for (let i = 0; i < heelPoints; i++) {
        const angle = Math.PI + Math.PI * (i / (heelPoints - 1)); // 180-360 градусов
        const x = Math.cos(angle) * (HEEL_WIDTH / 2);
        const y = Math.sin(angle) * (HEEL_WIDTH / 4) + (FOOT_LENGTH * 0.4);
        points.push({ x: x + HEEL_WIDTH/2, y, confidence: 0.7 });
    }
   
    // 4. Центральная линия (протекторы вдоль стопы)
    const centerPoints = Math.floor(count * 0.2);
    for (let i = 0; i < centerPoints; i++) {
        const t = i / (centerPoints - 1) * 2 - 1; // -1 до 1
        const y = t * (FOOT_LENGTH / 2);
        points.push({ x: FOOT_WIDTH / 2, y, confidence: 0.85 });
    }
   
    // 5. Случайные протекторы внутри формы
    const randomPoints = Math.floor(count * 0.3);
    for (let i = 0; i < randomPoints; i++) {
        // Равномерное распределение внутри овала
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.8; // 0-0.8
       
        // Эллипс: более широкий в мыске, узкий в пятке
        const y = Math.sin(angle) * (FOOT_LENGTH / 2);
        const widthAtY = HEEL_WIDTH + (TOE_WIDTH - HEEL_WIDTH) *
                        ((FOOT_LENGTH/2 - y) / FOOT_LENGTH);
        const x = Math.cos(angle) * (widthAtY / 2) * radius + widthAtY/2;
       
        points.push({
            x,
            y,
            confidence: 0.6 + Math.random() * 0.3
        });
    }
   
    return points;
}

// Создаём тестовые отпечатки
function createTestFootprints() {
    console.log(`\n👣 СОЗДАЮ ТЕСТОВЫЕ ОТПЕЧАТКИ:`);
   
    // 1. Оригинальный след
    const points1 = createShoeShapePoints(50);
    console.log(`✅ Отпечаток 1: ${points1.length} точек`);
   
    // 2. Тот же след, но повёрнут на 90°
    const points2 = points1.map(p => ({
        x: -p.y + 300,  // Поворот + смещение
        y: p.x + 100,
        confidence: p.confidence * (0.8 + Math.random() * 0.2) // Немного другой confidence
    }));
    console.log(`✅ Отпечаток 2 (повёрнут 90°): ${points2.length} точек`);
   
    // 3. Тот же след, но в 1.5 раза больше
    const points3 = points1.map(p => ({
        x: p.x * 1.5 + 200,
        y: p.y * 1.5 + 200,
        confidence: p.confidence
    }));
    console.log(`✅ Отпечаток 3 (увеличен 1.5x): ${points3.length} точек`);
   
    // 4. Другой след (меньше и другой формы)
    const points4 = createShoeShapePoints(30); // Меньше точек
    points4.forEach(p => {
        p.x = p.x * 0.7 + 400; // Меньше по ширине
        p.y = p.y * 0.7 + 300; // Короче
    });
    console.log(`✅ Отпечаток 4 (другой след): ${points4.length} точек`);
   
    return { points1, points2, points3, points4 };
}

// Экспорт для использования в тестах
module.exports = {
    createShoeShapePoints,
    createTestFootprints
};

console.log('✅ Модуль тестовых отпечатков готов!\n');

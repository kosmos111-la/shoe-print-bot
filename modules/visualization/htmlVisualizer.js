// modules/visualization/htmlVisualizer.js

generateHTML(imageUrl, predictions, assembledModel) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Анализ следов обуви</title>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #f0f0f0;
            font-family: Arial, sans-serif;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .image-section {
            position: relative;
            display: inline-block;
        }
        .svg-container {
            width: 100%;
            height: auto;
        }
       
        /* Стили для SVG */
        .photo-layer {
            opacity: 0.7; /* Фото приглушено */
        }
        .white-overlay {
            fill: white;
            opacity: 0.15; /* ⚪ БЕЛЫЙ ФОН 15% - ОДИН ВЕКТОРНЫЙ ПРЯМОУГОЛЬНИК! */
        }
        .outline {
            fill: none;
            stroke: #000000;
            stroke-width: 3;
            opacity: 0.9;
        }
        .tread-detail {
            fill: none;
            stroke: #000000;
            stroke-width: 2;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>🧩 Визуализация анализа следов</h2>
       
        <div class="image-section">
            <svg class="svg-container" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
                <!-- 📸 СЛОЙ 1: Фото как background -->
                <image class="photo-layer" href="${imageUrl}" width="800" height="600"/>
               
                <!-- ⚪ СЛОЙ 2: БЕЛЫЙ ФОН 15% - ОДИН РАСТЯНУТЫЙ ПРЯМОУГОЛЬНИК -->
                <rect class="white-overlay" x="0" y="0" width="800" height="600"/>
               
                <!-- 🖊️ СЛОЙ 3: ЧЕРНЫЕ КОНТУРЫ СЛЕДОВ -->
                ${this.generateSVGContours(predictions)}
               
                <!-- 🔍 СЛОЙ 4: ЧЕРНАЯ ТОПОЛОГИЯ ПРОТЕКТОРА -->
                ${this.generateSVGTopology(predictions)}
            </svg>
        </div>
       
        <div class="info-panel">
            <h3>📊 Результаты анализа</h3>
            <p>Обнаружено объектов: ${predictions.length}</p>
            <p>🕒 ${new Date().toLocaleString('ru-RU')}</p>
        </div>
    </div>
</body>
</html>`;
}

/**
* Генерирует контуры следов
*/
generateSVGContours(predictions) {
    let svg = '';
   
    predictions.forEach(pred => {
        if ((pred.class === 'Outline-trail' || pred.class.includes('Outline')) &&
            pred.points && pred.points.length > 2) {
           
            const points = pred.points.map(p => `${p.x},${p.y}`).join(' ');
            svg += `<polygon points="${points}" class="outline"/>\n`;
        }
    });
   
    return svg;
}

/**
* Генерирует топологию протектора
*/
generateSVGTopology(predictions) {
    let svg = '';
   
    predictions.forEach(pred => {
        if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 2) {
            const points = pred.points.map(p => `${p.x},${p.y}`).join(' ');
            svg += `<polygon points="${points}" class="tread-detail"/>\n`;
        }
    });
   
    return svg;
  }

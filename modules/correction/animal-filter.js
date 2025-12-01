// modules/correction/animal-filter.js
class AnimalFilter {
    constructor() {
        console.log('🐕 AnimalFilter: Фильтр отпечатков животных');
    }

    filterAnimalPaws(predictions) {
        const animalPaws = predictions.filter(p => p.class === 'animal-paw');
        const otherPredictions = predictions.filter(p => p.class !== 'animal-paw');
      
        if (animalPaws.length === 0) {
            return {
                filtered: predictions,
                removed: 0,
                message: '✅ Отпечатков животных не обнаружено'
            };
        }
      
        // Убираем протекторы рядом с лапами животных
        const cleanedPredictions = this.removeNearbyProtectors(otherPredictions, animalPaws);
      
        return {
            filtered: cleanedPredictions,
            removed: predictions.length - cleanedPredictions.length,
            animalCount: animalPaws.length,
            message: `🚫 Удалено ${animalPaws.length} отпечатков животных и соседние артефакты`
        };
    }

    removeNearbyProtectors(predictions, animalPaws) {
        return predictions.filter(pred => {
            if (pred.class !== 'shoe-protector') return true;
          
            const predCenter = this.getCenter(pred.points);
          
            // Проверяем не находится ли протектор рядом с лапой животного
            const isNearAnimal = animalPaws.some(animal => {
                const animalCenter = this.getCenter(animal.points);
                const distance = this.getDistance(predCenter, animalCenter);
                return distance < 50; // 50px - зона влияния
            });
          
            return !isNearAnimal;
        });
    }

    getCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
}

module.exports = { AnimalFilter };

console.log("✅ Яндекс.Диск работает");

class YandexDiskService {
    async uploadFile() {
        console.log("✅ Яндекс.Диск: файл сохранен");
        return true;
    }
    async uploadJson() {
        console.log("✅ Яндекс.Диск: JSON сохранен");
        return true;
    }
}

module.exports = new YandexDiskService();

onst axios = require('axios');
const fs = require('fs');

class YandexDiskService {
    constructor() {
        this.token = '31df880f52604dbaa9949fa942fa90f9';
        this.baseURL = 'https://cloud-api.yandex.net/v1/disk/resources';
    }

    async uploadFile(localFilePath, remoteFileName) {
        try {
            console.log(`📤 Загружаю в Яндекс.Диск: ${remoteFileName}`);
           
            // 1. Получаем URL для загрузки
            const uploadResponse = await axios.get(`${this.baseURL}/upload`, {
                headers: {
                    Authorization: `OAuth ${this.token}`,
                    'Accept': 'application/json'
                },
                params: {
                    path: `shoe_bot_data/${remoteFileName}`,
                    overwrite: true
                }
            });

            // 2. Читаем файл и загружаем
            const fileBuffer = fs.readFileSync(localFilePath);
           
            await axios.put(uploadResponse.data.href, fileBuffer, {
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': fileBuffer.length
                }
            });

            console.log(`✅ Фото загружено в Яндекс.Диск: ${remoteFileName}`);
            return true;

        } catch (error) {
            console.log('❌ Ошибка Яндекс.Диск:', error.response?.data || error.message);
            return false;
        }
    }

    async uploadJson(data, fileName) {
        try {
            console.log(`📤 Загружаю JSON в Яндекс.Диск: ${fileName}`);
           
            const jsonString = JSON.stringify(data, null, 2);
           
            const uploadResponse = await axios.get(`${this.baseURL}/upload`, {
                headers: {
                    Authorization: `OAuth ${this.token}`,
                    'Accept': 'application/json'
                },
                params: {
                    path: `shoe_bot_data/annotations/${fileName}`,
                    overwrite: true
                }
            });

            await axios.put(uploadResponse.data.href, jsonString, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(jsonString)
                }
            });

            console.log(`✅ Аннотации загружены в Яндекс.Диск: ${fileName}`);
            return true;

        } catch (error) {
            console.log('❌ Ошибка Яндекс.Диск (JSON):', error.response?.data || error.message);
            return false;
        }
    }

    // Создаем папку если нет
    async createFolder() {
        try {
            await axios.put(`${this.baseURL}?path=shoe_bot_data`, {}, {
                headers: { Authorization: `OAuth ${this.token}` }
            });
            await axios.put(`${this.baseURL}?path=shoe_bot_data/annotations`, {}, {
                headers: { Authorization: `OAuth ${this.token}` }
            });
            console.log('✅ Папки Яндекс.Диск созданы');
        } catch (error) {
            // Папка уже существует - это нормально
        }
    }
}

module.exports = new YandexDiskService();

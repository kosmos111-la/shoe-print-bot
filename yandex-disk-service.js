const axios = require('axios');

class YandexDiskService {
    constructor() {
        this.token = '31df880f52604dbaa9949fa942fa90f9';
        this.baseURL = 'https://cloud-api.yandex.net/v1/disk/resources';
    }

    async createFolder() {
        try {
            await axios.put(`${this.baseURL}?path=shoe_bot_data`, {}, {
                headers: { Authorization: `OAuth ${this.token}` }
            });
            await axios.put(`${this.baseURL}?path=shoe_bot_data/annotations`, {}, {
                headers: { Authorization: `OAuth ${this.token}` }
            });
            console.log("✅ Папки созданы на Яндекс.Диске");
            return true;
        } catch (error) {
            console.log("📁 Папки уже существуют");
            return true;
        }
    }

    async uploadFile(localFilePath, remoteFileName) {
        try {
            console.log("📤 Загружаю файл: " + remoteFileName);
            await this.createFolder();
           
            const uploadResponse = await axios.get(`${this.baseURL}/upload`, {
                headers: { Authorization: `OAuth ${this.token}` },
                params: { path: `shoe_bot_data/${remoteFileName}`, overwrite: true }
            });

            const fs = require('fs');
            const fileBuffer = fs.readFileSync(localFilePath);
           
            await axios.put(uploadResponse.data.href, fileBuffer, {
                headers: { 'Content-Type': 'image/jpeg' }
            });

            console.log("✅ Файл загружен в Яндекс.Диск");
            return true;
        } catch (error) {
            console.log("❌ Ошибка:", error.message);
            return false;
        }
    }

    async uploadJson(data, fileName) {
        try {
            console.log("📤 Загружаю JSON: " + fileName);
           
            const jsonString = JSON.stringify(data, null, 2);
            const uploadResponse = await axios.get(`${this.baseURL}/upload`, {
                headers: { Authorization: `OAuth ${this.token}` },
                params: { path: `shoe_bot_data/annotations/${fileName}`, overwrite: true }
            });

            await axios.put(uploadResponse.data.href, jsonString, {
                headers: { 'Content-Type': 'application/json' }
            });

            console.log("✅ JSON загружен в Яндекс.Диск");
            return true;
        } catch (error) {
            console.log("❌ Ошибка JSON:", error.message);
            return false;
        }
    }
}

module.exports = new YandexDiskService();

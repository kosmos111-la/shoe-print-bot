// yandex-disk-service.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class YandexDiskService {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.apiBaseUrl = 'https://cloud-api.yandex.net/v1/disk/resources';
        this.uploadHeaders = {
            'Authorization': `OAuth ${this.accessToken}`,
            'Accept': 'application/json',
        };
    }
// 🔍 ДОБАВИТЬ ЭТУ ФУНКЦИЮ - проверка существования файла
    async fileExists(remotePath) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}`, {
                headers: this.uploadHeaders,
                params: {
                    path: remotePath
                }
            });
            return true; // Файл существует
        } catch (error) {
            if (error.response?.status === 404) {
                return false; // Файл не найден
            }
            console.error('❌ Ошибка проверки файла на Яндекс.Диске:', error.response?.data || error.message);
            return false;
        }
    }
    // 1. Проверка существования файла и получение ссылки для загрузки
    async getUploadUrl(remoteFilePath) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/upload`, {
                headers: this.uploadHeaders,
                params: {
                    path: remoteFilePath,
                    overwrite: 'true'
                }
            });
            return response.data.href;
        } catch (error) {
            console.error('❌ Ошибка получения ссылки для загрузки на Яндекс.Диск:', error.response?.data || error.message);
            throw new Error(`Не удалось получить ссылку для загрузки: ${error.response?.data?.message || error.message}`);
        }
    }

    // 2. Прямая загрузка файла по полученной ссылке
    async uploadFile(localFilePath, remoteFileName) {
        try {
            // Проверяем существует ли файл локально
            if (!fs.existsSync(localFilePath)) {
                console.log(`❌ Локальный файл не существует: ${localFilePath}`);
                return false;
            }

            const remoteFilePath = `apps/ShoeBot/${remoteFileName}`;
            const uploadUrl = await this.getUploadUrl(remoteFilePath);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(localFilePath));

            const response = await axios.put(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `OAuth ${this.accessToken}`
                },
                timeout: 30000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.status === 201) {
                console.log(`✅ Файл успешно загружен на Яндекс.Диск: ${remoteFilePath}`);
                return true;
            } else {
                throw new Error(`Неожиданный статус ответа: ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Фатальная ошибка загрузки на Яндекс.Диск:', error.response?.data || error.message);
            return false;
        }
    }

    // 3. Метод для создания папки (можно вызвать один раз при инициализации)
    async createAppFolder() {
        try {
            await axios.put(`${this.apiBaseUrl}?path=apps/ShoeBot`, {}, {
                headers: this.uploadHeaders
            });
            console.log('✅ Папка apps/ShoeBot на Яндекс.Диске создана или уже существует.');
        } catch (error) {
            if (error.response?.status === 409) {
                console.log('ℹ️ Папка apps/ShoeBot уже существует на Яндекс.Диске.');
            } else {
                console.error('❌ Ошибка создания папки на Яндекс.Диске:', error.response?.data || error.message);
            }
        }
    }

    // 4. Проверка доступности сервиса
    async checkConnection() {
        try {
            await axios.get(`${this.apiBaseUrl}`, {
                headers: this.uploadHeaders
            });
            return true;
        } catch (error) {
            console.error('❌ Ошибка подключения к Яндекс.Диск:', error.message);
            return false;
        }
    }
}

module.exports = YandexDiskService;

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
// 📅 Создание папки с датой и временем
    async createDatedFolder(userId = 'unknown') {
        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
           
            const folderName = `user_${userId}_${dateStr}_${timeStr}`;
            const remoteFolderPath = `apps/ShoeBot/analyses/${folderName}`;
           
            await axios.put(`${this.apiBaseUrl}?path=${encodeURIComponent(remoteFolderPath)}`, {}, {
                headers: this.uploadHeaders
            });
           
            console.log(`✅ Папка создана: ${remoteFolderPath}`);
            return remoteFolderPath;
        } catch (error) {
            if (error.response?.status === 409) {
                console.log('ℹ️ Папка уже существует');
                return remoteFolderPath;
            }
            console.error('❌ Ошибка создания папки:', error.response?.data || error.message);
            return null;
        }
    }

    // 💾 Сохранение результатов анализа
    async saveAnalysisResults(userId, files, analysisData = {}) {
        try {
            if (!this.accessToken) {
                console.log('⚠️ Яндекс.Диск не доступен');
                return { success: false, error: 'Модуль отключен' };
            }

            // Создаем папку для анализа
            const folderPath = await this.createDatedFolder(userId);
            if (!folderPath) {
                return { success: false, error: 'Не удалось создать папку' };
            }

            const results = {
                uploadedFiles: [],
                folderPath: folderPath,
                analysisData: analysisData
            };

            // Загружаем файлы
            for (const file of files) {
                if (file.localPath && fs.existsSync(file.localPath)) {
                    const fileName = file.name || path.basename(file.localPath);
                    const remotePath = `${folderPath}/${fileName}`;
                   
                    const uploadSuccess = await this.uploadFileToPath(
                        file.localPath,
                        remotePath
                    );
                   
                    if (uploadSuccess) {
                        results.uploadedFiles.push({
                            name: fileName,
                            remotePath: remotePath,
                            type: file.type || 'unknown'
                        });
                    }
                }
            }

            // Сохраняем метаданные анализа
            if (Object.keys(analysisData).length > 0) {
                const metadataPath = `${folderPath}/analysis_metadata.json`;
                const metadataContent = JSON.stringify({
                    userId: userId,
                    timestamp: new Date().toISOString(),
                    analysis: analysisData
                }, null, 2);
               
                // Создаем временный файл для метаданных
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                const tempMetadataPath = path.join(tempDir, `metadata_${Date.now()}.json`);
                fs.writeFileSync(tempMetadataPath, metadataContent);
               
                await this.uploadFileToPath(tempMetadataPath, metadataPath);
               
                // Удаляем временный файл
                fs.unlinkSync(tempMetadataPath);
            }

            console.log(`✅ Анализ пользователя ${userId} сохранен в Яндекс.Диск`);
            return { success: true, ...results };

        } catch (error) {
            console.error('❌ Ошибка сохранения анализа:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 🔄 Улучшенная загрузка файла с указанием пути
    async uploadFileToPath(localFilePath, remoteFilePath) {
        try {
            const uploadUrl = await this.getUploadUrl(remoteFilePath);
           
            const fileStream = fs.createReadStream(localFilePath);
            const response = await axios.put(uploadUrl, fileStream, {
                headers: {
                    'Authorization': `OAuth ${this.accessToken}`,
                    'Content-Type': 'application/octet-stream'
                },
                timeout: 30000
            });

            return response.status === 201;
        } catch (error) {
            console.error(`❌ Ошибка загрузки файла ${remoteFilePath}:`, error.message);
            return false;
        }
    }

    // 📊 Получение информации о доступном месте
    async getDiskInfo() {
        try {
            const response = await axios.get('https://cloud-api.yandex.net/v1/disk/', {
                headers: this.uploadHeaders
            });
           
            return {
                success: true,
                total: response.data.total_space,
                used: response.data.used_space,
                free: response.data.free_space
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
module.exports = YandexDiskService;

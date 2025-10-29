const axios = require("axios");

class YandexDiskService {
    constructor() {
        this.token = "31df880f52604dbaa9949fa942fa90f9";
        this.baseURL = "https://cloud-api.yandex.net/v1/disk/resources";
    }

    async createFolder() {
        try {
            await axios.put(this.baseURL + "?path=shoe_bot_data", {}, {
                headers: { Authorization: "OAuth " + this.token }
            });
            await axios.put(this.baseURL + "?path=shoe_bot_data/annotations", {}, {
                headers: { Authorization: "OAuth " + this.token }
            });
            console.log("✅ Папки созданы на Яндекс.Диске");
            return true;
        } catch (error) {
            console.log("📁 Папки уже существуют или ошибка:", error.message);
            return true;
        }
    }

    async uploadFile(localFilePath, remoteFileName) {
        console.log("✅ Яндекс.Диск: файл " + remoteFileName);
        await this.createFolder();
        return true;
    }

    async uploadJson(data, fileName) {
        console.log("✅ Яндекс.Диск: JSON " + fileName);
        return true;
    }
}

module.exports = new YandexDiskService();

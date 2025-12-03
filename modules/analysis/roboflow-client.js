const axios = require('axios');

class RoboflowClient {
    constructor(config) {
        this.config = config;
    }
   
    async analyzeImage(imageUrl) {
        try {
            const response = await axios({
                method: "POST",
                url: this.config.API_URL,
                params: {
                    api_key: this.config.API_KEY,
                    image: imageUrl,
                    confidence: this.config.CONFIDENCE,
                    overlap: this.config.OVERLAP,
                    format: 'json'
                },
                timeout: 30000
            });

            return response.data.predictions || [];
        } catch (error) {
            console.log('❌ Ошибка Roboflow API:', error.message);
            throw error;
        }
    }
}

module.exports = RoboflowClient;

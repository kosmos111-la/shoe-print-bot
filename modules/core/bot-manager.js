const TelegramBot = require('node-telegram-bot-api');

class BotManager {
    constructor(token) {
        this.bot = new TelegramBot(token, { polling: false });
        this.webhookUrl = null;
    }
   
    async setupWebhook() {
        const webhookUrl = `https://shoe-print-bot.onrender.com/bot${this.bot.token}`;
        this.webhookUrl = webhookUrl;
       
        await this.bot.setWebHook(webhookUrl);
        console.log('✅ Webhook установлен:', webhookUrl);
    }
   
    getBot() {
        return this.bot;
    }
   
    setupWebhookHandler(app) {
        app.post(`/bot${this.bot.token}`, (req, res) => {
            this.bot.processUpdate(req.body);
            res.sendStatus(200);
        });
    }
}

module.exports = BotManager;

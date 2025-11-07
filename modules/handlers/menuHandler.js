class MenuHandler {
    constructor(bot, sessionManager) {
        this.bot = bot;
        this.sessionManager = sessionManager;
        this.startHandler = new (require('./startHandler'))(this.bot, this.sessionManager);
    }

    async handleMenu(msg) {
        await this.startHandler.showMainMenu(msg.chat.id);
    }
}

module.exports = MenuHandler;

const axios = require('axios');

module.exports = {
    setup(bot, modules) {
        bot.on('photo', async (msg) => {
            try {
                const chatId = msg.chat.id;
               
                // Обновление статистики
                modules.stats.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');
                await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');
               
                // Получение файла
                const photo = msg.photo[msg.photo.length - 1];
                const file = await bot.getFile(photo.file_id);
                const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
               
                await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');
               
                // Анализ через Roboflow
                const predictions = await modules.analysis.roboflow.analyzeImage(fileUrl);
               
                // Постобработка
                const processedPredictions = modules.analysis.postprocessor.smartPostProcessing(predictions);
               
                if (processedPredictions.length > 0) {
                    await this._processSuccessfulAnalysis(bot, chatId, fileUrl, processedPredictions, msg.from, modules);
                } else {
                    await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
                }
               
                // Обновление статистики анализа
                modules.stats.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'analysis');
               
            } catch (error) {
                console.log('❌ Ошибка анализа фото:', error.message);
                await bot.sendMessage(msg.chat.id, '❌ Ошибка при анализе фото. Попробуйте еще раз.');
            }
        });
    },
   
    async _processSuccessfulAnalysis(bot, chatId, fileUrl, predictions, user, modules) {
        await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');
       
        const userData = {
            username: user.username ? `@${user.username}` : user.first_name
        };
       
        // Создание визуализаций
        const vizPath = await modules.visualization.analysis.createVisualization(fileUrl, predictions, userData);
        const topologyPath = await modules.visualization.topology.createVisualization(fileUrl, predictions, userData);
       
        let caption = `✅ Анализ завершен!\n🎯 Выявлено морфологических признаков: ${predictions.length}`;
       
        if (vizPath) {
            await bot.sendPhoto(chatId, vizPath, { caption: caption });
           
            if (topologyPath) {
                await bot.sendPhoto(chatId, topologyPath, {
                    caption: `🕵️‍♂️ Карта топологии деталей протектора\n🔗 Связи между ${predictions.filter(p => p.class === 'shoe-protector').length} деталями`
                });
            }
           
            // Очистка временных файлов
            this._cleanupTempFiles([vizPath, topologyPath]);
        } else {
            await bot.sendMessage(chatId, caption);
        }
       
        // Сохранение в Яндекс.Диск
        if (modules.yandexDisk) {
            await this._saveToYandexDisk(fileUrl, user.id, modules.yandexDisk);
        }
    },
   
    async _saveToYandexDisk(fileUrl, userId, yandexModule) {
        try {
            const timestamp = Date.now();
            const photoId = `user_${userId}_${timestamp}`;
          
            const tempPhotoPath = `temp_${photoId}.jpg`;
            const photoResponse = await axios({
                method: 'GET',
                url: fileUrl,
                responseType: 'stream'
            });
          
            const writer = require('fs').createWriteStream(tempPhotoPath);
            photoResponse.data.pipe(writer);
          
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
          
            await yandexModule.uploadFile(tempPhotoPath, `${photoId}.jpg`);
            require('fs').unlinkSync(tempPhotoPath);
          
            console.log(`✅ Фото загружено на Яндекс.Диск: ${photoId}.jpg`);
          
        } catch (uploadError) {
            console.log('⚠️ Ошибка загрузки на Яндекс.Диск:', uploadError.message);
        }
    },
   
    _cleanupTempFiles(filePaths) {
        filePaths.forEach(path => {
            try {
                if (require('fs').existsSync(path)) {
                    require('fs').unlinkSync(path);
                }
            } catch (error) {
                console.log('⚠️ Ошибка удаления временного файла:', error.message);
            }
        });
    }
};

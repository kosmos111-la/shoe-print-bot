// 📋 БАЗА ДАННЫХ ПРИЛОЖЕНИЙ
const appsDatabase = {
  photography: {
    name: "📸 Фотофиксация и замеры",
    apps: [
      // Сюда добавим приложения, которые вы предоставите
    ]
  },
  measurement: {
    name: "📏 Измерительные инструменты",
    apps: [
      // Сюда добавим приложения, которые вы предоставите
    ]
  },
  analysis: {
    name: "🔍 Анализ и обработка",
    apps: [
      // Сюда добавим приложения, которые вы предоставите
    ]
  },
  utilities: {
    name: "🛠️ Вспомогательные утилиты",
    apps: [
      // Сюда добавим приложения, которые вы предоставите
    ]
  }
};

function getApps(categoryId) {
  return appsDatabase[categoryId] || { name: "Неизвестная категория", apps: [] };
}

function getAllApps() {
  return appsDatabase;
}

function addApp(categoryId, appData) {
  if (appsDatabase[categoryId]) {
    appsDatabase[categoryId].apps.push(appData);
    return true;
  }
  return false;
}

module.exports = {
  categories: [
    { id: 'photography', name: '📸 Фотофиксация' },
    { id: 'measurement', name: '📏 Измерения' },
    { id: 'analysis', name: '🔍 Анализ' },
    { id: 'utilities', name: '🛠️ Утилиты' }
  ],
  getApps,
  getAllApps,
  addApp
};

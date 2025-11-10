// 📋 БАЗА ДАННЫХ ПРИЛОЖЕНИЙ
const appsDatabase = {
  photography: {
    name: "📸 Фотофиксация и замеры",
    apps: [
      {
        name: "PhotoMetrix",
        description: "Измерения по фотографиям с эталоном",
        platform: "iOS/Android",
        link: "https://example.com"
      },
      {
        name: "CamScanner",
        description: "Сканирование документов и следов",
        platform: "iOS/Android",
        link: "https://camscanner.com"
      }
    ]
  },
  measurement: {
    name: "📏 Измерительные инструменты",
    apps: [
      {
        name: "Ruler App",
        description: "Виртуальная линейка для измерений",
        platform: "iOS/Android",
        link: "https://example.com"
      }
    ]
  }
  // ... остальные категории можно оставить пустыми пока
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

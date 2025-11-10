const appsData = require('./apps-data');

/**
* Меню полезных приложений
*/
function initialize() {
  console.log('✅ Модуль приложений загружен');
 
  return {
    getMenu: () => ({
      title: "📱 ПОЛЕЗНЫЕ ПРИЛОЖЕНИЯ",
      categories: appsData.categories
    }),
   
    getAppsByCategory: (categoryId) => {
      return appsData.getApps(categoryId);
    },
   
    getAllApps: () => {
      return appsData.getAllApps();
    }
  };
}

module.exports = { initialize };

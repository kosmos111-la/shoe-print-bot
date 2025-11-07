// utils/backupManager.js
const fs = require('fs');
const path = require('path');

class BackupManager {
    static createBackup(sourceFile, backupType = 'manual') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '../backup');
       
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const fileName = path.basename(sourceFile);
        const backupFile = path.join(backupDir, `${timestamp}_${backupType}_${fileName}`);
       
        try {
            fs.copyFileSync(sourceFile, backupFile);
            console.log(`✅ Бэкап создан: ${backupFile}`);
            return backupFile;
        } catch (error) {
            console.error('❌ Ошибка создания бэкапа:', error);
            return null;
        }
    }

    static listBackups() {
        const backupDir = path.join(__dirname, '../backup');
        if (!fs.existsSync(backupDir)) return [];
       
        return fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.js'))
            .sort()
            .reverse();
    }
}

module.exports = BackupManager;

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class DriveService {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        this.folderId = '1CwaqqQFuqjV3y3aFKgJPrZs9PKDBw23S'; // Замени на ID своей папки
    }

    async uploadFile(filePath, fileName) {
        try {
            const fileMetadata = {
                name: fileName,
                parents: [this.folderId]
            };

            const media = {
                mimeType: 'image/jpeg',
                body: fs.createReadStream(filePath)
            };

            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            return response.data.id;
        } catch (error) {
            console.log('❌ Drive upload error:', error.message);
            return null;
        }
    }

    async uploadJson(data, fileName) {
        try {
            const fileMetadata = {
                name: fileName,
                parents: [this.folderId],
                mimeType: 'application/json'
            };

            const media = {
                mimeType: 'application/json',
                body: JSON.stringify(data)
            };

            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            return response.data.id;
        } catch (error) {
            console.log('❌ Drive JSON upload error:', error.message);
            return null;
        }
    }
}

module.exports = new DriveService();

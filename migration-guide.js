// migration-guide.js
const MIGRATION_MAP = {
    // Методы с трансформациями
    'processPhoto': {
        old: ['coordinateManager.getCoordinates', 'transformationValidator.validate'],
        new: 'coordinateSystem.transform + coordinateSystem.validate',
        priority: 'HIGH'
    },
    'normalizeFootprint': {
        old: ['coordinateManager.normalizePoints', 'coordinateDirector.enforceCanonical'],
        new: 'coordinateSystem.normalize + coordinateSystem.enforceCanonical',
        priority: 'HIGH'
    },
    'compareFootprints': {
        old: ['simpleAligner.align', 'improvedAligner.align'],
        new: 'alignmentSystem.alignPoints',
        priority: 'HIGH'
    },
    'createTemplate': {
        old: ['coordinateSystemConverter.convert', 'geometryUtils.transform'],
        new: 'coordinateSystem.transform + alignmentSystem.alignPoints',
        priority: 'MEDIUM'
    }
};

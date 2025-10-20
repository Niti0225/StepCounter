// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✨ Nichts Spezielles hier – keine createModuleIdFactory, keine extra Transformer.
module.exports = config;

const { getDefaultConfig } = require('@expo/metro-config');
const { withShareExtension } = require('expo-share-extension/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add file extensions
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Explicitly watch share extension and utility files
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, 'ShareExtension.tsx'),
  path.resolve(__dirname, 'utils'),
  path.resolve(__dirname, 'testing'),
];

module.exports = withShareExtension(config, {
  isCSSEnabled: true,
});

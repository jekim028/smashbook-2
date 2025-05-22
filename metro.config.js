const { getDefaultConfig } = require('@expo/metro-config');
const { withShareExtension } = require('expo-share-extension/metro');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = withShareExtension(config, {
  isCSSEnabled: true,
});

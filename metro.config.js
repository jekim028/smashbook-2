const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix watchFolders to use absolute paths
config.watchFolders = [
  path.resolve(__dirname)  // Just watch the project root
];

// Ensure resolver is set up correctly
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules')
  ]
};

module.exports = config;
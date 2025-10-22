import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Smashbook',
  slug: 'smashbook-2',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'smashbook2',
  userInterfaceStyle: 'automatic',
  newArchEnabled: false,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.esi.smashbook2',
    buildNumber: '1',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.esi.smashbook2',
    versionCode: 1,
    edgeToEdgeEnabled: true,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',  // <-- Add this line
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
    [
      'expo-share-extension',
      {
        activationRules: [
          {
            type: 'url',
            max: 1,
          },
          {
            type: 'text',
          },
          {
            type: 'image',
            max: 1,
          },
        ],
        backgroundColor: {
          red: 253,
          green: 252,
          blue: 248,
          alpha: 1.0,
        },
        height: 300,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
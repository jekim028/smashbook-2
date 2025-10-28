import { registerRootComponent } from 'expo';
import 'expo-router/entry';
import { LogBox } from 'react-native';

// Disable all warnings and logs for demo
LogBox.ignoreAllLogs(true);

// Temporarily re-enable console.log for debugging Instagram
// TODO: Disable again after fixing Instagram issue
// console.log = () => {};
// console.warn = () => {};
// console.error = () => {};
// console.info = () => {};
// console.debug = () => {};

// Register main app only
// Share extension is handled natively in Swift (SmashbookShareExtension/)
registerRootComponent(require('expo-router').default);
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The web admin portal lives in ./admin with its own node_modules — keep it out of the mobile bundle.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const adminDir = escapeRegex(path.resolve(__dirname, 'admin')).replace(/\\\\|\//g, '[\\\\/]');
config.resolver.blockList = [new RegExp(`^${adminDir}[\\\\/].*`)];

module.exports = withNativeWind(config, { input: './global.css' });

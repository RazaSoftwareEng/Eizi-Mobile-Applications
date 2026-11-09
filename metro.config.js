const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The web project (./admin: public website + admin portal) has its own node_modules — keep them out of the mobile bundle.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dirPattern = (dir) => escapeRegex(path.resolve(__dirname, dir)).replace(/\\\\|\//g, '[\\\\/]');
config.resolver.blockList = ['admin'].map((dir) => new RegExp(`^${dirPattern(dir)}[\\\\/].*`));

module.exports = withNativeWind(config, { input: './global.css' });

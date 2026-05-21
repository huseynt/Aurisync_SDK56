const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// İndi fayl src-nin içindədir
module.exports = withNativeWind(config, { input: "./src/global.css" });
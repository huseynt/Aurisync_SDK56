module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Əsas dəyişiklik buradadır: 
    // Plugins mütləq massiv (array) olmalıdır və içindəki hər bir plagin 
    // ya sadə sətir (string), ya da konfiqurasiyalı massiv olmalıdır.
    plugins: [
      "react-native-reanimated/plugin"
    ],
  };
};
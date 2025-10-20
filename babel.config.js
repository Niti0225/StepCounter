module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'], // oder 'module:metro-react-native-babel-preset'
    plugins: [
      // ...deine anderen Plugins
      'react-native-reanimated/plugin', // MUSS als letztes stehen
    ],
  };
};

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// PowerSync web SDK needs the react-native-web export condition under Expo Metro.
config.resolver.unstable_conditionsByPlatform.web.push('react-native-web');

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (
      ['react-native-prompt-android', '@powersync/react-native'].includes(
        moduleName,
      )
    ) {
      return { type: 'empty' };
    }

    if (moduleName === 'react-native') {
      return context.resolveRequest(context, 'react-native-web', platform);
    }
  } else if (moduleName === '@powersync/web') {
    return { type: 'empty' };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });

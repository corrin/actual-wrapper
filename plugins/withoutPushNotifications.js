const fs = require('fs');
const path = require('path');
const plist = require('@expo/plist').default;
const { withFinalizedMod } = require('expo/config-plugins');

module.exports = function withoutPushNotifications(config) {
  return withFinalizedMod(config, [
    'ios',
    (config) => {
      removePushEntitlement(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
};

function removePushEntitlement(iosProjectRoot) {
  const entitlementsPaths = fs
    .readdirSync(iosProjectRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = path.join(iosProjectRoot, entry.name);
      return fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((file) => file.isFile() && file.name.endsWith('.entitlements'))
        .map((file) => path.join(directory, file.name));
    });

  if (entitlementsPaths.length === 0) {
    throw new Error('Expected Expo prebuild to generate an iOS entitlements file.');
  }

  for (const entitlementsPath of entitlementsPaths) {
    const entitlements = plist.parse(fs.readFileSync(entitlementsPath, 'utf8'));
    delete entitlements['aps-environment'];
    fs.writeFileSync(entitlementsPath, plist.build(entitlements));
  }
}

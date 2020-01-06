'use strict';

const DefaultSettings = {
    'enabled': true
};

module.exports = function MigrateSettings(fromVer, toVer, settings) {
    if (fromVer === undefined) { // Migrate legacy config file
        return Object.assign(Object.assign({}, DefaultSettings), settings);
    } else if (fromVer === null) { // No config file exists, use default settings
        return DefaultSettings;
    } else { // Migrate from older version (using the new system) to latest one
        if (fromVer + 1 < toVer) { // Recursively upgrade in one-version steps
            settings = MigrateSettings(fromVer, fromVer + 1, settings);
            return MigrateSettings(fromVer + 1, toVer, settings);
        }
        // If we reach this point it's guaranteed that from_ver === to_ver - 1, so we can implement
        // a switch for each version step that upgrades to the next version. This enables us to
        // upgrade from any version to the latest version without additional effort!
        switch (toVer) {
        default: // keep old settings, add new ones
            const oldsettings = settings;
            settings = Object.assign(DefaultSettings, {});

            for (const option in oldsettings) {
                if (settings[option]) {
                    settings[option] = oldsettings[option];
                }
            }

            if (fromVer < toVer) {
                console.log('[GathMark] Your settings have been updated to version ' + toVer +
                            '. You can edit the new config file after the next relog.');
            }
            break;
        }
        return settings;
    }
};

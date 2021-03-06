/* eslint-disable require-jsdoc */
const PLANTS = 0;
const STONES = 1;
const ENERGY = 2;
const ALL = [PLANTS, STONES, ENERGY];
const NICENAME = ['Sickle', 'Pi\u200bckaxe', 'Extractor']; // zero-width space character to prevent censor of "Picka"
const NAME = ['sickle', 'pick', 'extractor'];

module.exports = function AutoToolOnly(mod) {
    mod.game.initialize('inventory');
    const command = mod.command || mod.require.command;
    const config = mod.settings;

    let collections = [];
    let currentLocation;
    let mountFlag = false;
    let active;
    const currentTools = [];

    command.add('autotool', (...args) => {
        if (args[0] && args[0].length > 0) args[0] = args[0].toLowerCase();
        switch (args[0]) {
        case 'info':
            const template = '<font color="#FDD017"><ChatLinkAction param="1#####%id@%dbid@%name">&lt;CLICK ME&gt;</ChatLinkAction></chat>';
            const link = template.replace(/%name/, mod.game.me.name);
            command.message('Your currently configured items:');
            for (const type of ALL) {
                let str = '';
                if (!currentTools[type]) {
                    str += `<font color="#FF0000">not found in inventory</font>`;
                } else {
                    str += link.replace(/%id/, currentTools[type].id).replace(/%dbid/, currentTools[type].dbid);
                }
                command.message(`${NICENAME[type]}: ${str}`);
            }
            break;
        default:
            if (config.enabled === undefined) config.enabled = true;
            config.enabled = !config.enabled;
            command.message(`Module: ${config.enabled ? 'enabled' : 'disabled'}`);
            if (!config.enabled) {
                reset();
            }
            break;
        }
    });

    mod.hook('S_SPAWN_COLLECTION', 4, (event) => {
        if (!config.enabled) return;
        collections[Number(event.gameId)] = event;
    });

    mod.hook('S_DESPAWN_COLLECTION', 2, (event) => {
        if (!config.enabled) return;
        const item = collections[Number(event.gameId)];
        if (!item) return;
        delete collections[event.gameId];
    });

    function updateGatheringTools() {
        // console.log('Update Gathering Tools ' + mod.game.inventory.items);
        for (const type of ALL) {
            const typeItemsTier = mod.game.inventory.items.map((item) => {
                if (Math.floor((item.id - 206600) / 10) == type) {
                    return (item.id - 206600) % 10;
                }
            }).filter((item) => item != undefined);
            const bestTier = Math.max(...typeItemsTier);
            if (bestTier != -Infinity) {
                const bestId = 206600 + type * 10 + bestTier;
                currentTools[type] = mod.game.inventory.findInBagOrPockets(bestId);
            } else {
                currentTools[type] = undefined;
            }
        }
    }

    mod.hook('S_SYSTEM_MESSAGE', 1, (event) => {
        if (!config.enabled) return;
        const data = mod.parseSystemMessage(event.message);
        switch (data.id) {
        case 'SMT_ITEM_USED_ACTIVE':
            active = Math.floor((Number(data.tokens.ItemName.match(/\d+/)) - 206600) / 10);
            break;
        case 'SMT_ITEM_USED_DEACTIVE':
            if (Math.floor((Number(data.tokens.ItemName.match(/\d+/)) - 206600) / 10) == active) active = undefined;
            break;
        }
    });

    mod.hook('C_PLAYER_LOCATION', 5, updateLocation);
    mod.hook('S_SPAWN_ME', 3, updateLocation);
    mod.hook('C_PLAYER_FLYING_LOCATION', 4, updateLocation);

    function updateLocation(event) {
        if (!config.enabled) return;
        currentLocation = {
            loc: event.loc,
            dest: event.dest,
            w: event.w || (currentLocation ? currentLocation.w : 0),
        };
        calcTools();
    }

    function calcTools() {
        if (!currentLocation || Object.keys(collections).length == 0 /* || !inventoryCache */) return;
        if (mod.game.me.onPegasus || mod.game.me.inBattleground || !mod.game.me.alive) return;
        if (mod.game.me.mounted) {
            if (mountFlag) return;
            mountFlag = true;
            mod.game.me.on('dismount', calcTools);
            return;
        }
        if (mountFlag) {
            mountFlag = false;
            mod.game.me.off('dismount', calcTools);
        }

        let nearest = Infinity;
        let nearestGameId;

        // eslint-disable-next-line guard-for-in
        for (const coll in collections) {
            const dist = dist2Dsq(collections[coll].loc, currentLocation.loc);
            if (dist < nearest) {
                nearest = dist;
                nearestGameId = coll;
            }
        }
        if (nearestGameId) {
            const node = collections[nearestGameId];
            const type = Math.floor(node.id / 100);
            const tool = currentTools[type];
            if (!tool || type == active) return;
            active = type;
            console.log(`Activating ${NAME[type]}`);
            useItem(tool.id, tool.dbid);
        }
    }

    function dist2Dsq(loc1, loc2) {
        return Math.pow(loc2.x - loc1.x, 2) + Math.pow(loc2.y - loc1.y, 2);
    }

    function useItem(id, dbid) {
        mod.send('C_USE_ITEM', 3, {
            gameId: mod.game.me.gameId,
            id: id,
            dbid: dbid,
            target: 0,
            amount: 1,
            dest: {x: 0, y: 0, z: 0},
            loc: currentLocation.dest || currentLocation.loc,
            w: currentLocation.w,
            unk1: 0,
            unk2: 0,
            unk3: 0,
            unk4: true,
        });
    }

    mod.game.on('enter_loading_screen', reset );
    mod.game.me.on('change_zone', updateGatheringTools );

    function reset() {
        currentLocation = null;
        mountFlag = false;
        mod.game.me.off('dismount', calcTools );
        active = undefined;
        updateGatheringTools();
    }

    this.saveState = () => {
        const state = {
            enabled: config.enabled,
            collections: collections,
            currentLocation: currentLocation,
            mountFlag: mountFlag,
            active: active,
        };
        return state;
    };

    this.loadState = (state) => {
        config.enabled = state.enabled;
        collections = state.collections;
        currentLocation = state.currentLocation;
        mountFlag = state.mountFlag;
        active = state.active;
        updateGatheringTools();
    };

    this.destructor = () => {
        command.remove('autotool');
    };
};

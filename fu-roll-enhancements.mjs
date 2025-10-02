import {rollEnhancements} from './module/rolls.mjs';
import {registerKeyBindings, registerSettings} from './module/settings.mjs';
import {initializeTemplates} from './module/templates.mjs';
import {registerAutoTargetHooks} from './module/autoTarget.mjs';
import {initializeActiveEffects} from './module/effects.js';
import {getHeaderControlsItemSheetV2} from './module/documents/RollConfiguration.js';

Hooks.once('init', () => {
    registerSettings();
    registerKeyBindings();
    initializeTemplates();
    initializeActiveEffects();
    registerAutoTargetHooks();
});

Hooks.once('ready', () => {
    libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', rollEnhancements);
});

Hooks.on('getHeaderControlsItemSheetV2', getHeaderControlsItemSheetV2);


import {rollEnhancements} from './module/rolls.mjs';
import {registerKeyBindings, registerSettings} from './module/settings.mjs';
import {initializeTemplates} from './module/templates.mjs';
import {initializeActiveEffects} from './module/effects.mjs';
import {registerHooks} from './module/hooks.mjs';

Hooks.once('init', () => {
    registerSettings();
    registerKeyBindings();
    initializeTemplates();
    registerHooks();
});

Hooks.once('ready', () => {
    initializeActiveEffects();
    libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', rollEnhancements);
});




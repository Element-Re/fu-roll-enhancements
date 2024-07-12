import { rollEnhancements } from './module/rolls.mjs';
import { registerKeyBindings, registerSettings } from "./module/settings.mjs";
import { renderItemSheetHandler, initializeTemplates } from "./module/templates.mjs"

Hooks.once('init', () => {
	registerSettings();
	registerKeyBindings();
  initializeTemplates();
});

Hooks.once('ready', () => {
		libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', rollEnhancements);
});

Hooks.on('renderFUItemSheet', renderItemSheetHandler);


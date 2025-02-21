import { rollEnhancements } from './module/rolls.mjs';
import { registerKeyBindings, registerSettings } from './module/settings.mjs';
import { renderItemSheetHandler, initializeTemplates } from './module/templates.mjs';
import { registerAutoTargetHooks } from './module/autoTarget.mjs';

Hooks.once('init', () => {
	registerSettings();
	registerKeyBindings();
  initializeTemplates();	
	registerAutoTargetHooks();
});

Hooks.once('ready', () => {
		libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', rollEnhancements);
});

Hooks.on('renderFUItemSheet', renderItemSheetHandler);


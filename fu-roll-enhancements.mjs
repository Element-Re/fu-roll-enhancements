import { prepareCheckHandler, processCheckHandler, renderCheckHandler } from './module/rolls.mjs';
import { registerKeyBindings, registerSettings } from "./module/settings.mjs";
import { renderItemSheetHandler, initializeTemplates } from "./module/templates.mjs";


Hooks.once('init', () => {
	registerHooks();
	registerSettings();
	registerKeyBindings();
  initializeTemplates();
});

function registerHooks() {
	// Checks
	Hooks.on('projectfu.prepareCheck', prepareCheckHandler); 
	Hooks.on('projectfu.processCheck', processCheckHandler);
	Hooks.on('projectfu.renderCheck', renderCheckHandler);

	// Sheet extensions
	Hooks.on('renderFUItemSheet', renderItemSheetHandler);
}

// Hooks.once('ready', () => {
// 		libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', rollEnhancements);
// });


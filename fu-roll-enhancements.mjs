import { module, registerSettings } from "./module/settings.js";

Hooks.once('init', () => {
	registerSettings();
});

Hooks.once('ready', () => {
	// Add on-roll support for item macro
	libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', async function (wrapped, ...args) {
		const item = this;
		if (game.settings.get(module, "preRollItemMacro") && item.hasMacro && item.hasMacro())
			await item.executeMacro("pre");
		const returnValue = await wrapped(...args);
		if (game.settings.get(module, "postRollItemMacro") && item.hasMacro && item.hasMacro())
			await item.executeMacro("post");
		return returnValue;
	});
		
});
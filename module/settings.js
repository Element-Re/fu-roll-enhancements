export const module = "fu-roll-enhancements";

export const registerSettings = () => {
	game.settings.register(module, "preRollItemMacro", {
		name: `${module}.settings.preRollItemMacro.name`,
		hint: `${module}.settings.preRollItemMacro.hint`,
		scope: "world",
		config: true,
		requiresReload: false,
		type: Boolean,
		default: false
	});
	
	game.settings.register(module, "postRollItemMacro", {
		name: `${module}.settings.postRollItemMacro.name`,
		hint: `${module}.settings.postRollItemMacro.hint`,
		scope: "world",
		config: true,
		requiresReload: false,
		type: Boolean,
		default: false
	});
}
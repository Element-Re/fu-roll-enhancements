export const module = "fu-roll-enhancements";

export const keyBinds = { autoTargetDialog: false };

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

export const registerKeyBindings = () => {
	game.keybindings.register(module, "autoTargetDialog", {
		name: game.i18n.localize(`${module}.autoTarget.dialog.name`),
		hint: game.i18n.localize(`${module}.autoTarget.dialog.hint`),
		editable: [
			{
				key: "AltLeft"
			},
			{
				key: "AltRight"
			}
		],
		onDown: () => {
			keyBinds.autoTargetDialog = true;
		},
		onUp: () => {
			keyBinds.autoTargetDialog = false;
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});
};
export const MODULE = "fu-roll-enhancements";

export const keyBinds = { 
	autoTargetDialog: false, 
	autoSpendDialog: false 
};

export const registerSettings = () => {

	game.settings.register(MODULE, "enableAutoSpend", {
		name: `${MODULE}.settings.enableAutoSpend.name`,
		hint: `${MODULE}.settings.enableAutoSpend.hint`,
		scope: "client",
		config: true,
		requiresReload: false,
		type: Boolean,
		default: true
	});

	game.settings.register(MODULE, "allowPlayerAutoTarget", {
		name: `${MODULE}.settings.allowPlayerAutoTarget.name`,
		hint: `${MODULE}.settings.allowPlayerAutoTarget.hint`,
		scope: "world",
		config: true,
		requiresReload: true,
		type: Boolean,
		default: false
	});

	game.settings.register(MODULE, "preRollItemMacro", {
		name: `${MODULE}.settings.preRollItemMacro.name`,
		hint: `${MODULE}.settings.preRollItemMacro.hint`,
		scope: "world",
		config: true,
		requiresReload: false,
		type: Boolean,
		default: false
	});
	
	game.settings.register(MODULE, "postRollItemMacro", {
		name: `${MODULE}.settings.postRollItemMacro.name`,
		hint: `${MODULE}.settings.postRollItemMacro.hint`,
		scope: "world",
		config: true,
		requiresReload: false,
		type: Boolean,
		default: false
	});
}

export const registerKeyBindings = () => {
	game.keybindings.register(MODULE, "autoTargetDialog", {
		name: game.i18n.localize(`${MODULE}.autoTarget.dialog.name`),
		hint: game.i18n.localize(`${MODULE}.autoTarget.dialog.hint`),
		editable: [
			{
				key: "AltLeft"
			},
			{
				key: "AltRight"
			},
			{
				key: "ControlLeft"
			},
			{
				key: "ControlRight"
			}
		],
		onDown: () => {
			keyBinds.autoTargetDialog = true;
		},
		onUp: () => {
			keyBinds.autoTargetDialog = false;
		},
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});

	game.keybindings.register(MODULE, "autoSpendDialog", {
		name: game.i18n.localize(`${MODULE}.autoSpend.dialog.name`),
		hint: game.i18n.localize(`${MODULE}.autoSpend.dialog.hint`),
		editable: [
			{
				key: "ControlLeft"
			},
			{
				key: "ControlRight"
			}
		],
		onDown: () => {
			keyBinds.autoSpendDialog = true;
		},
		onUp: () => {
			keyBinds.autoSpendDialog = false;
		},
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});
};
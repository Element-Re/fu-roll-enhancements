export const MODULE = 'fu-roll-enhancements';

export const keyBinds = { 
	autoTargetDialog: false, 
	autoSpendDialog: false 
};

export const registerSettings = () => {

	game.settings.register(MODULE, 'enableAutoSpend', {
		name: `${MODULE}.settings.enableAutoSpend.name`,
		hint: `${MODULE}.settings.enableAutoSpend.hint`,
		scope: 'client',
		config: true,
		requiresReload: false,
		type: Boolean,
		default: true
	});

	game.settings.register(MODULE, 'enableAutoTarget', {
		name: `${MODULE}.settings.enableAutoTarget.name`,
		hint: `${MODULE}.settings.enableAutoTarget.hint`,
		scope: 'client',
		config: true,
		requiresReload: false,
		type: Boolean,
		default: true
	});

	game.settings.register(MODULE, 'allowPlayerAutoTarget', {
		name: `${MODULE}.settings.allowPlayerAutoTarget.name`,
		hint: `${MODULE}.settings.allowPlayerAutoTarget.hint`,
		scope: 'world',
		config: true,
		requiresReload: true,
		type: Boolean,
		default: false
	});

	game.settings.register(MODULE, 'defaultAutoTargetBehavior', {
		name: `${MODULE}.settings.defaultAutoTargetBehavior.name`,
		hint: `${MODULE}.settings.defaultAutoTargetBehavior.hint`,
		scope: 'client',
		config: true,
		requiresReload: false,
		type: String,
		default: 'all',
		choices: {
			'none': `${MODULE}.settings.defaultAutoTargetBehavior.options.none`,
			'attacksAndSpells': `${MODULE}.settings.defaultAutoTargetBehavior.options.attacksAndSpells`,
			'all': `${MODULE}.settings.defaultAutoTargetBehavior.options.all`
		}
	});

	game.settings.register(MODULE, 'preRollItemMacro', {
		name: `${MODULE}.settings.preRollItemMacro.name`,
		hint: `${MODULE}.settings.preRollItemMacro.hint`,
		scope: 'world',
		config: true,
		requiresReload: false,
		type: Boolean,
		default: false
	});
	
	game.settings.register(MODULE, 'postRollItemMacro', {
		name: `${MODULE}.settings.postRollItemMacro.name`,
		hint: `${MODULE}.settings.postRollItemMacro.hint`,
		scope: 'world',
		config: true,
		requiresReload: false,
		type: Boolean,
		default: false
	});
};

export const registerKeyBindings = () => {
	game.keybindings.register(MODULE, 'autoTargetDialog', {
		name: `${MODULE}.keybinds.autoTarget.dialog.name`,
		hint: `${MODULE}.keybinds.autoTarget.dialog.hint`,
		editable: [
			{
				key: 'KeyT'
			},
		],
		onDown: () => {
			keyBinds.autoTargetDialog = true;
		},
		onUp: () => {
			keyBinds.autoTargetDialog = false;
		},
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});

	game.keybindings.register(MODULE, 'autoSpendDialog', {
		name: `${MODULE}.keybinds.autoSpend.dialog.name`,
		hint: `${MODULE}.keybinds.autoSpend.dialog.hint`,
		editable: [
			{
				key: 'KeyR'
			},
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
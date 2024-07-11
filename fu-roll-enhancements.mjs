import { keyBinds, module, registerKeyBindings, registerSettings } from "./module/settings.js";

Hooks.once('init', () => {
	registerSettings();
	registerKeyBindings();
	loadTemplates([
		"modules/fu-roll-enhancements/templates/auto-target-dialog.hbs",
		"modules/fu-roll-enhancements/templates/auto-target-item-extension.hbs",
	]);
});

Hooks.once('ready', () => {
		enableRollEnhancements();
});

Hooks.on('renderFUItemSheet', async (item, $content, data) => {
	if (!game.user.isGM) return;
	const templateData = {
		item: item.object,
		targetSides: TARGET_SIDES,
	};
	const itemExtensionContent = await renderTemplate("modules/fu-roll-enhancements/templates/auto-target-item-extension.hbs", templateData);
	const attributesTab = $content.find(".tab.attributes[data-tab=attributes]").first();
	if(!attributesTab.length) return;
	if (attributesTab.find("section.grid").length) {
		attributesTab.find("section.grid").last().append(itemExtensionContent);
	} else
		attributesTab.append($(`<section class="grid grid-2col gap-5"></section>`).append(itemExtensionContent));
	
})

const enableRollEnhancements = () => {
  // Add on-roll support for item macro
	libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', async function (wrapped, ...args) {
		const item = this;
		await autoTargetWorkflow(item);
		console.log("fu-roll-enhancements | done setting targets");
		if (game.settings.get(module, "preRollItemMacro") && item.hasMacro && item.hasMacro())
			await item.executeMacro("pre");
		const returnValue = await wrapped(...args);
		if (game.settings.get(module, "postRollItemMacro") && item.hasMacro && item.hasMacro())
			await item.executeMacro("post");
		return returnValue;
	});
}

const autoTarget = (options, item) => {
	if (!options || !item) return;
	const targetList = new Map();
	if (options.targetSide === "SELF") {
		item.actor.getActiveTokens().forEach(t => targetList.set(t, {count: 1}));
	} else {
		let targetCandidates = [];
		const rollerTokenOrProtoType = item.actor.token ? item.actor.token : item.actor.prototypeToken;
		// Treat neutral and secret rolls as friendly for the sake of targetting.
		const rollerDisposition = [CONST.TOKEN_DISPOSITIONS.NEUTRAL, CONST.TOKEN_DISPOSITIONS.SECRET].includes(rollerTokenOrProtoType.disposition) ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : rollerTokenOrProtoType.disposition;
		let filter;
		if (options.targetSide === "ALLIES") {
			filter = t => t.document.disposition === rollerDisposition && t.actor.id !== item.actor.id && t.id !== rollerTokenOrProtoType.id;
		} else if (options.targetSide === "ALLIES_AND_SELF") {
			filter = t => t.document.disposition === rollerDisposition;
		}	else if (options.targetSide === "ENEMIES") {
			filter = t => {
				const effects = [...t.actor.effects];
				return !t.document.hidden &&
				t.document.disposition === -rollerDisposition && 
					!effects.some(e => {
						const statuses = [...e.statuses];
						return statuses.some(s => UNTARGETABLE_ALL_EFFECTS.includes(s) || (options.asMelee && UNTARGETABLE_MELEE_EFFECTS.includes(s)))
					});
			}
		} else {
			filter = t => Math.abs(t.document.disposition) === Math.abs(rollerDisposition);
		}

		targetCandidates.push(...game.canvas.tokens.placeables.filter(filter));

		if (typeof options.maxTargets === "number" && options.maxTargets > 0) {

			const forcedTargetsSet = new Set();

			[...item.actor.effects].forEach(e => {
				const effectStatuses = [...e.statuses];
				if (e.origin && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {
					const origin = fromUuidSync(e.origin);
					const forcedTarget = targetCandidates.find(t => t.document.actor.uuid === (origin.actor || origin)?.uuid );
					if (forcedTarget) {
						forcedTargetsSet.add(forcedTarget);
					} else {
						ui.notifications.warn(game.i18n.localize(`${module}.autoTarget.errors.forcedTargetFailed`));
						return false;
					}
				}
			});

			const forcedTargets = [...forcedTargetsSet];

			let i = 0;
			while (i < options.maxTargets && (forcedTargets.length > 0 || targetCandidates.length > 0)) {
				const forced = forcedTargets.length > 0
				let drawPile = forced ? forcedTargets : targetCandidates;
				var start = Math.floor(Math.random() * (drawPile.length));
				const target = options.repeat && drawPile === targetCandidates ? drawPile[start] : drawPile.splice(start, 1)[0]; // TODO: Wonky Repeat Targetting?
				targetList.set(target, (targetList.has(target) ? foundry.utils.mergeObject(targetList.get(target), {count: targetList.get(target).count + 1}) : {count: 1, wasForced: forced})) // TODO: Is there nothing wrong with only setting wasForced upon first insertion?
				i++;
			}
		} else targetCandidates.forEach(t => targetList.set(t, {count: 1}));
	}
	
	game.user.updateTokenTargets([...targetList.keys()].map(t => t.id));
	
	const results = targetList.size ? `<ol>${ [...targetList.keys()].map(t => `<li class="target">${t.document.actor.link}${targetList.get(t).count > 1 ? ` x${targetList.get(t).count}` : '' }${targetList.get(t).wasForced ? ` (Forced)`: ''}</li>`).join('\n') }</ol>` : "<ul><li>No valid targets.</li><ul>";

	ChatMessage.create({
		content: `<div class="projectfu auto-target"><fieldset class="title-fieldset"><legend class="resource-text-sm">Auto Target</legend>${results}</fieldset></div>`,
		speaker: {
			actor: item.actor,
			token: item.actor.token
		},
		flavor: item.name
	});
}

const autoTargetWorkflow = async (item) => {

	// Only for GMs controlling NPCs, for items not marked as specifically not auto-targetable
	if (!game.user.isGM || !item.actor || item.actor.type !== "npc") return;

	// If keybind is pressed, show dialog
	if (keyBinds.autoTargetDialog) {
		const options = item.getFlag(module, "autoTarget") || { maxTargets: 1, targetSide: "ENEMIES", repeat: false };
		const templateData = {
			item: item,
			// Use item autoTarget flag or sensible defaults
			options: options,
			targetSides: TARGET_SIDES,
		}
		const targetDialogContent = await renderTemplate("modules/fu-roll-enhancements/templates/auto-target-dialog.hbs", templateData);
		return Dialog.wait({
			title: game.i18n.localize(`${module}.autoTarget.title`),
			content: targetDialogContent,
			default: "cancel",
			buttons: {
				autoTarget: {
					icon: '<i class="fas fa-crosshairs"></i>',
					label: game.i18n.localize(`${module}.autoTarget.title`),
					callback: (html) => {
							const formElement = html[0].querySelector('form');
							const formData = new FormDataExtended(formElement);
							const formDataObject = formData.toObject();
							autoTarget(formDataObject, item);
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${module}.autoTarget.skip`),
					callback: () => console.log(`${module} | skipping autotarget`)
				},
			},
			close: () => {
				console.log("fu-roll-enhancements | closing dialog");
			}
		}); // If auto target is enabled on the item's settings.
	} else if (item.getFlag(module, "autoTarget")?.enable) {
		const options = item.getFlag(module, "autoTarget");
		autoTarget(options, item);
		return;
	}
}

const TARGET_SIDES = Object.freeze ({
	ENEMIES: `${module}.autoTarget.targetSide.sides.enemies`,
	ALLIES: `${module}.autoTarget.targetSide.sides.allies`,
	SELF: `${module}.autoTarget.targetType.sides.self`,
	ALLIES_AND_SELF: `${module}.autoTarget.targetSide.sides.alliesAndSelf`,
	ALL: `${module}.autoTarget.targetSide.sides.all`
});

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];
import { keyBinds, MODULE } from './settings.mjs';
import { TEMPLATES } from './templates.mjs';

export async function rollEnhancements (wrapped, ...args) {
	const item = this;
	const showDialogs = keyBinds.autoTargetDialog; // TODO: Seperate keybinds?

	// Auto Target
	await autoTargetWorkflow(item, showDialogs);
	console.log("fu-roll-enhancements | done setting targets");
	// Item macro "pre" event
	if (game.settings.get(MODULE, "preRollItemMacro") && item.hasMacro && item.hasMacro())
		await item.executeMacro("pre");
	// Auto Spend
	await autoSpendWorkflow(item, game.user.targets.size, showDialogs);
	console.log("fu-roll-enhancements | done spending costs");
	// Chain wrapped function(s)
	const returnValue = await wrapped(...args);
	// Item macro "post" event
	if (game.settings.get(MODULE, "postRollItemMacro") && item.hasMacro && item.hasMacro())
		await item.executeMacro("post");
	return returnValue;
}


function getCost(item, targetCount, overrideCost = item.getFlag(MODULE, 'autoSpend.cost')) {
	if (overrideCost?.value || !item.system.mpCost) return overrideCost;
	const spellCostMatch = item.system.mpCost.value?.match(/^(\d+)(\s\w+\s)?(t)?/i);
	const spellCost = spellCostMatch[1];
	return spellCost ? {
		value: new Number(spellCost) * (spellCostMatch[3] ? targetCount : 1),
		resourceType: "MP"
	} : null;
}

async function autoSpendWorkflow(item, targetCount, showDialog) {
	if (!item.actor || !game.settings.get(MODULE, "enableAutoSpend")) return;
	const templateData = {
			item: item,
			options: item.getFlag(MODULE, "autoSpend"),
			resourceTypes: RESOURCE_TYPES
		};
	const spendDialogContent = await renderTemplate(TEMPLATES.AUTO_SPEND_DIALOG, templateData);
	
	const cost = getCost(item, targetCount);
	if (cost || showDialog) {
		return Dialog.wait({
			title: game.i18n.localize(`${MODULE}.autoSpend.dialog.title`),
			content: spendDialogContent,
			buttons: {
				spend: {
					icon: '<i class="fas fa-coins"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.spend`),
					callback: async (html) => {
						const cost = getCost(item, targetCount, getFormOptions(html));
						await autoSpend(item, cost);
					}
				},
				updateAndSpend: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.updateAndSpend`),
					callback: async (html) => {
						const cost = getCost(item, targetCount, getFormOptions(html))
						await autoSpend(item, cost);
						const updateData = foundry.utils.flattenObject({[`flags.${MODULE}.autoSpend`]: cost});
	
						item.update(updateData);
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.skip`),
				},
				disable: {
					icon: '<i class="fas fa-ban"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.disable`),
					callback:() => item.setFlag(MODULE, "autoSpend.enable", false)
				},
			},
			close: () => {
				console.log("fu-roll-enhancements | closing auto-spend dialog");
			}
		}, {id: "auto-spend-dialog"}); 
	}

}

async function autoSpend(item, cost) {
	if (!item.actor || !cost.value) return;
	const resourceType = RESOURCE_TYPES[cost.resourceType];
	const currentValue = foundry.utils.getProperty(item.actor, resourceType.model);
	const newValue = Math.max(currentValue - cost.value, 0);
	const resultsData = {
		actor: item.actor.name,
		amount: cost.value,
		resource: game.i18n.localize(resourceType.label),
		from: item.name,
	}
	if (newValue + cost.value !== currentValue) {
		const errorMessage = game.i18n.format(`${MODULE}.autoSpend.errors.notEnoughResources`, resultsData);
		ui.notifications.warn(errorMessage);
		throw errorMessage;
	}
	const updates = {[resourceType.model]: newValue};
	item.actor.update(updates);
	ChatMessage.create({
		speaker: ChatMessage.getSpeaker( item.actor ),
		flavor: game.i18n.format(`${MODULE}.autoSpend.results.flavor`, {item: item.name}),
		content: await renderTemplate(TEMPLATES.SIMPLE_CHAT_MESSAGE, {
			message: game.i18n.format(`${MODULE}.autoSpend.results.chatMessage`, resultsData)
		}),
	});
}

async function autoTargetWorkflow(item, showDialog) {
	if (!item.actor || (!game.user.isGM && !game.settings.get(MODULE, "allowPlayerAutoTarget"))) return;

	// If keybind is pressed, show dialog
	if (showDialog) {
		const templateData = {
			item: item,
			options: item.getFlag(MODULE, "autoTarget"),
			targetTypes: TARGET_TYPES,
		};
		const targetDialogContent = await renderTemplate(TEMPLATES.AUTO_TARGET_DIALOG, templateData);
		return Dialog.wait({
			title: game.i18n.localize(`${MODULE}.autoTarget.dialog.title`),
			content: targetDialogContent,
			buttons: {
				target: {
					icon: '<i class="fas fa-crosshairs"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.target`),
					callback: async (html) => {
						const options = getFormOptions(html);
						await autoTarget(options, item);
					}
				},
				updateAndTarget: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.updateAndTarget`),
					callback: async (html) => {
						const options = getFormOptions(html)
						await autoTarget(options, item);
						const updateData = foundry.utils.flattenObject({[`flags.${MODULE}.autoTarget`]: foundry.utils.mergeObject(options, {enable: true})});
						item.update(updateData);
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.skip`),
				},
				disable: {
					icon: '<i class="fas fa-ban"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.disable`),
					callback: () => item.setFlag(MODULE, "autoTarget.enable", false)
				},
			},
			close: () => {
				console.log("fu-roll-enhancements | closing auto-target dialog");
			}
		}, {id: "auto-target-dialog"}); 
	} else if (item.getFlag(MODULE, "autoTarget")?.enable) {
		const options = item.getFlag(MODULE, "autoTarget");
		await autoTarget(options, item);
	}

}

function actorHasStatus(actor, ...statuses) {
	return [...actor.effects].some(e => !e.disabled && [...e.statuses].some(s => statuses.includes(s)));
}

async function autoTarget(options, item) {
	if (!options || !item) return;
	// Default targetType to "ENEMIES"
	options = foundry.utils.deepClone(options);
	options.targetType = options.targetType || "ENEMIES";
	const targetList = new Map();
	if (options.targetType === "SELF") {
		item.actor.getActiveTokens().forEach(t => targetList.set(t, { count: 1 }));
	} else {
		let targetCandidates = [];
		const rollerTokenOrProtoType = item.actor.token || item.actor.prototypeToken;
		// Treat neutral rolls as friendly and secret rolls as hostile for the sake of targetting.
		const rollerDisposition = rollerTokenOrProtoType.disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : 
			rollerTokenOrProtoType.disposition === CONST.TOKEN_DISPOSITIONS.SECRET ? CONST.TOKEN_DISPOSITIONS.HOSTILE : 
			rollerTokenOrProtoType.disposition;
		let targetFilter;
		if (options.targetType === "ALLIES") {
			targetFilter = t => t.document.disposition === rollerDisposition && t.actor.id !== item.actor.id && t.id !== rollerTokenOrProtoType.id;
		} else if (options.targetType === "ALLIES_AND_SELF") {
			targetFilter = t => t.document.disposition === rollerDisposition;
		} else if (options.targetType === "ALL") {
			targetFilter = t => [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(t.document.disposition);
		} else {
			// ENEMIES, ENEMIES_MELEE, ENEMIES_MELEE_FLYING
			targetFilter = t => {
				// TODO: Define this in a more general way and/or allow the user to customize somehow
				const effects = [...t.actor.effects];
				return !t.document.hidden &&
					t.document.disposition === -rollerDisposition &&
					!effects.some(e => 
						!e.disabled && [...e.statuses].some(s => !s.disabled && 
							(
								UNTARGETABLE_ALL_EFFECTS.includes(s) || 
								("ENEMIES_MELEE" === options.targetType && !actorHasStatus(item.actor, 'flying') && UNTARGETABLE_MELEE_EFFECTS.includes(s)) ||
								(("ENEMIES_MELEE" === options.targetType && actorHasStatus(item.actor, 'flying') || "ENEMIES_MELEE_FLYING" === options.targetType) && actorHasStatus(item.actor, 'flying') && UNTARGETABLE_MELEE_FLYING_EFFECTS.includes(s))
							)
					));
			};
		}

		targetCandidates.push(...game.canvas.tokens.placeables.filter(targetFilter));

		if (typeof options.maxTargets === "number" && options.maxTargets > 0) {

			const forcedTargetsMap = new Map();

			// Force targets only for rolls targeting enemies.
			if (["ENEMIES", "ENEMIES_MELEE", "ENEMIES_MELEE_FLYING"].includes(options.targetType)) {
				[...item.actor.effects].forEach(e => {
					const effectStatuses = [...e.statuses];
					if (e.origin && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {
						const origin = fromUuidSync(e.origin);
						const forcedTargetIndex = targetCandidates.findIndex(t => t.document.actor.uuid === (origin.actor || origin)?.uuid);
						if (forcedTargetIndex >= 0) {
							const forcedTarget = options.repeat ? targetCandidates[forcedTargetIndex] : targetCandidates.splice(forcedTargetIndex, 1)[0];
							forcedTargetsMap.set(forcedTarget, e);
						} else {
							ui.notifications.warn(game.i18n.format(`${MODULE}.autoTarget.errors.forcedTargetInvalid`, {effect: e.name, roller: (item.actor.token || item.actor.prototypeToken).name}));
							return false;
						}
					}
				});
			}

			const forcedTargets = [...forcedTargetsMap.keys()];

			let i = 0;
			while (i < options.maxTargets && (forcedTargets.length > 0 || targetCandidates.length > 0)) {
				const forced = forcedTargets.length > 0;
				let drawPile = forced ? forcedTargets : targetCandidates;
				var start = Math.floor(Math.random() * (drawPile.length));
				const target = options.repeat && drawPile === targetCandidates ? drawPile[start] : drawPile.splice(start, 1)[0];
				targetList.set(target, (targetList.has(target) ? foundry.utils.mergeObject(targetList.get(target), { count: targetList.get(target).count + 1 }) : { count: 1, forcedBy: forcedTargetsMap.get(target) }));
				i++;
			}
		} else targetCandidates.forEach(t => targetList.set(t, { count: 1 }));
	}

	game.user.updateTokenTargets([...targetList.keys()].map(t => t.id));

	const templateData = {
		results: [...targetList.keys()].map(t => foundry.utils.mergeObject(targetList.get(t), {target: t})),
		targetType: game.i18n.localize(TARGET_TYPES[options.targetType])
	}
	ChatMessage.create({
		content: await renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData),
		speaker: {
			actor: item.actor,
			token: item.actor.token
		},
		flavor: `${item.name}`
	});
}

function getFormOptions(html) {
	const formElement = html[0].querySelector('form');
	const formData = new FormDataExtended(formElement);
	return foundry.utils.expandObject(formData.object);
}

export const TARGET_TYPES = Object.freeze ({
	ENEMIES: `${MODULE}.autoTarget.options.targetType.types.enemies`,
	ENEMIES_MELEE: `${MODULE}.autoTarget.options.targetType.types.enemiesMelee`,
	ENEMIES_MELEE_FLYING: `${MODULE}.autoTarget.options.targetType.types.enemiesMeleeFlying`,
	ALLIES: `${MODULE}.autoTarget.options.targetType.types.allies`,
	SELF: `${MODULE}.autoTarget.options.targetType.types.self`,
	ALLIES_AND_SELF: `${MODULE}.autoTarget.options.targetType.types.alliesAndSelf`,
	ALL: `${MODULE}.autoTarget.options.targetType.types.all`
});

export const RESOURCE_TYPES = Object.freeze ({
	MP: {label: `FU.MindPoints`, model: `system.resources.mp.value`},
	IP: {label: `FU.InventoryPoints`, model: `system.resources.ip.value`},
	HP: {label: `FU.HealthPoints`, model: `system.resources.hp.value`},
	ZENIT: {label: `FU.Zenit`, model: `system.resources.zenit.value`},
});

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_MELEE_FLYING_EFFECTS = ['cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];
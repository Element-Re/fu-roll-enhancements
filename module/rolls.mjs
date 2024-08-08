import { keyBinds, MODULE } from './settings.mjs';
import { TEMPLATES } from './templates.mjs';

export const prepareCheckHandler = (check, actor, item, registerCallback) => {
	console.log("fu-roll-enhancements | preparing check...", check);
	
	registerCallback(async (check) => {
		console.log("fu-roll-enhancements | entering prepared check callback...", check);
		
		console.log("fu-roll-enhancements | exiting prepared check callback...", check);
	})
	
	console.log("fu-roll-enhancements | ...done preparing check", check);
}

export const processCheckHandler =  async (check, actor, item) => {
	console.log("fu-roll-enhancements | processing check...", check,);
	const rollKeys = foundry.utils.deepClone(keyBinds);
	
	check.additionalData.autoTarget = autoTargetWorkflow(item, rollKeys.autoTargetDialog);
	check.additionalData.autoSpend = Promise.resolve(check.additionalData.autoTarget)
	.then(autoTarget => autoSpendWorkflow(item, autoTarget?.count || game.user.targets.size, rollKeys.autoSpendDialog));
	
	check.additionalData.pre = Promise.all([check.additionalData.autoTarget, check.additionalData.autoSpend]).then(results => {
		if (game.settings.get(MODULE, "preRollItemMacro") && item.hasMacro && item.hasMacro())
			return item.executeMacro("pre", check);
	});
		
	check.additionalData.post = Promise.resolve(check.additionalData.pre).then(pre => {
		if (game.settings.get(MODULE, "postRollItemMacro") && item.hasMacro && item.hasMacro())
			return item.executeMacro("post", check);
	})
		
	console.log("fu-roll-enhancements | ...done processing check", check);
}
	
export const renderCheckHandler = (sections, check, actor, item) => {
		
	console.log("fu-roll-enhancements | rendering check...", check);



	if (item.getFlag(MODULE, 'autoTarget.enable')) {
		const oldTargetsIndex = sections.findIndex(s => s.partial === "systems/projectfu/templates/chat/partials/chat-check-targets.hbs")
		if (oldTargetsIndex >= 0) {
			sections.splice(oldTargetsIndex, 1);
		} 
		sections.push(Promise.resolve(check.additionalData.autoTarget).then(autoTargetResults => {
			if (autoTargetResults) {
				game.user.updateTokenTargets(autoTargetResults.targets.map(t => t.id));
				check.additionalData.targets = prepareTargets(autoTargetResults.targets, check)
				return renderTemplate(TEMPLATES.CHAT_CHECK_TARGETS, {targets: check.additionalData.targets})
			}
		}).then(content => ({
			content: content,
			order: 1000	
		})));
	}
	sections.push(
		Promise.resolve(check.additionalData.autoTarget)
			.then(autoTargetResults => {
				return autoTargetResults?.content
			})
			.then(content => ({
					content: content,
					order: -1900	
			}))
	);

	console.log("fu-roll-enhancements | ...done rendering check", check);
}

export async function rollEnhancements (wrapped, ...args) {
	const item = this;
	const rollKeys = foundry.utils.deepClone(keyBinds);
	
	// Auto Target
	const autoTargetPromise = Promise.resolve(autoTargetWorkflow(item, rollKeys.autoTargetDialog));
	console.log("fu-roll-enhancements | done getting targets");
	// Auto Spend
	const autoSpendPromise = autoTargetPromise.then(autoTarget => autoSpendWorkflow(item, autoTarget?.count || game.user.targets.size, rollKeys.autoSpendDialog));
	console.log("fu-roll-enhancements | done spending costs");

	let prePromise = Promise.resolve();
	// Item macro "pre" event
	if (game.settings.get(MODULE, "preRollItemMacro") && item.hasMacro && item.hasMacro())
		prePromise =  Promise.resolve(item.executeMacro("pre"));
	
	Promise.all([autoTargetPromise, autoSpendPromise]).then(results => {
		const autoTarget = results[0];
		if (autoTarget?.finalize)
			return autoTarget.finalize();
	});
	
	console.log("fu-roll-enhancements | done finalizing targets");
	// Chain wrapped function(s)
	const rollResultsPromise = Promise.resolve(wrapped(...args));

	const postPromise = Promise.all([rollResultsPromise, autoSpendPromise]).then(promises => {
		const rollResults = promises[0];
		const autoSpend = promises[1];
		const $content = $(rollResults.content);
		$content.append(autoSpend.results.content);
		//console.log(autoSpend, $content.html());
		return rollResults.update({content: $content.html()}).then(newResults => {
			// Item macro "post" event
			if (game.settings.get(MODULE, "postRollItemMacro") && item.hasMacro && item.hasMacro())
				return item.executeMacro("post", newResults);
		});
	})
	return postPromise.then(() => rollResultsPromise);
}

function getItemDisplayData(item) {
	let displayData = {};
	switch (item.type) {
		case "weapon":
			displayData = item.getWeaponDisplayData(item.actor);
			break;
		case "basic":
			displayData = foundry.utils.mergeObject(item.getWeaponDisplayData(item.actor), {qualityString: item.system.quality?.value || game.i18n.localize('FU.BasicAttack')})
			break;
		case "spell":
			displayData =  item.getSpellDisplayData();
			break;
		case "skill":
			displayData = item.getSkillDisplayData();
			break;
		default:
			displayData = item.getItemDisplayData() || displayData;
			break;
	}

	displayData.qualityString = displayData.qualityString || item.system.summary.value || game.i18n.localize(`TYPES.Item.${item.type}`)

	return displayData;
};


function getDefaultMpCost(item) {
	if (typeof item.system.mpCost?.value === "number") {
		return {
			cost: item.system.mpCost.value,
				resourceType: "MP",
				// NOTE: This should only apply to rituals, which do not have per-target costs.
				perTarget: false 
		}
	} else if (typeof item.system.mpCost?.value === "string") {
		const mpCostMatch = item.system.mpCost.value.match(/^(\d+)(\s+[x*×]\s+)?(t)?/i);
			if (!mpCostMatch) return null;
			const mpCost = mpCostMatch[1];
			return mpCost ? {
				cost: Number(mpCost),
				resourceType: "MP",
				perTarget: mpCostMatch[2] && mpCostMatch [3]
			} : null;
	} else  {
		return null;
	}
}

async function autoSpendWorkflow(item, targetCount, showDialog) {
	if (!item.actor || !game.settings.get(MODULE, "enableAutoSpend")) return;
	const templateData = {
			item: item.type === "spell" ? foundry.utils.mergeObject(item.toObject(), {flags: { [MODULE]: {autoSpend: {enable: true}}}}) : item,
			resourceTypes: getResourceTypes(item.actor),
			showEnable: item.type === "spell",
			displayData: getItemDisplayData(item),
		};
	const spendDialogContent = await renderTemplate(TEMPLATES.AUTO_SPEND_DIALOG, templateData);
	
	if (showDialog) {
		return Dialog.wait({
			title: game.i18n.localize(`${MODULE}.autoSpend.dialog.title`),
			content: spendDialogContent,
			buttons: {
				spend: {
					icon: '<i class="fas fa-coins"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.spend`),
					callback: async (html) => {
						// Always enabled for anything that is not a spell
						const formInput = item.type === "spell" ? getFormInput(html) : 
							foundry.utils.mergeObject(getFormInput(html), {flags: { [MODULE]: {autoSpend: {enable: true}}}});
						const autoSpendOptions = formInput.flags[MODULE].autoSpend.enable ? formInput.flags[MODULE].autoSpend : getDefaultMpCost(item);
						await autoSpend(item, autoSpendOptions, targetCount);
					}
				},
				updateAndSpend: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.updateAndSpend`),
					callback: async (html) => {
						// Always enabled for anything that is not a spell
						const formInput = item.type === "spell" ? getFormInput(html) : 
							foundry.utils.mergeObject(getFormInput(html), {flags: { [MODULE]: {autoSpend: {enable: true}}}});
						const autoSpendOptions = formInput.flags[MODULE].autoSpend.enable ? formInput.flags[MODULE].autoSpend : getDefaultMpCost(item);
						item.update(formInput);
						return await autoSpend(item, autoSpendOptions, targetCount);
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
	} else {
		const autoSpendOptions = item.getFlag(MODULE, 'autoSpend');
		return await autoSpend(item, autoSpendOptions?.enable ? autoSpendOptions : getDefaultMpCost(item), targetCount);
	}
}

async function autoSpend(item, options, targetCount) {
	if (!item.actor || (options?.cost || -1) <= 0) return;
	const resourceType = getResourceTypes(item.actor)[options.resourceType];
	const finalCost = options.cost * (options.perTarget ? targetCount : 1);
	if (finalCost <= 0) return;
	const currentValue = foundry.utils.getProperty(item.actor, resourceType.model);
	const newValue = Math.max(currentValue - finalCost, 0);
	const resultsData = {
		formattedStarting: game.i18n.format(`${MODULE}.autoSpend.results.format.resource.${resourceType.shortLabel}`, {amount: currentValue}),
		formattedSpent: game.i18n.format(`${MODULE}.autoSpend.results.format.subtraction`, {
			resource: game.i18n.format(`${MODULE}.autoSpend.results.format.resource.${resourceType.shortLabel}`, {amount: finalCost})
		}),
		formattedRemaining: game.i18n.format(`${MODULE}.autoSpend.results.format.resource.${resourceType.shortLabel}`, {amount: newValue}),
	}
	if ((item.actor.type === "npc" && ["IP", "ZENIT"].includes(options.resourceType)) || newValue + finalCost !== currentValue) {
		let errorMessage = game.i18n.format(`${MODULE}.autoSpend.errors.notEnoughResources.message`, resultsData);
		const dialogBinding = game.keybindings.actions.get(`${MODULE}.autoSpendDialog`).editable[0];
		if (dialogBinding) {
			errorMessage = game.i18n.format(`${MODULE}.autoSpend.errors.notEnoughResources.skipHint`, {baseMessage: errorMessage, dialogKey: dialogBinding.key});
		}
		ui.notifications.warn(errorMessage);
		throw errorMessage;
	}
	const updates = {[resourceType.model]: newValue};
	item.actor.update(updates);

	return {
		results: {
			content: await renderTemplate(TEMPLATES.AUTO_SPEND_RESULTS, {results: resultsData})
		}
	};
	// ChatMessage.create({
	// 	speaker: ChatMessage.getSpeaker( item.actor ),
	// 	flavor: game.i18n.format(`${MODULE}.autoSpend.results.flavor`, {item: item.name}),
	// 	content: await renderTemplate(TEMPLATES.SIMPLE_CHAT_MESSAGE, {
	// 		message: game.i18n.format(`${MODULE}.autoSpend.results.chatMessage`, resultsData)
	// 	}),
	// });
}

async function autoTargetWorkflow(item, showDialog) {
	if (!item.actor || (!game.user.isGM && !game.settings.get(MODULE, "allowPlayerAutoTarget"))) return;

	// If keybind is pressed, show dialog
	if (showDialog) {
		const templateData = {
			item: item,
			targetTypes: TARGET_TYPES,
			displayData: getItemDisplayData(item),
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
						const formInput = getFormInput(html);
						return await autoTarget(formInput.flags[MODULE].autoTarget, item);
					}
				},
				updateAndTarget: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.updateAndTarget`),
					callback: async (html) => {
						const formInput = getFormInput(html)
						const updateData = foundry.utils.flattenObject(foundry.utils.mergeObject(formInput, {flags: { [MODULE]: {autoTarget: {enable: true}}}}));
						await item.update(updateData);
						return await autoTarget(formInput.flags[MODULE].autoTarget, item);
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
		return await autoTarget(options, item);
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
				targetList.set(target, (targetList.has(target) ? foundry.utils.mergeObject(targetList.get(target), { count: targetList.get(target).count + 1 }) : { count: 1, forced: forcedTargetsMap.get(target) }));
				i++;
			}
		} else targetCandidates.forEach(t => targetList.set(t, { count: 1 }));
	}


	const templateData = {
		results: [...targetList.keys()].map(t => foundry.utils.mergeObject(targetList.get(t), {target: t})),
		targetType: game.i18n.localize(TARGET_TYPES[options.targetType])
	}

	return {
		totalCount: [...targetList.keys()].reduce((count, t) => targetList.get(t).count + count, 0),
		targets: [...targetList.keys()],//({id: t.id, count: targetList.get(t).count, forced: targetList.get(t).forced})),
		content: renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData)
		// finalize: async () => {
		// 	game.user.updateTokenTargets([...targetList.keys()].map(t => t.id));

		// 	const templateData = {
		// 		results: [...targetList.keys()].map(t => foundry.utils.mergeObject(targetList.get(t), {target: t})),
		// 		targetType: game.i18n.localize(TARGET_TYPES[options.targetType])
		// 	}
		// 	ChatMessage.create({
		// 		content: await renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData),
		// 		speaker: {
		// 			actor: item.actor,
		// 			token: item.actor.token
		// 		},
		// 		flavor: `${item.name}`
		// 	});
		// }
	}
	
}

function getFormInput(html) {
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

export function getResourceTypes(actor) {
	return actor?.type !== "npc" ? RESOURCE_TYPES : NPC_RESOURCE_TYPES;
}

function prepareTargets(targets, check) {
	const targetedDefense = check.additionalData.targetedDefense;
	if (!targetedDefense) return [];

	return [...targets]
		.filter((token) => !!token.actor)
		.map((token) => ({
			name: token.actor.name,
			uuid: token.actor.uuid,
			link: token.actor.link,
			difficulty: token.actor.system.derived[targetedDefense].value,
			result: (check.critical || (!check.fumble && check.result >= token.actor.system.derived[targetedDefense].value)) ? 'hit' : 'miss'
		}));
}

const RESOURCE_TYPES = Object.freeze ({
	MP: {label: `FU.MindPoints`, shortLabel: `mp`, model: `system.resources.mp.value`},
	IP: {label: `FU.InventoryPoints`, shortLabel: `ip`, model: `system.resources.ip.value`},
	HP: {label: `FU.HealthPoints`, shortLabel: `hp`, model: `system.resources.hp.value`},
	ZENIT: {label: `FU.Zenit`, shortLabel: `z`, model: `system.resources.zenit.value`},
	FP: {label: `FU.FabulaPoints`, shortLabel: `fp`, model: `system.resources.fp.value`},
});

const NPC_RESOURCE_TYPES = Object.freeze({
	MP: {label: `FU.MindPoints`, shortLabel: `mp`, model: `system.resources.mp.value`},
	IP: {label: `FU.InventoryPoints`, shortLabel: `ip`, model: `system.resources.ip.value`},
	HP: {label: `FU.HealthPoints`, shortLabel: `hp`, model: `system.resources.hp.value`},
	ZENIT: {label: `FU.Zenit`, shortLabel: `z`, model: `system.resources.zenit.value`},
	FP: {label: `FU.UltimaPoints`, shortLabel: `up`, model: `system.resources.fp.value`},
});

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_MELEE_FLYING_EFFECTS = ['cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];
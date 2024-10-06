import { keyBinds, MODULE } from './settings.mjs';
import { TEMPLATES, hasDefaultCost } from './templates.mjs';

export async function rollEnhancements (wrapped, ...args) {
	const item = this;
	const rollKeys = foundry.utils.deepClone(keyBinds);
	let autoTarget;

	// Auto Target
	autoTarget = await autoTargetWorkflow(item, rollKeys.autoTargetDialog);
	console.log(`${MODULE} | done getting targets`);
	// Auto Spend
	await autoSpendWorkflow(item, autoTarget?.count || game.user.targets.size, rollKeys.autoSpendDialog);
	console.log(`${MODULE} | done spending costs`);
	// Item macro 'pre' event
	if (game.settings.get(MODULE, 'preRollItemMacro') && item.hasMacro && item.hasMacro())
		await item.executeMacro('pre');
	if (autoTarget?.finalize)
		await autoTarget.finalize();
	console.log(`${MODULE} | done finalizing targets`);
	// Chain wrapped function(s)
	const rollResults = await wrapped(...args);
	// Item macro 'post' event
	if (game.settings.get(MODULE, 'postRollItemMacro') && item.hasMacro && item.hasMacro())
		await item.executeMacro('post', rollResults);
	return rollResults;
}

function getItemDisplayData(item) {
	let displayData = {};
	switch (item.type) {
		case 'weapon':
			displayData = item.getWeaponDisplayData(item.actor);
			break;
		case 'basic':
			displayData = foundry.utils.mergeObject(item.getWeaponDisplayData(item.actor), {qualityString: item.system.quality?.value || game.i18n.localize('FU.BasicAttack')})
			break;
		case 'spell':
			displayData =  item.getSpellDisplayData();
			break;
		case 'skill':
			displayData = item.getSkillDisplayData();
			break;
		default:
			displayData = item.getItemDisplayData() || displayData;
			break;
	}

	displayData.qualityString = displayData.qualityString || item.system.summary.value || game.i18n.localize(`TYPES.Item.${item.type}`)

	return displayData;
};


function getDefaultCost(item) {
	if (typeof item.system.mpCost?.value === 'number') {
		return {
			cost: item.system.mpCost.value,
				resourceType: 'MP',
				perTarget: false 
		}
	} else if (typeof item.system.mpCost?.value === 'string') {
		const mpCostMatch = item.system.mpCost.value.match(/^(\d+)(\s+[x*×]\s+)?(t)?/i);
			if (!mpCostMatch) return null;
			const mpCost = mpCostMatch[1];
			return mpCost ? {
				cost: Number(mpCost),
				resourceType: 'MP',
				perTarget: mpCostMatch[2] && mpCostMatch [3]
			} : null;
	} else if (typeof item.system.ipCost?.value === 'number') {
		return {
			cost: item.system.ipCost.value,
				resourceType: 'IP',
				perTarget: false 
		}
	} else  {
		return null;
	}
}

async function autoSpendWorkflow(item, targetCount, showDialog) {
	if (!item.actor || !game.settings.get(MODULE, 'enableAutoSpend')) return;
	const templateData = {
			item: item,
			resourceTypes: getResourceTypes(item.actor),
			hasDefaultCost: hasDefaultCost(item),
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
						const formInput = getFormInput(html);
							const autoSpendOptions = (hasDefaultCost(item) && !formInput.flags[MODULE].autoSpend.enable) ? 
								getDefaultCost(item) :
								formInput.flags[MODULE].autoSpend;
							await autoSpend(item, autoSpendOptions, targetCount);
					}
				},
				updateAndSpend: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.updateAndSpend`),
					callback: async (html) => {
						const formInput = getFormInput(html);
						await item.update(formInput);
						const defaultCost = getDefaultCost(item);
						(defaultCost && !formInput.flags[MODULE].autoSpend.enable) ? 
								defaultCost :
								formInput.flags[MODULE].autoSpend;
						const autoSpendOptions = formInput.flags[MODULE].autoSpend.enable ? formInput.flags[MODULE].autoSpend : getDefaultCost(item);
						
						await autoSpend(item, autoSpendOptions, targetCount);
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.skip`),
				},
				disable: {
					icon: '<i class="fas fa-ban"></i>',
					label: game.i18n.localize(`${MODULE}.autoSpend.dialog.buttons.disable`),
					callback:() => {
						if (hasDefaultCost(item)) {
							item.update({[`flags.${MODULE}.autoSpend`]: {enable: true, 'cost': 0}});
						} else {
							item.setFlag(MODULE, 'autoSpend.enable', false);
					  }
					}
				},
			},
			close: () => {
				console.log(`${MODULE} | closing auto-spend dialog`);
			},
			render: (html) => {
				  // Make 'enable' field display *if* there is no default cost, because modifying it is already handled by the dialog options.
					if(!hasDefaultCost(item)) {
						$(html).find(`input[name="flags.${MODULE}.autoSpend.enable"]`)
							.prop('disabled', true)
							.css('cursor', 'help')
							// With this, the "enable" field will always be considered set to true.
							.after(`<input type="checkbox" name="flags.${MODULE}.autoSpend.enable" style="display: none" checked />`);
						$(html).find(`label:has(input[name="flags.${MODULE}.autoSpend.enable"])`)
							.attr('data-tooltip', game.i18n.localize(`${MODULE}.autoSpend.options.enable.locked.enableDisableHint`))
							.css('cursor', 'help')

					}
			}
		}, {id: 'auto-spend-dialog'}); 
	} else {
		const autoSpendOptions = item.getFlag(MODULE, 'autoSpend');
		await autoSpend(item, autoSpendOptions?.enable ? autoSpendOptions : getDefaultCost(item), targetCount);
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
		actor: item.actor.name,
		amount: finalCost,
		resource: game.i18n.localize(resourceType.label),
		from: item.name,
	}
	if ((item.actor.type === 'npc' && ['IP', 'ZENIT'].includes(options.resourceType)) || newValue + finalCost !== currentValue) {
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
	ChatMessage.create({
		speaker: ChatMessage.getSpeaker( item.actor ),
		flavor: game.i18n.format(`${MODULE}.autoSpend.results.flavor`, {item: item.name}),
		content: await renderTemplate(TEMPLATES.SIMPLE_CHAT_MESSAGE, {
			message: game.i18n.format(`${MODULE}.autoSpend.results.chatMessage`, resultsData)
		}),
	});
}

async function autoTargetWorkflow(item, showDialog) {
	if (!item.actor || (!game.user.isGM && !game.settings.get(MODULE, 'allowPlayerAutoTarget'))) return;

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
						const formInput = getFormInput(html);
						const autoTargetOptions = formInput.flags[MODULE].autoTarget;
						const updateData = foundry.utils.mergeObject(
							formInput,
							foundry.utils.expandObject({[`flags.${MODULE}.autoTarget.enable`]: true})
						);
						await item.update(updateData);
						return await autoTarget(autoTargetOptions, item);
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.skip`),
				},
				disable: {
					icon: '<i class="fas fa-ban"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.disable`),
					callback: () => item.setFlag(MODULE, 'autoTarget.enable', false)
				},
			},
			close: () => {
				console.log(`${MODULE} | closing auto-target dialog`);
			},
			render: (html) => {
				  // Make 'enable' field display only, because modifying it is already handled by the dialog options.
				  $(html).find(`input[name="flags.${MODULE}.autoTarget.enable"]`)
						.prop('disabled', true)
						.css('cursor', 'help');
					$(html).find(`label:has(input[name="flags.${MODULE}.autoTarget.enable"])`)
						.attr('data-tooltip', game.i18n.localize(`${MODULE}.autoTarget.options.enable.locked.enableDisableHint`))
						.css('cursor', 'help');
			}
		}, {id: 'auto-target-dialog'}); 
	} else if (item.getFlag(MODULE, 'autoTarget')?.enable) {
		const options = item.getFlag(MODULE, 'autoTarget');
		return await autoTarget(options, item);
	}

}

function actorHasStatus(actor, ...statuses) {
	return actor.statuses.some(s => statuses.includes(s));
}

async function autoTarget(options, item) {
	if (!options || !item) return;
	// Default targetType to 'ENEMIES'
	options = foundry.utils.deepClone(options);
	options.targetType = options.targetType || 'ENEMIES';
	const targetList = new Map();
	if (options.targetType === 'SELF') {
		item.actor.getActiveTokens().forEach(t => targetList.set(t, { count: 1 }));
	} else {
		let targetCandidates = [];
		const rollerTokenOrProtoType = item.actor.token || item.actor.prototypeToken;
		// Treat neutral rolls as friendly and secret rolls as hostile for the sake of targetting.
		const rollerDisposition = rollerTokenOrProtoType.disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : 
			rollerTokenOrProtoType.disposition === CONST.TOKEN_DISPOSITIONS.SECRET ? CONST.TOKEN_DISPOSITIONS.HOSTILE : 
			rollerTokenOrProtoType.disposition;
		let targetFilter;
		if (options.targetType === 'ALLIES') {
			targetFilter = t => t.document.disposition === rollerDisposition && t.actor.id !== item.actor.id && t.id !== rollerTokenOrProtoType.id;
		} else if (options.targetType === 'ALLIES_AND_SELF') {
			targetFilter = t => t.document.disposition === rollerDisposition;
		} else if (options.targetType === 'ALL') {
			targetFilter = t => [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(t.document.disposition);
		} else {
			// ENEMIES, ENEMIES_MELEE, ENEMIES_MELEE_FLYING
			targetFilter = t => {
				return !t.document.hidden &&
					t.document.disposition === -rollerDisposition && 
					!actorHasStatus(t.actor, ...UNTARGETABLE_ALL_EFFECTS) && 
					!(
						('ENEMIES_MELEE' === options.targetType && !actorHasStatus(item.actor, 'flying') && actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_EFFECTS))
						|| 
						(
							('ENEMIES_MELEE_FLYING' === options.targetType || ('ENEMIES_MELEE' === options.targetType && actorHasStatus(item.actor, 'flying'))) && 
							actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_FLYING_EFFECTS)
						)
					)
			};
		}

		targetCandidates.push(...game.canvas.tokens.placeables.filter(targetFilter));

		if (typeof options.maxTargets === 'number' && options.maxTargets > 0) {

			const forcedTargetsMap = new Map();

			// Force targets only for rolls targeting enemies.
			if (['ENEMIES', 'ENEMIES_MELEE', 'ENEMIES_MELEE_FLYING'].includes(options.targetType)) {
				[...item.actor.appliedEffects].forEach(e => {
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

	return {
		count: [...targetList.keys()].reduce((count, t) => targetList.get(t).count + count, 0),
		finalize: async () => {
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
	return actor?.type !== 'npc' ? RESOURCE_TYPES : NPC_RESOURCE_TYPES;
}

const RESOURCE_TYPES = Object.freeze ({
	MP: {label: `FU.MindPoints`, model: `system.resources.mp.value`},
	IP: {label: `FU.InventoryPoints`, model: `system.resources.ip.value`},
	HP: {label: `FU.HealthPoints`, model: `system.resources.hp.value`},
	ZENIT: {label: `FU.Zenit`, model: `system.resources.zenit.value`},
	FP: {label: `FU.FabulaPoints`, model: `system.resources.fp.value`},
});

const NPC_RESOURCE_TYPES = Object.freeze({
	MP: {label: `FU.MindPoints`, model: `system.resources.mp.value`},
	IP: {label: `FU.InventoryPoints`, model: `system.resources.ip.value`},
	HP: {label: `FU.HealthPoints`, model: `system.resources.hp.value`},
	ZENIT: {label: `FU.Zenit`, model: `system.resources.zenit.value`},
	FP: {label: `FU.UltimaPoints`, model: `system.resources.fp.value`},
});

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_MELEE_FLYING_EFFECTS = ['cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];
import { keyBinds, MODULE } from './settings.mjs';
import { TEMPLATES, hasDefaultCost } from './templates.mjs';
import { AutoTarget } from './autoTarget.mjs';

export async function rollEnhancements (wrapped, ...args) {
	const item = this;
	const rollKeys = foundry.utils.deepClone(keyBinds);
	let autoTargetResults;

	// Auto Target
	autoTargetResults = await autoTargetWorkflow(item, rollKeys.autoTargetDialog);
	console.log(`${MODULE} | done getting targets`);
	// Auto Spend
	await autoSpendWorkflow(item, autoTargetResults?.count || game.user.targets.size, rollKeys.autoSpendDialog);
	console.log(`${MODULE} | done spending costs`);
	// Item macro 'pre' event
	if (game.settings.get(MODULE, 'preRollItemMacro') && item.hasMacro && item.hasMacro())
		await item.executeMacro({event: 'pre'});
	if (autoTargetResults?.finalize)
		await autoTargetResults.finalize();
	console.log(`${MODULE} | done finalizing targets`);
	// Chain wrapped function(s)
	const rollResults = await wrapped(...args);
	// Item macro 'post' event
	if (game.settings.get(MODULE, 'postRollItemMacro') && item.hasMacro && item.hasMacro())
		await item.executeMacro({event: 'post'}, rollResults);
	return rollResults;
}

// No longer exposed by the system, nothing we can do here.
// function getItemDisplayData(item) {
// 	let displayData = {};
// 	switch (item.type) {
// 		case 'weapon':
// 			displayData = item.getWeaponDisplayData(item.actor);
// 			break;
// 		case 'basic':
// 			displayData = foundry.utils.mergeObject(item.getWeaponDisplayData(item.actor), {qualityString: item.system.quality?.value || game.i18n.localize('FU.BasicAttack')});
// 			break;
// 		case 'spell':
// 			displayData =  item.getSpellDisplayData();
// 			break;
// 		case 'skill':
// 			displayData = item.getSkillDisplayData();
// 			break;
// 		default:
// 			displayData = item.getItemDisplayData() || displayData;
// 			break;
// 	}
//
// 	displayData.qualityString = displayData.qualityString || item.system.summary.value || game.i18n.localize(`TYPES.Item.${item.type}`);
//
// 	return displayData;
// };

function getDefaultCost(item) {
	// Pre-2.4.9
	if (typeof item.system.mpCost?.value === 'number') {
		return {
			cost: item.system.mpCost.value,
				resourceType: 'MP',
				perTarget: false 
		};
	}
	else if (typeof item.system.mpCost?.value === 'string') {
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
		};
		
	} 
	// Post-2.4.9
	else if (typeof item.system.cost?.amount === 'number') {
		return {
			cost: item.system.cost.amount,
			resourceType: item.system.cost.resource.toUpperCase(),
			perTarget: item.system.targeting.rule === 'multiple'
		};
	}
	else  {
		return null;
	} 
	
} 

async function autoSpendWorkflow(item, targetCount, showDialog) {
	if (!item.actor || !game.settings.get(MODULE, 'enableAutoSpend')) return;
	const templateData = {
			item: item,
			resourceTypes: getResourceTypes(item.actor),
			hasDefaultCost: hasDefaultCost(item),
			//displayData: getItemDisplayData(item), // No longer exposed by the system
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
							.css('cursor', 'help');

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
		actor: item.actor.token?.name ?? item.actor.protoTypeToken?.name ?? item.actor.name,
		amount: finalCost,
		resource: game.i18n.localize(resourceType.label),
		from: item.name,
	};
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
	const messageData = ChatMessage.applyRollMode({
		speaker: ChatMessage.getSpeaker( item.actor ),
		flavor: game.i18n.format(`${MODULE}.autoSpend.results.flavor`, {item: item.name}),
		content: await renderTemplate(TEMPLATES.SIMPLE_CHAT_MESSAGE, {
			message: game.i18n.format(`${MODULE}.autoSpend.results.chatMessage`, resultsData)
		}),
	}, game.settings.get('core', 'rollMode'));
	ChatMessage.create(messageData);
}

async function autoTargetWorkflow(item, showDialog) {
	if (!item.actor || (!game.user.isGM && !game.settings.get(MODULE, 'allowPlayerAutoTarget'))) return;

	// If keybind is pressed, show dialog
	if (showDialog) {
		const templateData = {
			item: item,
			targetTypes: TARGET_TYPES,
			// displayData: getItemDisplayData(item), // No longer exposed by the system
			hasDefaultTargetStrategy: AutoTarget.hasDefaultStrategyFor(item)
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
						return await AutoTarget.execute(item, formInput.flags[MODULE].autoTarget);
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
						return await AutoTarget.execute(item, autoTargetOptions);
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.skip`),
				},
				disable: {
					icon: '<i class="fas fa-ban"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.disable`),
					callback: () => {
						if (AutoTarget.hasDefaultStrategyFor(item)) {
							item.update({[`flags.${MODULE}.autoTarget`]: {enable: true, targetType: null, 'maxTargets': null}});
						} else {
							item.setFlag(MODULE, 'autoSpend.enable', false);
					  }
					}
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
	}
	else return await AutoTarget.execute(item);
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
	MP: {label: 'FU.MindPoints', model: 'system.resources.mp.value'},
	IP: {label: 'FU.InventoryPoints', model: 'system.resources.ip.value'},
	HP: {label: 'FU.HealthPoints', model: 'system.resources.hp.value'},
	ZENIT: {label: 'FU.Zenit', model: 'system.resources.zenit.value'},
	FP: {label: 'FU.FabulaPoints', model: 'system.resources.fp.value'},
});

const NPC_RESOURCE_TYPES = Object.freeze({
	MP: {label: 'FU.MindPoints', model: 'system.resources.mp.value'},
	IP: {label: 'FU.InventoryPoints', model: 'system.resources.ip.value'},
	HP: {label: 'FU.HealthPoints', model: 'system.resources.hp.value'},
	ZENIT: {label: 'FU.Zenit', model: 'system.resources.zenit.value'},
	FP: {label: 'FU.UltimaPoints', model: 'system.resources.fp.value'},
});

export const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];
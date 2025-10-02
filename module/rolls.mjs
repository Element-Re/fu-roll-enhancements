import {keyBinds} from './settings.mjs';
import {AutoTarget} from './autoTarget.mjs';
import {MODULE} from './helpers/module-utils.mjs';
import {showAutoSpendDialog, showAutoTargetDialog} from './helpers/dialogs.mjs';
import {autoSpend} from './autoSpend.mjs';

export async function rollEnhancements(wrapped, ...args) {
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

export function getDefaultCost(item) {

    if (!item) return;

    if (typeof item.system.cost?.amount === 'number') {
        return {
            cost: item.system.cost.amount,
            resourceType: item.system.cost.resource.toUpperCase(),
            perTarget: item.system.targeting.rule === 'multiple'
        };
    } else {
        return null;
    }
}

export function hasDefaultCost(item) {
    return Boolean(getDefaultCost(item));
}

async function autoSpendWorkflow(item, targetCount, showDialog) {
	if (!item.actor || !game.settings.get(MODULE, 'enableAutoSpend')) return;

	if (showDialog) {
        await showAutoSpendDialog(item, targetCount);
	} else {
		const autoSpendOptions = item.getFlag(MODULE, 'autoSpend');
		await autoSpend(item, autoSpendOptions?.enable ? autoSpendOptions : getDefaultCost(item), targetCount);
	}
}

async function autoTargetWorkflow(item, showDialog) {
    if (!item.actor || (!game.user.isGM && !game.settings.get(MODULE, 'allowPlayerAutoTarget'))) return;

    // If keybind is pressed, show dialog
    if (showDialog) {
        return await showAutoTargetDialog(item);
    } else return await AutoTarget.execute(item);
}

export const TARGET_TYPES = Object.freeze({
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

const RESOURCE_TYPES = Object.freeze({
    MP: {label: 'FU.MindPoints', key: 'mp', model: 'system.resources.mp.value'},
    IP: {label: 'FU.InventoryPoints', key: 'ip', model: 'system.resources.ip.value'},
    HP: {label: 'FU.HealthPoints', key: 'hp', model: 'system.resources.hp.value'},
    ZENIT: {label: 'FU.Zenit', key: 'zenit', model: 'system.resources.zenit.value'},
    FP: {label: 'FU.FabulaPoints', key: 'fp', model: 'system.resources.fp.value'},
});

const NPC_RESOURCE_TYPES = Object.freeze({
    MP: {label: 'FU.MindPoints', key: 'mp', model: 'system.resources.mp.value'},
    IP: {label: 'FU.InventoryPoints', key: 'ip', model: 'system.resources.ip.value'},
    HP: {label: 'FU.HealthPoints', key: 'hp', model: 'system.resources.hp.value'},
    ZENIT: {label: 'FU.Zenit', key: 'zenit', model: 'system.resources.zenit.value'},
    FP: {label: 'FU.UltimaPoints', key: 'fp', model: 'system.resources.fp.value'},
});

export const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];
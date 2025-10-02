import {MODULE} from './helpers/module-utils.mjs';
import {getResourceTypes} from './rolls.mjs';
import {ResourcePipeline, ResourceRequest} from '../../../../systems/projectfu/module/pipelines/resource-pipeline.mjs';
import {InlineSourceInfo} from '../../../../systems/projectfu/module/helpers/inline-helper.mjs';

export async function autoSpend(item, options, targetCount) {
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
            errorMessage = game.i18n.format(`${MODULE}.autoSpend.errors.notEnoughResources.skipHint`, {
                baseMessage: errorMessage,
                dialogKey: dialogBinding.key
            });
        }
        ui.notifications.warn(errorMessage);
        return Promise.reject(errorMessage);
    }
    const sourceInfo = InlineSourceInfo.fromInstance(item.actor, item);
    const resourceRequest = new ResourceRequest(sourceInfo, [item.actor], resourceType.key, finalCost);
    return ResourcePipeline.processLoss(resourceRequest);
}
import {MODULE} from './module-utils.mjs';
import {getDefaultCost, getResourceTypes, hasDefaultCost, TARGET_TYPES} from '../rolls.mjs';
import {TEMPLATES} from '../templates.mjs';
import {autoSpend} from '../autoSpend.mjs';
import {AutoTarget} from '../autoTarget.mjs';

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;
const { renderTemplate } = foundry.applications.handlebars;

export async function showAutoSpendDialog(item, targetCount) {

    const templateData = {
        item: item,
        resourceTypes: getResourceTypes(item.actor),
        hasDefaultCost: hasDefaultCost(item),
        //displayData: getItemDisplayData(item), // No longer exposed by the system
    };
    const dialogContent = await renderTemplate(TEMPLATES.AUTO_SPEND_DIALOG, templateData);

    const dialogBodyElement = document.createElement('div');
    dialogBodyElement.innerHTML = dialogContent;

    if (!hasDefaultCost(item)) {
        const enableCheckbox = dialogBodyElement.querySelector(`input[type="checkbox"][name="flags.${MODULE}.autoSpend.enable"]`);
        enableCheckbox.disabled = true;
        enableCheckbox.checked = true;
        // With this, the "enable" field will always be considered set to true.
        enableCheckbox.insertAdjacentHTML('afterend', `<input type="checkbox" name="flags.${MODULE}.autoSpend.enable" style="display: none" checked />`);

        const enableLabel = dialogBodyElement.querySelector(`label:has(input[name="flags.${MODULE}.autoSpend.enable"])`);
        enableLabel.setAttribute('data-tooltip', game.i18n.localize(`${MODULE}.autoSpend.options.enable.locked.enableDisableHint`));
    }

    return DialogV2.wait({
        id: 'auto-spend-dialog',
        rejectClose: true,
        closeOnSubmit: true,
        window: { title: game.i18n.localize(`${MODULE}.autoSpend.dialog.title`)},
        content: dialogBodyElement,
        buttons: [
            {
                action: 'spend',
                icon: 'fas fa-scale-balanced',
                label: `${MODULE}.autoSpend.dialog.buttons.spend`,
                callback: (_event, _button, dialog) => {
                    const formInput = getFormInput(dialog.element);
                    const defaultCost = getDefaultCost(item);
                    const autoSpendOptions = (defaultCost && !formInput.flags[MODULE].autoSpend.enable) ?
                        defaultCost :
                        formInput.flags[MODULE].autoSpend;
                    return autoSpend(item, autoSpendOptions, targetCount).catch((reason) => {
                        dialog.close();
                        return Promise.reject(reason);
                    });
                }

            },
            {
                action: 'updateAndSpend',
                icon: 'fas fa-floppy-disk',
                label: `${MODULE}.autoSpend.dialog.buttons.updateAndSpend`,
                callback: async (_event, _button, dialog) => {
                    const formInput = getFormInput(dialog.element);
                    await item.update(formInput);
                    const defaultCost = getDefaultCost(item);
                    const autoSpendOptions = (defaultCost && !formInput.flags[MODULE].autoSpend.enable) ?
                        defaultCost :
                        formInput.flags[MODULE].autoSpend;
                    return autoSpend(item, autoSpendOptions, targetCount).catch((reason) => {
                        dialog.close();
                        return Promise.reject(reason);
                    });
                }
            },
            {
                action: 'skip',
                icon: 'fas fa-forward',
                label: `${MODULE}.autoSpend.dialog.buttons.skip`,
            },
            {
                action: 'disable',
                icon: 'fas fa-ban',
                label: `${MODULE}.autoSpend.dialog.buttons.disable`,
                callback: () => {
                    if (hasDefaultCost(item)) {
                        return item.update({[`flags.${MODULE}.autoSpend`]: {enable: true, 'cost': 0}});
                    } else {
                        return item.setFlag(MODULE, 'autoSpend.enable', false);
                    }
                }
            },
        ],
        close: () => {
            console.log(`${MODULE} | closing auto-spend dialog`);
        }

    });
}

export async function showAutoTargetDialog(item) {
    const templateData = {
        item: item,
        targetTypes: TARGET_TYPES,
        // displayData: getItemDisplayData(item), // No longer exposed by the system
        hasDefaultTargetStrategy: AutoTarget.hasDefaultStrategyFor(item)
    };
    const dialogContent = await renderTemplate(TEMPLATES.AUTO_TARGET_DIALOG, templateData);
    const dialogBodyElement = document.createElement('div');
    dialogBodyElement.innerHTML = dialogContent;

    const enableCheckbox = dialogBodyElement.querySelector(`input[type="checkbox"][name="flags.${MODULE}.autoTarget.enable"]`);
    enableCheckbox.disabled = true;
    // With this, the "enable" field will always be considered set to true.
    enableCheckbox.insertAdjacentHTML('afterend', `<input type="checkbox" name="flags.${MODULE}.autoTarget.enable" style="display: none" checked />`);

    const enableLabel = dialogBodyElement.querySelector(`label:has(input[name="flags.${MODULE}.autoTarget.enable"])`);
    enableLabel.setAttribute('data-tooltip', game.i18n.localize(`${MODULE}.autoTarget.options.enable.locked.enableDisableHint`));

    return DialogV2.wait({

        id: 'auto-target-dialog',
        rejectClose: true,
        closeOnSubmit: true,
        window: {title: game.i18n.localize(`${MODULE}.autoTarget.dialog.title`)},
        content: dialogBodyElement,
        buttons: [
            {
                action: 'target',
                icon: 'fas fa-crosshairs',
                label: `${MODULE}.autoTarget.dialog.buttons.target`,
                callback: (_event, _button, dialog) => {
                    const formInput = getFormInput(dialog.element);
                    return AutoTarget.execute(item, formInput.flags[MODULE].autoTarget);
                }
            },
            {
                action: 'updateAndTarget',
                icon: 'fas fa-floppy-disk',
                label: `${MODULE}.autoTarget.dialog.buttons.updateAndTarget`,
                callback: async (_event, _button, dialog) => {
                    const formInput = getFormInput(dialog.element);
                    const autoTargetOptions = formInput.flags[MODULE].autoTarget;
                    const updateData = foundry.utils.mergeObject(
                        formInput,
                        foundry.utils.expandObject({[`flags.${MODULE}.autoTarget.enable`]: true})
                    );
                    await item.update(updateData);
                    return AutoTarget.execute(item, autoTargetOptions);
                }
            },
            {
                action: 'skip',
                icon: 'fas fa-forward',
                label: `${MODULE}.autoTarget.dialog.buttons.skip`,
            },
            {
                action: 'disable',
                icon: 'fas fa-ban',
                label: `${MODULE}.autoTarget.dialog.buttons.disable`,
                callback: () => {
                    if (AutoTarget.hasDefaultStrategyFor(item)) {
                        return item.update({
                            [`flags.${MODULE}.autoTarget`]: {
                                enable: true,
                                targetType: null,
                                'maxTargets': null
                            }
                        });
                    } else {
                        return item.setFlag(MODULE, 'autoSpend.enable', false);
                    }
                }
            }
        ],
        close: () => {
            console.log(`${MODULE} | closing auto-target dialog`);
        },
    });
}

export function getFormInput(element) {
    const formElement = element.querySelector('form');
    const formData = new FormDataExtended(formElement);
    return foundry.utils.expandObject(formData.object);
}
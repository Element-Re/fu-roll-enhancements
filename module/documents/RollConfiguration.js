import { MODULE } from '../helpers/module-utils.mjs';
import { getResourceTypes, hasDefaultCost, TARGET_TYPES } from '../rolls.mjs';
import { AutoTarget } from '../autoTarget.mjs';
import { TEMPLATES } from '../templates.mjs';

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { mergeObject } = foundry.utils;

export class RollConfiguration extends HandlebarsApplicationMixin(DocumentSheetV2) {

    static DEFAULT_OPTIONS = mergeObject(DocumentSheetV2.DEFAULT_OPTIONS, {
        id: 'roll-configuration',
        classes: ['roll-enhancements', 'roll-configuration'],
        form: {
            submitOnChange: true,
        },
    }, {
        inplace: false,
        overwrite: true,
    }) ;

    /** @type {Record<string, HandlebarsTemplatePart>} */
    static PARTS = {
        main: { template: TEMPLATES.ROLL_CONFIGURATION },
    };

    /** @inheritdoc */
    async _preparePartContext(partId, ctx, options) {
        const context = await super._preparePartContext(partId, ctx, options);

        mergeObject(context, {
            item: this.document,
            showAutoTarget: game.user.isGM || game.settings.get(MODULE, 'allowPlayerAutoTarget'),
            showAutoSpend: game.settings.get(MODULE, 'enableAutoSpend'),
            targetTypes: TARGET_TYPES,
            hasDefaultCost: hasDefaultCost(this.document),
            hasDefaultTargetStrategy: AutoTarget.hasDefaultStrategyFor(this.document),
            resourceTypes: getResourceTypes(this.document.actor),
        });

        return context;
    }
}

export function getHeaderControlsItemSheetV2(app, controls) {
    if (app instanceof ItemSheetV2) {
        controls.unshift({
            label: game.i18n.localize(`${MODULE}.rollAutomation.configure.label`),
            class: `${MODULE}-button`,
            icon: 'fas fa-dice',
            onClick: (event) => {
                console.log('Button pressed in itemSheet');
                new RollConfiguration({document: app.item}).render(true);
                event.preventDefault();
            }
        });
    }
}
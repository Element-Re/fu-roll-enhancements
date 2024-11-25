import { getResourceTypes, TARGET_TYPES } from './rolls.mjs';
import { MODULE } from './settings.mjs';

export const renderItemSheetHandler = async (item, $content) => {
    const templateData = {
      item: item.object,
      showAutoTarget: game.user.isGM || game.settings.get(MODULE, "allowPlayerAutoTarget"),
      showAutoSpend: game.settings.get(MODULE, "enableAutoSpend"),
      targetTypes: TARGET_TYPES,
      hasDefaultCost: hasDefaultCost(item.object),
      resourceTypes: getResourceTypes(item.actor)
    };
    const itemExtensionContent = await renderTemplate(TEMPLATES.ITEM_EXTENSION, templateData);
    const nav = $content.find("nav#item-navbar");
    nav.append('<a class="item rollable tab button-style" data-tab="rolls"><i class="fas fa-dice"></i></a>');
    const sheetBody = $content.find("section.sheet-body");
    sheetBody.append('<div class="tab rolls" data-group="primary" data-tab="rolls"></div>')
      .find('.tab.rolls').append(itemExtensionContent);
}

export const initializeTemplates = () => {
  loadTemplates([
    TEMPLATES.AUTO_TARGET_FIELDSET,
    TEMPLATES.AUTO_TARGET_DIALOG,
    TEMPLATES.AUTO_SPEND_FIELDSET,
    TEMPLATES.AUTO_SPEND_DIALOG,
    TEMPLATES.ITEM_EXTENSION,
    TEMPLATES.ITEM_DIALOG,
    TEMPLATES.AUTO_TARGET_RESULTS,
    TEMPLATES.SIMPLE_CHAT_MESSAGE
  ]);
}

export const TEMPLATES = Object.freeze({
  AUTO_TARGET_FIELDSET: "modules/fu-roll-enhancements/templates/auto-target-fieldset.hbs",
  AUTO_TARGET_DIALOG: "modules/fu-roll-enhancements/templates/auto-target-dialog.hbs",
  AUTO_SPEND_FIELDSET: "modules/fu-roll-enhancements/templates/auto-spend-fieldset.hbs",
  AUTO_SPEND_DIALOG: "modules/fu-roll-enhancements/templates/auto-spend-dialog.hbs",
  ITEM_EXTENSION: "modules/fu-roll-enhancements/templates/item-extension.hbs",
  ITEM_DIALOG: "modules/fu-roll-enhancements/templates/item-dialog.hbs",
  AUTO_TARGET_RESULTS: "modules/fu-roll-enhancements/templates/auto-target-results.hbs",
  SIMPLE_CHAT_MESSAGE: "modules/fu-roll-enhancements/templates/simple-chat-message.hbs",
});

const _hasDefaultCostTypes = ['spell', 'ritual', 'consumable'];

export function hasDefaultCost(item) { 
  return item && _hasDefaultCostTypes.includes(item.type); 
}
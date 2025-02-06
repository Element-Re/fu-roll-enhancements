import { getResourceTypes, TARGET_TYPES } from './rolls.mjs';
import { AutoTarget } from './autoTarget.mjs';
import { MODULE } from './settings.mjs';

export const renderItemSheetHandler = async (itemSheet, $content) => {
    // Render module-specific item form fields
    const templateData = {
      item: itemSheet.object,
      showAutoTarget: game.user.isGM || game.settings.get(MODULE, 'allowPlayerAutoTarget'),
      showAutoSpend: game.settings.get(MODULE, 'enableAutoSpend'),
      targetTypes: TARGET_TYPES,
      hasDefaultCost: hasDefaultCost(itemSheet.object),
      hasDefaultTargetStrategy: AutoTarget.hasDefaultStrategyFor(itemSheet.object),
      resourceTypes: getResourceTypes(itemSheet.actor)
    };
    const itemExtensionContent = await renderTemplate(TEMPLATES.ITEM_EXTENSION, templateData);
    // Add tabs to item sheet
    const nav = $content.find('nav#item-navbar');
    nav.append('<a class="item rollable tab button-style" data-tab="rolls"><i class="fas fa-dice"></i></a>');
    const sheetBody = $content.find('section.sheet-body');
    sheetBody.append('<div class="tab rolls" data-group="primary" data-tab="rolls"></div>');
    sheetBody.find('.tab.rolls').append(itemExtensionContent);
    // Check if last recorded tab change was our "rolls" tab, and activate it if so.
    if(itemSheet.lastTab === 'rolls') {
      itemSheet._tabs[0].activate('rolls');
    }
    // Record tab changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if(mutation.type === 'attributes' && mutation.attributeName ==='class') {
          if(mutation.target.classList.contains('active')) {
            itemSheet.lastTab = mutation.target.dataset['tab'];
            break;
          };
        }
      }
    });
    const config = {
      attributes: true,
      attributeFilter: ['class'],
      subtree: false,
      childList: false
    };
    nav.find('a.tab[data-tab]').each((_, a) => observer.observe(a, config));
};

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
};

export const TEMPLATES = Object.freeze({
  AUTO_TARGET_FIELDSET: 'modules/fu-roll-enhancements/templates/auto-target-fieldset.hbs',
  AUTO_TARGET_DIALOG: 'modules/fu-roll-enhancements/templates/auto-target-dialog.hbs',
  AUTO_SPEND_FIELDSET: 'modules/fu-roll-enhancements/templates/auto-spend-fieldset.hbs',
  AUTO_SPEND_DIALOG: 'modules/fu-roll-enhancements/templates/auto-spend-dialog.hbs',
  ITEM_EXTENSION: 'modules/fu-roll-enhancements/templates/item-extension.hbs',
  ITEM_DIALOG: 'modules/fu-roll-enhancements/templates/item-dialog.hbs',
  AUTO_TARGET_RESULTS: 'modules/fu-roll-enhancements/templates/auto-target-results.hbs',
  SIMPLE_CHAT_MESSAGE: 'modules/fu-roll-enhancements/templates/simple-chat-message.hbs',
});

export function hasDefaultCost(item) { 
  return item && typeof item.system.mpCost?.value === 'number' ||  typeof item.system.ipCost?.value === 'number' ||  typeof item.system.cost?.amount === 'number'; 
}
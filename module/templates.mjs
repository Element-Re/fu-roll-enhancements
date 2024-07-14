import { TARGET_TYPES } from './rolls.mjs';
import { MODULE } from './settings.mjs';

export const renderItemSheetHandler = async (item, $content) => {
  if (!game.user.isGM && !game.settings.get(MODULE, "allowPlayerAutoTarget")) return;

    const templateData = {
      item: item.object,
      targetTypes: TARGET_TYPES,
    };
    const itemExtensionContent = await renderTemplate(TEMPLATES.ITEM_EXTENSION, templateData);
    const attributesTab = $content.find(".tab.attributes[data-tab=attributes]").first();
    if(!attributesTab.length) return;
    if (attributesTab.find("section.grid").length) {
      attributesTab.find("section.grid").last().append(itemExtensionContent);
    } else
      attributesTab.append($(`<section class="grid grid-2col gap-5"></section>`).append(itemExtensionContent));
}

export const initializeTemplates = () => {
  loadTemplates([
		TEMPLATES.AUTO_TARGET_DIALOG,
    TEMPLATES.AUTO_SPEND_DIALOG,
		TEMPLATES.ITEM_EXTENSION,
    TEMPLATES.AUTO_TARGET_RESULTS,
    TEMPLATES.SIMPLE_CHAT_MESSAGE
	]);
}

export const TEMPLATES = Object.freeze({
  AUTO_TARGET_DIALOG: "modules/fu-roll-enhancements/templates/auto-target-dialog.hbs",
  AUTO_SPEND_DIALOG: "modules/fu-roll-enhancements/templates/auto-spend-dialog.hbs",
  ITEM_EXTENSION: "modules/fu-roll-enhancements/templates/item-extension.hbs",
  AUTO_TARGET_RESULTS: "modules/fu-roll-enhancements/templates/auto-target-results.hbs",
  SIMPLE_CHAT_MESSAGE: "modules/fu-roll-enhancements/templates/simple-chat-message.hbs",
});



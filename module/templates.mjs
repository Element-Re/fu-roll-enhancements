import { TARGET_SIDES } from './rolls.mjs';

export const renderItemSheetHandler = async (item, $content) => {
  if (!game.user.isGM) return;
    const templateData = {
      item: item.object,
      targetSides: TARGET_SIDES,
    };
    const itemExtensionContent = await renderTemplate("modules/fu-roll-enhancements/templates/auto-target-item-extension.hbs", templateData);
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
		TEMPLATES.AUTO_TARGET_ITEM_EXTENSION,
    TEMPLATES.AUTO_TARGET_RESULTS
	]);
}

export const TEMPLATES = Object.freeze({
  AUTO_TARGET_DIALOG: "modules/fu-roll-enhancements/templates/auto-target-dialog.hbs",
  AUTO_TARGET_ITEM_EXTENSION: "modules/fu-roll-enhancements/templates/auto-target-item-extension.hbs",
  AUTO_TARGET_RESULTS: "modules/fu-roll-enhancements/templates/auto-target-results.hbs",
});



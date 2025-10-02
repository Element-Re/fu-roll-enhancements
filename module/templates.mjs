import {MODULE} from './helpers/module-utils.mjs';

export const initializeTemplates = () => {
  return foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES));
};

export const TEMPLATES = Object.freeze({
  AUTO_TARGET_FIELDSET: `modules/${MODULE}/templates/auto-target-fieldset.hbs`,
  AUTO_TARGET_DIALOG: `modules/${MODULE}/templates/auto-target-dialog.hbs`,
  AUTO_SPEND_FIELDSET: `modules/${MODULE}/templates/auto-spend-fieldset.hbs`,
  AUTO_SPEND_DIALOG: `modules/${MODULE}/templates/auto-spend-dialog.hbs`,
  ITEM_DIALOG: `modules/${MODULE}/templates/item-dialog.hbs`,
  AUTO_TARGET_RESULTS: `modules/${MODULE}/templates/auto-target-results.hbs`,
  SIMPLE_CHAT_MESSAGE: `modules/${MODULE}/templates/simple-chat-message.hbs`,
  ROLL_CONFIGURATION: `modules/${MODULE}/templates/roll-configuration.hbs`,
});
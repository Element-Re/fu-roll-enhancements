import {_renderChatMessageHandler} from './helpers/ui.mjs';
import {_getHeaderControlsItemSheetV2} from './documents/RollConfiguration.js';
import {_activeEffectHandler} from './autoTarget/autoTarget.mjs';

export function registerHooks() {
    Hooks.on('renderChatMessageHTML', _renderChatMessageHandler);
    Hooks.on('getHeaderControlsItemSheetV2', _getHeaderControlsItemSheetV2);
    Hooks.on('applyActiveEffect', _activeEffectHandler);
}


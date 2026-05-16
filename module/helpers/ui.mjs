import {MODULE} from './utils.mjs';

export function _pingTokenClickAction(event) {
    const tokenId = event.target.dataset.tokenId;
    const token = game.canvas.tokens.get(tokenId);
    if (token) canvas.ping(token.center);
}

/**
 * @param message {ChatMessage}
 * @param html {HTMLElement}
 * @returns {Promise<void>}
 * @private
 */
export async function _renderChatMessageHandler(message, html) {
    if (message.getFlag(MODULE, 'context.type') === 'auto-target-results') {
        html.querySelectorAll('[data-action="pingToken"]').forEach(
            e => e.addEventListener('click', _pingTokenClickAction)
        );
    }
}
import {MODULE} from './utils.mjs';

export function _pingTokenClickAction(event) {
    const owner = event.target.closest('[data-token-id]');
    const tokenId = owner.dataset.tokenId;
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
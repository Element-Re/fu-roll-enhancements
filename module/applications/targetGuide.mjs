import {TEMPLATES} from '../templates.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TargetGuide extends HandlebarsApplicationMixin(ApplicationV2) {


    targetContext;

    constructor(targetContext) {
        super();
        this.targetContext = targetContext;
    }

    _prepareContext() {
        return {
            initialTargets: this.targetContext.recommendedTargets,
            validTargets: {
                enemies: this.targetContext.enemyTargets,
                allies: this.targetContext.allyTargets,
                self: this.targetContext.rollerTargets
            },
            maxTargets: this.targetContext.maxTargets
        };
    }

    _onRender(_context, _options) {
        const targetEntries = this.element.querySelectorAll('.target[data-token-id]');
        for (const targetEntry of targetEntries) {
            targetEntry.addEventListener('mouseenter', TargetGuide._onTargetHoverIn);
            targetEntry.addEventListener('mouseleave', TargetGuide._onTargetHoverOut);
        }
    }

    static DEFAULT_OPTIONS = {
        actions: {
            updateTarget: TargetGuide._updateTarget
        },
        classes: ['target-guide'],
    };

    static PARTS = {
        main: {
            template: TEMPLATES.GUIDED_TARGET_DIALOG
        }
    };

    static _updateTarget(event, target) {}

    /**
     * @param event Event
     * @private
     */
    static _onTargetHoverIn(event) {
        const tokenId = event.target.dataset.tokenId;
        const token = game.canvas.tokens.placeables.find(t => t.id === tokenId);
        if ( token && token._canHover(game.user, event) && token.visible ) {
            token._onHoverIn(event, {hoverOutOthers: true});
        }
    }

    /**
     * @param event Event
     * @private
     */
    static _onTargetHoverOut(event) {
        const tokenId = event.target.dataset.tokenId;
        const token = game.canvas.tokens.placeables.find(t => t.id === tokenId);
        if ( token && token._canHover(game.user, event) && token.visible ) {
            token._onHoverOut(event);
        }
    }

}
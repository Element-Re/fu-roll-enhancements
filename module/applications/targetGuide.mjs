import {MODULE} from '../helpers/utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TargetGuide extends HandlebarsApplicationMixin(ApplicationV2) {

    targetContext;
    resolve;
    reject;

    complete = false;

    pendingTargets;

    static DEFAULT_OPTIONS = {
        actions: {
            updateTarget: TargetGuide._updateTarget,
            recommendedTargets: TargetGuide._recommendedTargets,
            finalizeTargets: TargetGuide._finalizeTargets,
            skip: TargetGuide._skip
        },
        classes: ['target-guide']
    };

    static PARTS = {
        pendingTargets: {
            template: `modules/${MODULE}/templates/applications/target-guide/pending-targets_part.hbs`
        },
        targetPool: {
            template: `modules/${MODULE}/templates/applications/target-guide/target-pool_part.hbs`
        },
        targetLegend: {
            template: `modules/${MODULE}/templates/applications/target-guide/target-legend_part.hbs`
        },
        footer: {
            template: `modules/${MODULE}/templates/applications/target-guide/footer_part.hbs`
        }
    };

    constructor(targetContext, callbacks) {
        super();
        this.targetContext = targetContext;
        this.resolve = callbacks.resolve;
        this.reject = callbacks.reject;
    }

    async _prepareContext() {

        await Promise.all(this.targetContext.targets.values().map(target => target.init()));
        if (!this.pendingTargets) {
            this.pendingTargets = new Map([...this.targetContext.recommendedTargets].map(t => ([t.id, t.toPendingTarget()])));
        }

        return {
            pendingTargets: this.pendingTargets.values(),
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

    _onClose(options) {
        if (!this.complete) {
            this.complete = true;
            this.reject('Guided Targeting step was cancelled.');
        }

        return super._onClose(options);
    }

    static async wait(targetContext) {

        return new Promise((resolve, reject) => {

            const app = new this(targetContext, {
                resolve,
                reject
            });

            app.render(true);
        });
    }

    /**
     * @this {TargetGuide}
     */
    static _updateTarget(event, target) {

        const id = target.dataset.tokenId;
        const update = target.dataset.update;
        if (!id) return;

        if (update === 'increment') {
            const pendingTarget = this.pendingTargets.get(id);
            if (!pendingTarget) {
                const target = this.targetContext.targets.get(id);
                this.pendingTargets.set(id, target.toPendingTarget(1) );
            } else {
                pendingTarget.count++;
            }
        } else if (update === 'decrement') {
            const pendingTarget = this.pendingTargets.get(id);
            if (!pendingTarget) return;
            pendingTarget.count--;
            if (pendingTarget.count <= 0) {
                this.pendingTargets.delete(id);
            }
        }

        this.render({parts: ['pendingTargets']});
    }

    /**
     * @this {TargetGuide}
     */
    static _recommendedTargets(event, target) {

        if (!this.complete) {
            this.complete = true;

            this.close().then(() => { this.resolve(); });
        }
    }

    /**
     * @this {TargetGuide}
     */
    static _finalizeTargets(event, target) {
        if (!this.complete) {
            this.complete = true;
            const finalTargets = this.pendingTargets.values().map(target => {
                const data = target.data;
                data.finalSelectionCount = target.count;
                return data;
            });
            this.close().then(() => this.resolve(finalTargets) );
        }
    }

    /**
     * @this {TargetGuide}
     */
    static _skip(event, target) {
        if (!this.complete) {
            this.complete = true;
            this.close().then(() => { this.resolve(); });
        }
    }

    /** @override */
    _configureRenderOptions(options) {
        super._configureRenderOptions(options);
        options.window = {title: game.i18n.localize(`${MODULE}.targetGuide.title`)};
    }

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
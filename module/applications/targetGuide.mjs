import {MODULE} from '../helpers/utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TargetGuide extends HandlebarsApplicationMixin(ApplicationV2) {

    targetContext;
    resolve;
    reject;

    complete = false;

    pendingTargets;
    settings = {
        repeatTargets: false,
    };

    handlers = {
        targetHoverIn: TargetGuide._onTargetHoverIn.bind(this),
        targetHoverOut: TargetGuide._onTargetHoverOut.bind(this),
        settingsCheckboxChange: TargetGuide._onSettingsCheckboxChange.bind(this)
    };

    static DEFAULT_OPTIONS = {
        actions: {
            updateTarget: TargetGuide._updateTarget,
            resetTargets: TargetGuide._resetTargets,
            recommendedTargets: TargetGuide._recommendedTargets,
            finalizeTargets: TargetGuide._finalizeTargets,
            skip: TargetGuide._skip
        },
        classes: ['target-guide']
    };

    static PARTS = {
        header: {
            template: `modules/${MODULE}/templates/applications/target-guide/header_part.hbs`
        },
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

    /**
     * @override
     */
    constructor(targetContext, callbacks) {
        super();
        this.targetContext = targetContext;
        this.settings.repeatTargets = targetContext.canRepeatTargets;
        this.resolve = callbacks.resolve;
        this.reject = callbacks.reject;
    }

    /**
     * @override
     */
    async _prepareContext() {

        await Promise.all(this.targetContext.targets.values().map(target => target.init()));
        if (!this.pendingTargets) {
            this.pendingTargets = this._generatePendingTargets();
        }

        return {
            item: this.targetContext.item,
            pendingTargets: this.pendingTargets.values(),
            validTargets: {
                enemies: this.targetContext.enemyTargets,
                allies: this.targetContext.allyTargets,
                self: this.targetContext.rollerTargets
            },
            pendingTargetCount: this.pendingTargetCount,
            recommendedMaxTargets: this.targetContext.recommendedMaxTargets,
            repeatTargets: this.settings.repeatTargets
        };
    }

    get pendingTargetCount() {
        return this.pendingTargets.values().reduce((total, target) => { return total + target.count; }, 0);
    }

    /**
     * @override
     */
    _onRender(_context, _options) {
        const targetEntries = this.element.querySelectorAll('.target[data-token-id]');
        for (const targetEntry of targetEntries) {
            targetEntry.addEventListener('mouseenter', this.handlers.targetHoverIn);
            targetEntry.addEventListener('mouseleave', this.handlers.targetHoverOut);
        }
        const repeatTargetsField = this.element.querySelector('header .settings input[name="repeatTargets"]');
        if (repeatTargetsField) {
            repeatTargetsField.addEventListener('change', this.handlers.settingsCheckboxChange);
        }
    }

    /**
     * @override
     */
    _onClose(options) {
        if (!this.complete) {
            this.complete = true;
            this.reject('Guided Targeting step was cancelled.');
        }

        return super._onClose(options);
    }

    /**
     * @private
     */
    _generatePendingTargets() {
        return new Map([...this.targetContext.recommendedTargets].map(t => ([t.id, t.toPendingTarget()])));
    }

    /**
     * @param targetContext TargetContext
     * @returns {Promise<unknown>}
     */
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
            } else if (this.settings.repeatTargets) {
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
    static _resetTargets(_event, _target) {
        this.pendingTargets = this._generatePendingTargets();

        this.render({parts: ['pendingTargets']});
    }

    /**
     * @this {TargetGuide}
     */
    static _recommendedTargets(_event, _target) {

        if (!this.complete) {
            this.complete = true;

            this.close().then(() => { this.resolve(this.targetContext.recommendedTargets.values()); });
        }
    }

    /**
     * @this {TargetGuide}
     */
    static _finalizeTargets(_event, _target) {
        if (!this.complete) {
            this.complete = true;

            const finalTargets = this.pendingTargets.values().map(target => {
                const data = target.data;
                data.count = target.count;
                data.setUserModified();
                return data;
            });

            const finalTargetIds = new Set(finalTargets.map(target => target.id));

            this.targetContext.recommendedTargets
                .filter(t => !finalTargetIds.has(t.id))
                .forEach(t => t.setUserModified());

            this.targetContext.clearLabel();
            this.close().then(() => this.resolve(finalTargets) );
        }
    }

    /**
     * @this {TargetGuide}
     */
    static _skip(_event, _target) {
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
     * @private
     */
    _onUpdateSetting() {
        if (!this.settings.repeatTargets) {
            this.pendingTargets.forEach(target => target.count = target.count > 1 ? 1 : target.count);
        }
        this.render({parts: ['pendingTargets', 'targetPool']});
    }

    /**
     * @param event Event
     * @private
     * @this TargetGuide
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
     * @this TargetGuide
     */
    static _onTargetHoverOut(event) {
        const tokenId = event.target.dataset.tokenId;
        const token = game.canvas.tokens.placeables.find(t => t.id === tokenId);
        if ( token && token._canHover(game.user, event) && token.visible ) {
            token._onHoverOut(event);
        }
    }

    /**
     * @param event Event
     * @private
     * @this TargetGuide
     */
    static _onSettingsCheckboxChange(event) {
        const checkbox = event.target;
        if(checkbox) {
            this.settings[checkbox.name] = event.target.checked;
        }
        this._onUpdateSetting();
    }

}
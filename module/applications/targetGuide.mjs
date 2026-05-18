import {MODULE} from '../helpers/utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TargetGuide extends HandlebarsApplicationMixin(ApplicationV2) {

    targetContext;
    resolve;
    reject;

    complete = false;

    pendingTargets;
    settings = {
        maxTargets: 0,
        sortTargetPoolByTier: game.settings.get(MODULE, 'sortTargetPoolByTier'),
        repeatTargets: false,
    };

    handlers = {
        targetHoverIn: TargetGuide._onTargetHoverIn.bind(this),
        targetHoverOut: TargetGuide._onTargetHoverOut.bind(this),
        optionsInputChange: TargetGuide._onOptionsInputChange.bind(this)
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
        this.settings.maxTargets = targetContext.recommendedMaxTargets;
        this.settings.repeatTargets = targetContext.canRepeatTargets;
        this.resolve = callbacks.resolve;
        this.reject = callbacks.reject;
    }

    /**
     * @override
     */
    async _prepareContext() {

        await Promise.all(this.targetContext.allTargets.map(target => target.init()));
        if (!this.pendingTargets) {
            this.pendingTargets = this._generatePendingTargets();
        }

        const targetOptions = {
            sortByTier: this.settings.sortTargetPoolByTier,
            unique: !this.settings.repeatTargets
        };

        return {
            item: this.targetContext.item,
            pendingTargets: Object.fromEntries(this.pendingTargets),
            validTargets: {
                enemies: this.targetContext.getEnemyTargets(targetOptions),
                allies: this.targetContext.getAllyTargets(targetOptions),
                self: this.targetContext.getRollerTargets(targetOptions),
            },
            pendingTargetCount: this.pendingTargets.size,
            maxTargets: this.settings.maxTargets,
            sortTargetPoolByTier: this.settings.sortTargetPoolByTier,
            repeatTargets: this.settings.repeatTargets,
        };
    }

    get pendingTargetCount() {
        return this.pendingTargets.length;
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

        this.element.querySelectorAll('header .options input')
            .forEach(checkbox => {
                checkbox.addEventListener('change', this.handlers.optionsInputChange);
            });
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
        return new Map([...this.targetContext.recommendedTargets].map(t => [t.uid, t]));
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

        const update = target.dataset.update;
        const uid = target.dataset.uid;

        if (update === 'insert') {

            const pendingTarget = this.targetContext.getTargetUIDMap().get(uid);
            this.pendingTargets.set(uid, pendingTarget);

        } else if (update === 'delete') {
            this.pendingTargets.delete(uid);
        }

        this.render({parts: ['pendingTargets', 'targetPool']});
    }

    /**
     * @this {TargetGuide}
     */
    static _resetTargets(_event, _target) {
        this.pendingTargets = this._generatePendingTargets();

        this.render({parts: ['pendingTargets', 'targetPool']});
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

            const finalTargets = [...this.pendingTargets.values()];

            for (const target of finalTargets) {
                target.setUserSelected();
            }

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
    _onUpdateSetting(setting) {
        if (setting === 'maxTargets') {
            if (this.settings.repeatTargets) {
                this.targetContext.extendTargetPool(this.settings.maxTargets);
            }
        } else if (setting === 'repeatTargets') {
            if (this.settings.repeatTargets) {
                this.targetContext.extendTargetPool(this.settings.maxTargets);
            } else if (setting === this.settings.maxTargets) {
                const found = new Set();

                for (const pendingTarget of this.pendingTargets.values()) {
                    if(!found.has(pendingTarget.id)) {
                        found.add(pendingTarget.id);
                    } else {
                        this.pendingTargets.delete(pendingTarget.uid);
                    }
                }
            }
        } else if (setting === 'sortTargetPoolByTier') {
            game.settings.set(MODULE, setting, this.settings.sortTargetPoolByTier);
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
    static _onOptionsInputChange(event) {
        const input = event.target;
        if(input.type === 'checkbox') {
            this.settings[input.name] = event.target.checked;
        } else if (input.type === 'number') {
            this.settings[input.name] = event.target.valueAsNumber;
        } else {
            this.settings[input.name] = event.target.value;
        }
        this._onUpdateSetting(input.name);
    }

}
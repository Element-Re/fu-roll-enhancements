import {MODULE} from '../helpers/utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TargetGuide extends HandlebarsApplicationMixin(ApplicationV2) {

    targetContext;
    resolve;
    reject;

    complete = false;

    pendingTargets;
    pendingOrder;
    settings = {
        maxTargets: 0,
        sortTargetPoolByTier: false,
        repeatTargets: false,
    };

    handlers = {
        targetHoverIn: TargetGuide._onTargetHoverIn.bind(this),
        targetHoverOut: TargetGuide._onTargetHoverOut.bind(this),
        optionsInputChange: TargetGuide._onOptionsInputChange.bind(this),
        targetDragStart: TargetGuide._onTargetDragStart.bind(this),
        pendingTargetDrop: TargetGuide._onPendingTargetDrop.bind(this),
        poolTargetDrop: TargetGuide._onPoolTargetDrop.bind(this),
        targetDragOver: TargetGuide._onTargetDragOver.bind(this),
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
            this.pendingOrder = [...this.pendingTargets.keys()];
        }

        const targetOptions = {
            sortByTier: this.settings.sortTargetPoolByTier,
            unique: !this.settings.repeatTargets
        };

        return {
            item: this.targetContext.item,
            pendingTargets: Object.fromEntries(this.pendingOrder.map(uid => [uid, this.pendingTargets.get(uid)])),
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

    get orderedPendingTargets() {
        return this.pendingOrder.map(uid => this.pendingTargets.get(uid));
    }

    /**
     * @param id {string}  The id of the target entry to add.
     * @param index {number | null} The optional index at which to insert the new target in the Pending Targets list.
     */
    addPendingTarget(id, index= null) {
        const target = this.targetContext.getTargetDataIDMap().get(id);
        this.pendingTargets.set(id, target);
        if (typeof index === 'number' && index >= 0) {
            this.pendingOrder.splice(index, 0, id);
        } else this.pendingOrder.push(id);
    }

    /**
     * @param id {string}
     * @returns {number} The index that the deleted target previously held in the Pending Targets list.
     */
    deletePendingTarget(id) {
        this.pendingTargets.delete(id);
        const pendingTargetIndex = this.pendingOrder.indexOf(id);
        this.pendingOrder.splice(pendingTargetIndex, 1);
        return pendingTargetIndex;
    }

    /**
     * @override
     */
    _onRender(_context, _options) {
        const targetEntries = this.element.querySelectorAll('.target[data-id]');
        for (const targetEntry of targetEntries) {
            targetEntry.addEventListener('mouseenter', this.handlers.targetHoverIn);
            targetEntry.addEventListener('mouseleave', this.handlers.targetHoverOut);
        }
        const pendingTargetEntries = this.element.querySelectorAll('.pending-targets .target[draggable]');
        for (const targetEntry of pendingTargetEntries) {
            targetEntry.addEventListener('dragstart', this.handlers.targetDragStart);
            targetEntry.addEventListener('dragover', this.handlers.targetDragOver);
            targetEntry.addEventListener('drop', this.handlers.pendingTargetDrop);
        }

        const poolTargetEntries = this.element.querySelectorAll('.target-pool .target[draggable]');
        for (const targetEntry of poolTargetEntries) {
            targetEntry.addEventListener('dragstart', this.handlers.targetDragStart);
            targetEntry.addEventListener('dragover', this.handlers.targetDragOver);
            targetEntry.addEventListener('drop', this.handlers.poolTargetDrop);
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
        return new Map([...this.targetContext.recommendedTargets].map(t => [t.id, t]));
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
                        this.pendingTargets.delete(pendingTarget.id);
                    }
                }
            }
        }
        this.render({parts: ['pendingTargets', 'targetPool']});
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
     * @this {TargetGuide}
     */
    static _updateTarget(event, target) {

        const sourceCollection = target.dataset.collection;
        const id = target.dataset.id;

        if (sourceCollection === 'targetPool') {
            this.addPendingTarget(id);
        } else if (sourceCollection === 'pendingTargets') {
            this.deletePendingTarget(id);
        }

        this.render({parts: ['pendingTargets', 'targetPool']});
    }

    /**
     * @param event Event
     * @private
     * @this TargetGuide
     */
    static _onTargetDragStart(event) {
        const data = {
            id: event.target.dataset.id,
            collection: event.target.dataset.collection
        };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(data));
    }


    /**
     * @param event Event
     * @private
     * @this TargetGuide
     */
    static _onPendingTargetDrop(event) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        const sourceCollection = data.collection;
        const replaceID = event.target.dataset.id;
        const newIndex = Number(this.pendingOrder.indexOf(replaceID));

        if (sourceCollection === 'pendingTargets') {
            const oldIndex = this.pendingOrder.indexOf(data.id);
            if(oldIndex !== newIndex) {
                this.pendingOrder.splice(oldIndex, 1);
                this.pendingOrder.splice(newIndex, 0, data.id);
            }
        } else if (sourceCollection === 'targetPool') {
            this.addPendingTarget(data.id, newIndex);
        }
        this.render({parts: ['pendingTargets', 'targetPool']});
    }

    /**
     * @param event Event
     * @private
     * @this TargetGuide
     */
    static _onPoolTargetDrop(event) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        const sourceCollection = data.collection;
        if (sourceCollection === 'pendingTargets') {
            const oldID = data.id;
            const newID = event.target.dataset.id;

            if(typeof newID === 'string' && typeof oldID === 'string' && oldID !== newID) {
                const index = this.deletePendingTarget(oldID);
                this.addPendingTarget(newID, index);
            }

            this.render(['pendingTargets', 'targetPool']);
        }
    }

    static _onTargetDragOver(event) {
        event.preventDefault();
    }

}
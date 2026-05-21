import {TargetData as all, TargetData} from './targetData.mjs';
import {TargetStrategy} from './targetStrategy.mjs';
import {TEMPLATES} from '../templates.mjs';
import {MODULE} from '../helpers/utils.mjs';
import {FORCE_TARGET_EFFECTS} from '../constants/autoTarget.mjs';

export class TargetContext {

    actor;
    item;
    roller;
    strategy;
    label;

    /**
     * @type {Map<string, TargetData[]>}
     */
    targets = new Map();
    originalTargets = [];

    finalTargets = [];

    log = [];

    /**
     * @param item FUItem
     * @param targetPool Set<Target>
     */
    constructor({item, targetPool}) {
        this.item = item;
        this.actor = item.actor;
        this.roller = TargetStrategy.getRollerFor(item);

        for (const target of targetPool) {
            const targetData = new TargetData(target, this);
            this.originalTargets.push(targetData);
            this.addTarget(targetData);
        }
    }

    extendTargetPool (requestedMax) {

        const currentMax = this.allTargets.length / this.originalTargets.length;

        if (requestedMax > currentMax) {
            const additionalExtensions = requestedMax - currentMax;

            for (let i = 0; i < additionalExtensions; i++) {
                for (const target of this.originalTargets) {
                    const newTarget = new TargetData(target.token, this);
                    if (target.valid) {
                        const reason = ''; // TODO
                        newTarget.validate(reason);
                    } else {
                        const reason = ''; // TODO
                        newTarget.invalidate(reason);
                    }

                    this.addTarget(newTarget);
                }
            }

        }
    }

    info(message) {
        this.log.push({message, level: 'info'});
    }

    warn(message) {
        this.log.push({message, level: 'warning'});
    }

    error(message) {
        this.log.push({message, level: 'error'});
    }

    setStrategy(strategy) {
        this.strategy = strategy;
        this.label = strategy.label;
        const maxTargets = strategy.maxTargets;

        if (this.strategy.canRepeatTargets) {
            this.extendTargetPool(maxTargets);
        }

        const targetCandidates = strategy.getTargetCandidates(this.allTargets.map(t => t.token));
        // Bail if our strategy didn't give us a proper Set.
        if (!(targetCandidates instanceof Set)) return;
        for (const candidate of targetCandidates) {
            this.targets.get(candidate.id).forEach(t => t.validate());
        }

        if (typeof maxTargets === 'number' && maxTargets > 0) {

            // Force targets only for rolls targeting enemies.
            if (strategy.canForceTargets) {
                [...this.actor.appliedEffects].forEach(e => {
                    const effectStatuses = [...e.statuses];
                    if (e.sourceInfo && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {

                        this.info(game.i18n.format(`${MODULE}.autoTarget.context.info.priorityTargetEffectFound`), {name: e.name});
                        const origin = fromUuidSync(e.sourceInfo.itemUuid ?? e.sourceInfo.actorUuid);
                        const forcedTarget = this.getSortedTargets().find(t => t.valid && t.actor.uuid === (origin.actor || origin)?.uuid);
                        if (forcedTarget) {
                            this.info(game.i18n.format(`${MODULE}.autoTarget.context.info.priorityTargetFound`), {name: forcedTarget.token.name});
                            forcedTarget.markPriority({reason: e.name, icon: e.img});
                        } else {
                            const message = game.i18n.format(`${MODULE}.autoTarget.errors.forcedTargetInvalid`, {
                                effect: e.name,
                                roller: (this.actor.token || this.actor.prototypeToken).name });
                            this.warn(message);
                            ui.notifications.warn(message);
                            return false;
                        }
                    }
                });
            }



            const targetPool = this.getSortedTargets({sortByTier: true, unique: false})
                .filter(t => t.valid)
                .slice(0, this.recommendedMaxTargets);

            for (const target of targetPool) {
                const reason = ''; // TODO
                target.markRecommended({reason});
            }

        } else targetCandidates.forEach(token => {
            this.targets.get(token.id).forEach(t => t.markRecommended(this.recommendedTargets.push(token)));
        });
    }

    clearLabel() {
        this.label = undefined;
    }

    /**
     * @param target TargetData
     */
    addTarget(target) {
        if(!this.targets.has(target.token.id)) {
            this.targets.set(target.token.id, [target]);
        } else {
            this.targets.get(target.token.id).push(target);
        }
    }

    get allTargets() {
        return [...this.targets.values()].reduce((subset, current) => current.concat(subset), []);
    }

    get validTargets() {
        return this.allTargets.filter(t => t.valid);
    }

    get invalidTargets() {
        return this.allTargets.filter(t => !t.valid);
    }

    get priorityTargets() {
        return this.allTargets.filter(t => t.priority);
    }

    get modifiedTargets() {
        return this.allTargets.filter(t => t.userSelected);
    }

    /**
     * Gets all TargetData entries indexed by Instance ID
     * @returns {Map<string, TargetData>}
     */
    getTargetDataIDMap() {
        return new Map(this.allTargets.map(t => [t.id, t]));
    }

    getSortedTargets({sortByTier = false, unique = false} = {}) {

        if (unique) {
            const allSorted = this.allTargets.sort(sortByTier ? TargetData.tierSort : TargetData.sort);
            const found = new Set();

            return allSorted.filter(target => {
                if (!found.has(target.token.id)) {
                    found.add(target.token.id);
                    return true;
                } else return false;
            });

        } else {
            return this.allTargets
                .sort(sortByTier ? TargetData.tierSort : TargetData.sort);
        }
    }

    getEnemyTargets({sortByTier, unique}) {
        return this.getSortedTargets({sortByTier, unique})
            .filter(t => t.isHostile);
    }

    getAllyTargets({sortByTier, unique}) {
        return this.getSortedTargets({sortByTier, unique})
            .filter(t => t.isFriendly && t.token.id !== this.roller.id);
    }

    getRollerTargets({sortByTier, unique}) {
        return this.getSortedTargets({sortByTier, unique})
            .filter(t => t.token.id === this.roller.id);
    }

    getAllyAndRollerTargets({sortByTier, unique}) {
        return this.getSortedTargets({sortByTier, unique})
            .filter(t => t.isFriendly);
    }

    get canRepeatTargets() {
        return this.strategy.canRepeatTargets;
    }

    get canForceTargets() {
        return this.strategy.canForceTargets;
    }

    get recommendedMaxTargets() {
        return this.strategy.maxTargets;
    }

    get recommendedTargets() {
        return this.getSortedTargets()
            .filter(t => t.recommended);
    }

    get finalTargetCount() {
        return this.finalTargets.length;
    }

    /**
     * @param targets {Token[]}
     */
    setFinalTargets(targets) {
        this.finalTargets = [...targets];
    }

    async applyFinalTargets() {
        game.canvas.tokens.setTargets(this.finalTargets.map(t => t.token.id));

        const templateData = {
            results: this.finalTargets,
            label: this.label
        };
        const messageData = ChatMessage.applyRollMode({
            content: await renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData),
            speaker: ChatMessage.getSpeaker({token: this.actor.token}),
            flavor: `${this.item.name}`,
            [`flags.${MODULE}.context.type`]: 'auto-target-results'

        }, game.settings.get('core', 'rollMode'));
        await ChatMessage.create(messageData);
    }
}
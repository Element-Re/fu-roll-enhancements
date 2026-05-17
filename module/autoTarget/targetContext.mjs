import {TargetData} from './targetData.mjs';
import {TargetStrategy} from './targetStrategy.mjs';
import {TEMPLATES} from '../templates.mjs';
import {MODULE} from '../helpers/utils.mjs';

export class TargetContext {

    actor;
    item;
    roller;
    strategy;
    label;

    targets = new Map();

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
            this.addTarget(new TargetData(target, this));
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
    }

    clearLabel() {
        this.label = undefined;
    }

    addTarget(targetState) {
        this.targets.set(targetState.id, targetState);
    }

    getTargetData(id) {
        return this.targets.get(id);
    }

    get allTargets() {
        return [...this.targets.values()];
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
        return this.allTargets.filter(t => t.userModified);
    }

    get sortedTargets() {
        return [...this.targets.values()]
            .sort(TargetData.sort);
    }

    get enemyTargets() {
        return this.sortedTargets
            .filter(t => t.isHostile);
    }

    get allyTargets() {
        return this.sortedTargets
            .filter(t => t.isFriendly && t.token.id !== this.roller.id);
    }

    get rollerTargets() {
        return this.sortedTargets
            .filter(t => t.token.id === this.roller.id);
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
        return this.allTargets
            .filter(t => t.recommended)
            .sort(TargetData.sort);
    }

    get finalTargetCount() {
        return this.finalTargets.length;
    }

    /**
     * @param targets Token[]
     */
    setFinalTargets(targets) {
        this.finalTargets = [...targets];
    }

    async applyFinalTargets() {
        game.canvas.tokens.setTargets(this.finalTargets.map(t => t.id));

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
import { keyBinds, module } from './settings.mjs';
import { TEMPLATES } from './templates.mjs';

export async function rollEnhancements (wrapped, ...args) {
	const item = this;
	// Run auto target workflow before roll
	await autoTargetWorkflow(item);
	console.log("fu-roll-enhancements | done setting targets");
	// Item macro "pre" event
	if (game.settings.get(module, "preRollItemMacro") && item.hasMacro && item.hasMacro())
		await item.executeMacro("pre");
	// Chain wrapped functions
	const returnValue = await wrapped(...args);
	// Item macro "post" event
	if (game.settings.get(module, "postRollItemMacro") && item.hasMacro && item.hasMacro())
		await item.executeMacro("post");
	return returnValue;
}

async function autoTargetWorkflow(item) {
	// Only for GMs controlling NPCs
	if (!game.user.isGM || !item.actor || item.actor.type !== "npc") return;

	// If keybind is pressed, show dialog
	if (keyBinds.autoTargetDialog) {
		const templateData = {
			item: item,
			options: item.getFlag(module, "autoTarget"),
			targetSides: TARGET_SIDES,
		};
		const targetDialogContent = await renderTemplate(TEMPLATES.AUTO_TARGET_DIALOG, templateData);
		return Dialog.wait({
			title: game.i18n.localize(`${module}.autoTarget.dialog.title`),
			content: targetDialogContent,
			default: "cancel",
			buttons: {
				target: {
					icon: '<i class="fas fa-crosshairs"></i>',
					label: game.i18n.localize(`${module}.autoTarget.dialog.buttons.target`),
					callback: (html) => {
						const options = getFormOptions(html);
						autoTarget(options, item);
					}
				},
				updateAndTarget: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize(`${module}.autoTarget.dialog.buttons.updateAndTarget`),
					callback: (html) => {
						const options = getFormOptions(html)
						autoTarget(options, item);
						item.setFlag(module, "autoTarget", foundry.utils.mergeObject(options, {enable: true}));
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${module}.autoTarget.dialog.buttons.skip`),
				},
				disable: {
					icon: '<i class="fas fa-ban"></i>',
					label: game.i18n.localize(`${module}.autoTarget.dialog.buttons.disable`),
					callback: () => item.setFlag(module, "autoTarget.enable", false)
				},
			},
			close: () => {
				console.log("fu-roll-enhancements | closing dialog");
			}
		}, {id: "auto-target-dialog"}); 
	} else if (item.getFlag(module, "autoTarget")?.enable) {
		const options = item.getFlag(module, "autoTarget");
		autoTarget(options, item);
		return;
	}
}

async function autoTarget(options, item) {
	if (!options || !item) return;
	const targetList = new Map();
	if (options.targetSide === "SELF") {
		item.actor.getActiveTokens().forEach(t => targetList.set(t, { count: 1 }));
	} else {
		let targetCandidates = [];
		const rollerTokenOrProtoType = item.actor.token ? item.actor.token : item.actor.prototypeToken;
		// Treat neutral and secret rolls as friendly for the sake of targetting.
		const rollerDisposition = [CONST.TOKEN_DISPOSITIONS.NEUTRAL, CONST.TOKEN_DISPOSITIONS.SECRET].includes(rollerTokenOrProtoType.disposition) ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : rollerTokenOrProtoType.disposition;
		let filter;
		if (options.targetSide === "ALLIES") {
			filter = t => t.document.disposition === rollerDisposition && t.actor.id !== item.actor.id && t.id !== rollerTokenOrProtoType.id;
		} else if (options.targetSide === "ALLIES_AND_SELF") {
			filter = t => t.document.disposition === rollerDisposition;
		} else if (options.targetSide === "ENEMIES") {
			filter = t => {
				const effects = [...t.actor.effects];
				return !t.document.hidden &&
					t.document.disposition === -rollerDisposition &&
					!effects.some(e => {
						const statuses = [...e.statuses];
						return statuses.some(s => UNTARGETABLE_ALL_EFFECTS.includes(s) || (options.asMelee && UNTARGETABLE_MELEE_EFFECTS.includes(s)));
					});
			};
		} else {
			filter = t => Math.abs(t.document.disposition) === Math.abs(rollerDisposition);
		}

		targetCandidates.push(...game.canvas.tokens.placeables.filter(filter));

		if (typeof options.maxTargets === "number" && options.maxTargets > 0) {

			const forcedTargetsSet = new Set();

			[...item.actor.effects].forEach(e => {
				const effectStatuses = [...e.statuses];
				if (e.origin && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {
					const origin = fromUuidSync(e.origin);
					const forcedTarget = targetCandidates.find(t => t.document.actor.uuid === (origin.actor || origin)?.uuid);
					if (forcedTarget) {
						forcedTargetsSet.add(forcedTarget);
					} else {
						ui.notifications.warn(game.i18n.localize(`${module}.autoTarget.errors.forcedTargetFailed`));
						return false;
					}
				}
			});

			const forcedTargets = [...forcedTargetsSet];

			let i = 0;
			while (i < options.maxTargets && (forcedTargets.length > 0 || targetCandidates.length > 0)) {
				const forced = forcedTargets.length > 0;
				let drawPile = forced ? forcedTargets : targetCandidates;
				var start = Math.floor(Math.random() * (drawPile.length));
				const target = options.repeat && drawPile === targetCandidates ? drawPile[start] : drawPile.splice(start, 1)[0];
				targetList.set(target, (targetList.has(target) ? foundry.utils.mergeObject(targetList.get(target), { count: targetList.get(target).count + 1 }) : { count: 1, wasForced: forced }));
				i++;
			}
		} else targetCandidates.forEach(t => targetList.set(t, { count: 1 }));
	}

	game.user.updateTokenTargets([...targetList.keys()].map(t => t.id));

	const templateData = {
		results: [...targetList.keys()].map(t => foundry.utils.mergeObject(targetList.get(t), {target: t}))
	}
	ChatMessage.create({
		content: await renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData),
		speaker: {
			actor: item.actor,
			token: item.actor.token
		},
		flavor: item.name
	});
}

function getFormOptions(html) {
	const formElement = html[0].querySelector('form');
	const formData = new FormDataExtended(formElement);
	return formData.toObject();
}

export const TARGET_SIDES = Object.freeze ({
	ENEMIES: `${module}.autoTarget.options.targetSide.sides.enemies`,
	ALLIES: `${module}.autoTarget.options.targetSide.sides.allies`,
	SELF: `${module}.autoTarget.options.targetType.sides.self`,
	ALLIES_AND_SELF: `${module}.autoTarget.options.targetSide.sides.alliesAndSelf`,
	ALL: `${module}.autoTarget.options.targetSide.sides.all`
});

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];
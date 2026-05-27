import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

export interface HorizontalLoopConfig {
	/** Roughly 100px/sec per unit of speed (default 1). */
	speed?: number;
	/** Timeline repeat count; -1 for infinite. */
	repeat?: number;
	/** Start paused. */
	paused?: boolean;
	/** Start playing in reverse (right-to-left visual drift). */
	reversed?: boolean;
	/** Trailing gap (px) after the last item before it loops. */
	paddingRight?: number;
	/** Snap dragging to this increment, or false to disable. */
	snap?: number | false;
	/** Enable drag-to-scrub via GSAP Draggable. */
	draggable?: boolean;
	/** Called when the closest item changes. */
	onChange?: (item: Element, index: number) => void;
}

export interface LoopTimeline extends gsap.core.Timeline {
	next: (vars?: gsap.TweenVars) => gsap.core.Tween | gsap.core.Timeline;
	previous: (vars?: gsap.TweenVars) => gsap.core.Tween | gsap.core.Timeline;
	toIndex: (
		index: number,
		vars?: gsap.TweenVars,
	) => gsap.core.Tween | gsap.core.Timeline;
	current: () => number;
	closestIndex: (setCurrent?: boolean) => number;
	times: number[];
	draggable?: Draggable;
	/** Reverts the internal gsap.context (kills tweens, removes listeners). */
	revertLoop: () => void;
}

/**
 * Animates a group of elements along the x-axis in a seamless, responsive loop.
 * Each item wraps back to the other side as it scrolls off, so no duplicate
 * DOM copies are needed. Adapted from GSAP's official helper, with a
 * `revertLoop()` added for React cleanup.
 *
 * https://gsap.com/docs/v3/HelperFunctions/helpers/seamlessLoop/
 */
export function horizontalLoop(
	targets: gsap.DOMTarget,
	config: HorizontalLoopConfig = {},
): LoopTimeline {
	const items = gsap.utils.toArray<HTMLElement>(targets);
	let timeline: LoopTimeline | undefined;
	const ctx = gsap.context(() => {
		const onChange = config.onChange;
		let lastIndex = 0;
		const tl = gsap.timeline({
			repeat: config.repeat,
			onUpdate:
				onChange &&
				(() => {
					const i = tl.closestIndex();
					if (lastIndex !== i) {
						lastIndex = i;
						onChange(items[i], i);
					}
				}),
			paused: config.paused,
			defaults: { ease: "none" },
			onReverseComplete: () => {
				tl.totalTime(tl.rawTime() + tl.duration() * 100);
			},
		}) as LoopTimeline;
		const length = items.length;
		const startX = items[0].offsetLeft;
		const times: number[] = [];
		const widths: number[] = [];
		const spaceBefore: number[] = [];
		const xPercents: number[] = [];
		let curIndex = 0;
		let indexIsDirty = false;
		const pixelsPerSecond = (config.speed || 1) * 100;
		const snap =
			config.snap === false
				? (v: number) => v
				: gsap.utils.snap(config.snap || 1);
		const container = items[0].parentNode as HTMLElement;
		let totalWidth = 0;
		const getTotalWidth = () =>
			items[length - 1].offsetLeft +
			(xPercents[length - 1] / 100) * widths[length - 1] -
			startX +
			spaceBefore[0] +
			items[length - 1].offsetWidth *
				(gsap.getProperty(items[length - 1], "scaleX") as number) +
			(config.paddingRight || 0);
		const populateWidths = () => {
			let b1 = container.getBoundingClientRect();
			let b2: DOMRect;
			items.forEach((el, i) => {
				widths[i] = parseFloat(gsap.getProperty(el, "width", "px") as string);
				xPercents[i] = snap(
					(parseFloat(gsap.getProperty(el, "x", "px") as string) / widths[i]) *
						100 +
						(gsap.getProperty(el, "xPercent") as number),
				);
				b2 = el.getBoundingClientRect();
				spaceBefore[i] = b2.left - (i ? b1.right : b1.left);
				b1 = b2;
			});
			gsap.set(items, { xPercent: (i: number) => xPercents[i] });
			totalWidth = getTotalWidth();
		};
		let timeWrap: (value: number) => number;
		const getClosest = (values: number[], value: number, wrap: number) => {
			let i = values.length;
			let closest = 1e10;
			let index = 0;
			let d: number;
			while (i--) {
				d = Math.abs(values[i] - value);
				if (d > wrap / 2) d = wrap - d;
				if (d < closest) {
					closest = d;
					index = i;
				}
			}
			return index;
		};
		const populateTimeline = () => {
			tl.clear();
			for (let i = 0; i < length; i++) {
				const item = items[i];
				const curX = (xPercents[i] / 100) * widths[i];
				const distanceToStart =
					item.offsetLeft + curX - startX + spaceBefore[0];
				const distanceToLoop =
					distanceToStart +
					widths[i] * (gsap.getProperty(item, "scaleX") as number);
				tl.to(
					item,
					{
						xPercent: snap(((curX - distanceToLoop) / widths[i]) * 100),
						duration: distanceToLoop / pixelsPerSecond,
					},
					0,
				)
					.fromTo(
						item,
						{
							xPercent: snap(
								((curX - distanceToLoop + totalWidth) / widths[i]) * 100,
							),
						},
						{
							xPercent: xPercents[i],
							duration:
								(curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond,
							immediateRender: false,
						},
						distanceToLoop / pixelsPerSecond,
					)
					.add(`label${i}`, distanceToStart / pixelsPerSecond);
				times[i] = distanceToStart / pixelsPerSecond;
			}
			timeWrap = gsap.utils.wrap(0, tl.duration());
		};
		const refresh = (deep?: boolean) => {
			const progress = tl.progress();
			tl.progress(0, true);
			populateWidths();
			deep && populateTimeline();
			deep && tl.draggable && tl.paused()
				? tl.time(times[curIndex], true)
				: tl.progress(progress, true);
		};
		const onResize = () => refresh(true);
		let proxy: HTMLElement;
		gsap.set(items, { x: 0 });
		populateWidths();
		populateTimeline();
		window.addEventListener("resize", onResize);
		function toIndex(index: number, vars?: gsap.TweenVars) {
			vars = vars || {};
			if (Math.abs(index - curIndex) > length / 2)
				index += index > curIndex ? -length : length;
			const newIndex = gsap.utils.wrap(0, length, index);
			let time = times[newIndex];
			if (time > tl.time() !== index > curIndex && index !== curIndex) {
				time += tl.duration() * (index > curIndex ? 1 : -1);
			}
			if (time < 0 || time > tl.duration()) vars.modifiers = { time: timeWrap };
			curIndex = newIndex;
			vars.overwrite = true;
			gsap.killTweensOf(proxy);
			return vars.duration === 0
				? tl.time(timeWrap(time))
				: tl.tweenTo(time, vars);
		}
		tl.toIndex = (index: number, vars?: gsap.TweenVars) => toIndex(index, vars);
		tl.closestIndex = (setCurrent?: boolean) => {
			const index = getClosest(times, tl.time(), tl.duration());
			if (setCurrent) {
				curIndex = index;
				indexIsDirty = false;
			}
			return index;
		};
		tl.current = () => (indexIsDirty ? tl.closestIndex(true) : curIndex);
		tl.next = (vars?: gsap.TweenVars) => toIndex(tl.current() + 1, vars);
		tl.previous = (vars?: gsap.TweenVars) => toIndex(tl.current() - 1, vars);
		tl.times = times;
		tl.progress(1, true).progress(0, true); // pre-render for performance
		if (config.reversed) {
			tl.vars.onReverseComplete?.();
			tl.reverse();
		}
		if (config.draggable) {
			proxy = document.createElement("div");
			const wrap = gsap.utils.wrap(0, 1);
			let ratio: number;
			let startProgress: number;
			let draggable: Draggable;
			let lastSnap: number;
			let initChangeX: number;
			let wasPlaying: boolean;
			const align = () => {
				tl.progress(
					wrap(startProgress + (draggable.startX - draggable.x) * ratio),
				);
			};
			const syncIndex = () => tl.closestIndex(true);
			draggable = Draggable.create(proxy, {
				trigger: items[0].parentNode as HTMLElement,
				type: "x",
				onPressInit() {
					const x = this.x;
					gsap.killTweensOf(tl);
					wasPlaying = !tl.paused();
					tl.pause();
					startProgress = tl.progress();
					refresh();
					ratio = 1 / totalWidth;
					initChangeX = startProgress / -ratio - x;
					gsap.set(proxy, { x: startProgress / -ratio });
				},
				onDrag: align,
				onThrowUpdate: align,
				overshootTolerance: 0,
				inertia: true,
				snap(value: number) {
					if (Math.abs(startProgress / -ratio - this.x) < 10)
						return lastSnap + initChangeX;
					const time = -(value * ratio) * tl.duration();
					const wrappedTime = timeWrap(time);
					const snapTime = times[getClosest(times, wrappedTime, tl.duration())];
					let dif = snapTime - wrappedTime;
					if (Math.abs(dif) > tl.duration() / 2)
						dif += dif < 0 ? tl.duration() : -tl.duration();
					lastSnap = (time + dif) / tl.duration() / -ratio;
					return lastSnap;
				},
				onRelease() {
					syncIndex();
					if (draggable.isThrowing) indexIsDirty = true;
				},
				onThrowComplete: () => {
					syncIndex();
					if (wasPlaying) tl.play();
				},
			})[0];
			tl.draggable = draggable;
		}
		tl.closestIndex(true);
		lastIndex = curIndex;
		onChange?.(items[curIndex], curIndex);
		timeline = tl;
		return () => window.removeEventListener("resize", onResize);
	});
	if (!timeline) throw new Error("horizontalLoop: timeline was not created");
	timeline.revertLoop = () => ctx.revert();
	return timeline;
}

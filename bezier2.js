(() => {
	const CANVAS_WIDTH = 600;
	const CANVAS_HEIGHT = 300;
	const BEZIER_STEPS = 600;

	const CONTROL_POINTS = Object.freeze([
		{x: -250, y: 0},
		{x: 0, y: 100},
		{x: 50, y: 0},
		{x: 150, y: 100},
	]);

	const SELECT_RADIUS = 12;

	const COLORS = {
		control: [255, 32, 32, 255],
		selectedControl: [255, 190, 0, 255],
		scaffold: [180, 180, 180, 255],
		intermediate: [210, 210, 210, 255],
		result: [255, 0, 0, 255],
	};

	class CanvasBuffer {
		constructor(canvas, width, height) {
			this.canvas = canvas;
			this.canvas.width = width;
			this.canvas.height = height;
			this.width = width;
			this.height = height;

			this.ctx = canvas.getContext("2d");
			this.frame = this.ctx.createImageData(width, height);
			this.data = this.frame.data;
		}

		clear() {
			this.data.fill(0);
		}

		drawCartesianPoint(x, y, color) {
			const canvasCoords = cartesianToCanvas(x, y, this.width, this.height);
			const canvasX = Math.round(canvasCoords.x);
			const canvasY = Math.round(canvasCoords.y);

			if (canvasX < 0 || canvasX >= this.width) return;
			if (canvasY < 0 || canvasY >= this.height) return;

			const offset = 4 * (canvasY * this.width + canvasX);
			for (let i = 0; i < 4; i++) {
				this.data[offset + i] = color[i];
			}
		}

		flush() {
			this.ctx.putImageData(this.frame, 0, 0);
		}
	}

	class BezierVisualizer {
		constructor(canvas, options) {
			this.canvas = canvas;
			this.buffer = new CanvasBuffer(canvas, options.width, options.height);
			this.points = options.points.map(point => ({...point}));
			this.steps = options.steps;
			this.step = 0;
			this.stepLabel = options.stepLabel;
			this.stepMaxLabel = options.stepMaxLabel;
			this.skipButton = options.skipButton;
			this.selectedIndex = null;
			this.dragPointerId = null;

			this.trailEnabled = false;
			this.trailRenderedUntil = -1;

			if (this.stepMaxLabel) this.stepMaxLabel.textContent = String(this.steps);
			this.updateStepLabel();
			this.updateSkipState();
			this.attachPointerHandlers();
			this.render(true);
		}

		nextStep() {
			if (this.step >= this.steps) return;
			this.step += 1;
			this.updateStepLabel();
			this.updateSkipState();
			this.render();
		}

		skipToEnd() {
			if (this.step >= this.steps) return;
			this.step = this.steps;
			this.updateStepLabel();
			this.updateSkipState();
			this.render();
		}

		setTrailEnabled(enabled) {
			if (this.trailEnabled === enabled) return;
			this.trailEnabled = enabled;
			this.render(true);
		}

		updateStepLabel() {
			if (this.stepLabel) this.stepLabel.textContent = String(this.step);
		}

		updateSkipState() {
			if (this.skipButton) this.skipButton.disabled = this.step >= this.steps;
		}

		render(forceFullRedraw = false) {
			const cappedStep = Math.min(this.step, this.steps);
			const needsClear = forceFullRedraw || !this.trailEnabled;

			if (needsClear) {
				this.buffer.clear();
				this.trailRenderedUntil = -1;
			}

			if (this.trailEnabled) {
				const start = Math.max(0, this.trailRenderedUntil + 1);
				for (let i = start; i <= cappedStep; i++) {
					const t = this.steps === 0 ? 0 : i / this.steps;
					this.drawBezierHierarchy(this.points, t);
				}
				this.trailRenderedUntil = Math.max(this.trailRenderedUntil, cappedStep);
			} else {
				const t = this.steps === 0 ? 0 : cappedStep / this.steps;
				this.drawBezierHierarchy(this.points, t);
			}

			this.drawControlPoints();

			this.buffer.flush();
		}

		drawControlPoints() {
			this.points.forEach((point, index) => {
				const color = index === this.selectedIndex ? COLORS.selectedControl : COLORS.control;
				this.buffer.drawCartesianPoint(point.x, point.y, color);
			});
		}

		drawBezierHierarchy(points, t) {
			if (points.length < 2) return;

			const scaffolds = [];

			for (let i = 0; i < points.length - 1; i++) {
				const interpolated = lerpPoint(points[i], points[i + 1], t);
				const color = points.length === 2 ? COLORS.result : COLORS.scaffold;
				this.buffer.drawCartesianPoint(interpolated.x, interpolated.y, color);
				scaffolds.push(interpolated);
			}

			if (scaffolds.length <= 1) return;

			const innerPoints = [];
			for (let i = 0; i < scaffolds.length - 1; i++) {
				const inner = lerpPoint(scaffolds[i], scaffolds[i + 1], t);
				this.buffer.drawCartesianPoint(inner.x, inner.y, COLORS.intermediate);
				innerPoints.push(inner);
			}

			if (innerPoints.length > 1) {
				this.drawBezierHierarchy(innerPoints, t);
			}
		}

		attachPointerHandlers() {
			this.onPointerDown = this.handlePointerDown.bind(this);
			this.onPointerMove = this.handlePointerMove.bind(this);
			this.onPointerUp = this.handlePointerUp.bind(this);

			this.canvas.addEventListener("pointerdown", this.onPointerDown);
			this.canvas.addEventListener("pointermove", this.onPointerMove);
			this.canvas.addEventListener("pointerup", this.onPointerUp);
			this.canvas.addEventListener("pointerleave", this.onPointerUp);
			this.canvas.addEventListener("pointercancel", this.onPointerUp);
		}

		handlePointerDown(event) {
			if (event.button !== 0) return;
			event.preventDefault();
			const canvasPos = this.getCanvasPositionFromEvent(event);
			const hitIndex = this.hitTestControlPoint(canvasPos);

			if (hitIndex !== null) {
				this.selectPoint(hitIndex);
				this.dragPointerId = event.pointerId;
				this.canvas.setPointerCapture(event.pointerId);
			} else {
				this.clearSelection();
			}
		}

		handlePointerMove(event) {
			if (this.dragPointerId === null || event.pointerId !== this.dragPointerId) return;
			event.preventDefault();
			if (this.selectedIndex === null) return;

			const canvasPos = this.getCanvasPositionFromEvent(event);
			const cartesian = canvasToCartesian(canvasPos.x, canvasPos.y, this.buffer.width, this.buffer.height);

			const point = this.points[this.selectedIndex];
			point.x = cartesian.x;
			point.y = cartesian.y;

			this.render(true);
		}

		handlePointerUp(event) {
			if (this.dragPointerId !== null && event.pointerId === this.dragPointerId) {
				this.canvas.releasePointerCapture(event.pointerId);
				this.dragPointerId = null;
			}
		}

		selectPoint(index) {
			if (this.selectedIndex === index) return;
			this.selectedIndex = index;
			this.render(true);
		}

		clearSelection() {
			if (this.selectedIndex === null) return;
			this.selectedIndex = null;
			this.render(true);
		}

		getCanvasPositionFromEvent(event) {
			const rect = this.canvas.getBoundingClientRect();
			const scaleX = this.canvas.width / rect.width;
			const scaleY = this.canvas.height / rect.height;
			return {
				x: (event.clientX - rect.left) * scaleX,
				y: (event.clientY - rect.top) * scaleY,
			};
		}

		hitTestControlPoint(canvasPos) {
			let closestIndex = null;
			let closestDistance = Number.POSITIVE_INFINITY;

			this.points.forEach((point, index) => {
				const canvasPoint = cartesianToCanvas(point.x, point.y, this.buffer.width, this.buffer.height);
				const dx = canvasPos.x - canvasPoint.x;
				const dy = canvasPos.y - canvasPoint.y;
				const distance = Math.hypot(dx, dy);

				if (distance <= SELECT_RADIUS && distance < closestDistance) {
					closestDistance = distance;
					closestIndex = index;
				}
			});

			return closestIndex;
		}
	}

	function lerp(a, b, t) {
		return (b - a) * t + a;
	}

	function lerpPoint(p1, p2, t) {
		return {
			x: lerp(p1.x, p2.x, t),
			y: lerp(p1.y, p2.y, t),
		};
	}

	function cartesianToCanvas(x, y, width, height) {
		return {
			x: x + width / 2,
			y: height / 2 - y,
		};
	}

	function canvasToCartesian(x, y, width, height) {
		return {
			x: x - width / 2,
			y: height / 2 - y,
		};
	}

	function init() {
		const canvas = document.getElementById("curve-canvas");
		const stepLabel = document.getElementById("step-count");
		const stepMaxLabel = document.getElementById("step-max");
		const trailToggle = document.getElementById("trail-toggle");
		const skipButton = document.getElementById("skip-button");

		const visualizer = new BezierVisualizer(canvas, {
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT,
			points: CONTROL_POINTS,
			steps: BEZIER_STEPS,
			stepLabel,
			stepMaxLabel,
			skipButton,
		});

		document.addEventListener("keydown", event => {
			if (event.key === "n") {
				visualizer.nextStep();
			}
		});

		if (trailToggle) {
			trailToggle.addEventListener("change", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					visualizer.setTrailEnabled(input.checked);
				}
			});
		}

		if (skipButton) {
			skipButton.addEventListener("click", () => {
				visualizer.skipToEnd();
			});
		}
	}

	init();
})();

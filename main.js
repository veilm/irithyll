(() => {
	const CANVAS_WIDTH = 960;
	const CANVAS_HEIGHT = 720;
	const BEZIER_STEPS = 600;

	const CONTROL_POINTS = Object.freeze([
		{x: -360, y: -60},
		{x: -80, y: 160},
		{x: 140, y: -40},
		{x: 360, y: 220},
	]);

	const SELECT_RADIUS = 18;
	const DUPLICATE_OFFSET = Object.freeze({x: 20, y: 0});
	const MIN_CONTROL_POINTS = 2;

	const COLORS = {
		control: [255, 32, 32, 255],
		selectedControl: [255, 190, 0, 255],
		scaffold: [180, 180, 180, 255],
		intermediate: [210, 210, 210, 255],
		result: [255, 0, 0, 255],
	};

	const POINT_RADII = Object.freeze({
		curve: 2,
		scaffold: 1,
		intermediate: 1,
		control: 6,
		selectedControl: 7,
	});

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

		drawCartesianPoint(x, y, color, radius = 0) {
			const canvasCoords = cartesianToCanvas(x, y, this.width, this.height);
			const centerX = Math.round(canvasCoords.x);
			const centerY = Math.round(canvasCoords.y);
			const radiusInt = Math.max(0, radius | 0);
			const radiusSquared = radiusInt * radiusInt;

			for (let dy = -radiusInt; dy <= radiusInt; dy++) {
				const py = centerY + dy;
				if (py < 0 || py >= this.height) continue;

				for (let dx = -radiusInt; dx <= radiusInt; dx++) {
					if (radiusInt > 0 && dx * dx + dy * dy > radiusSquared) continue;

					const px = centerX + dx;
					if (px < 0 || px >= this.width) continue;

					const offset = 4 * (py * this.width + px);
					for (let i = 0; i < 4; i++) {
						this.data[offset + i] = color[i];
					}
				}
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
			this.sampleCount = options.steps ?? 0;
			this.selectedIndex = null;
			this.dragPointerId = null;
			this.duplicateButton = options.duplicateButton ?? null;
			this.deleteButton = options.deleteButton ?? null;

			this.trailEnabled = true;

			this.attachPointerHandlers();
			this.updateControlButtons();
			this.render();
		}

		setTrailEnabled(enabled) {
			if (this.trailEnabled === enabled) return;
			this.trailEnabled = enabled;
			this.render();
		}

		updateControlButtons() {
			if (this.duplicateButton) {
				this.duplicateButton.disabled = this.selectedIndex === null;
			}

			if (this.deleteButton) {
				const hasSelection = this.selectedIndex !== null;
				const hasEnoughPoints = this.points.length > MIN_CONTROL_POINTS;
				this.deleteButton.disabled = !(hasSelection && hasEnoughPoints);
			}
		}

		render() {
			this.buffer.clear();

			const samples = Math.max(1, this.sampleCount);
			const drawScaffolds = this.trailEnabled;

			for (let i = 0; i <= samples; i++) {
				const t = i / samples;
				this.drawBezierHierarchy(this.points, t, drawScaffolds);
			}

			this.drawControlPoints();
			this.buffer.flush();
		}

		drawControlPoints() {
			this.points.forEach((point, index) => {
				const isSelected = index === this.selectedIndex;
				const color = isSelected ? COLORS.selectedControl : COLORS.control;
				const radius = isSelected ? POINT_RADII.selectedControl : POINT_RADII.control;
				this.buffer.drawCartesianPoint(point.x, point.y, color, radius);
			});
		}

		drawBezierHierarchy(points, t, drawScaffolds = true) {
			if (points.length < 2) return;

			const scaffolds = [];

			for (let i = 0; i < points.length - 1; i++) {
				const interpolated = lerpPoint(points[i], points[i + 1], t);
				const isCurvePoint = points.length === 2;
				const shouldDraw = isCurvePoint || drawScaffolds;
				if (shouldDraw) {
					const color = isCurvePoint ? COLORS.result : COLORS.scaffold;
					const radius = isCurvePoint ? POINT_RADII.curve : POINT_RADII.scaffold;
					this.buffer.drawCartesianPoint(interpolated.x, interpolated.y, color, radius);
				}
				scaffolds.push(interpolated);
			}

			if (scaffolds.length <= 1) return;

			const innerPoints = [];
			for (let i = 0; i < scaffolds.length - 1; i++) {
				const inner = lerpPoint(scaffolds[i], scaffolds[i + 1], t);
				if (drawScaffolds) {
					this.buffer.drawCartesianPoint(inner.x, inner.y, COLORS.intermediate, POINT_RADII.intermediate);
				}
				innerPoints.push(inner);
			}

			if (innerPoints.length === 1) {
				const finalPoint = innerPoints[0];
				this.buffer.drawCartesianPoint(finalPoint.x, finalPoint.y, COLORS.result, POINT_RADII.curve);
				return;
			}

			if (innerPoints.length > 1) {
				this.drawBezierHierarchy(innerPoints, t, drawScaffolds);
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

			this.render();
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
			this.render();
			this.updateControlButtons();
		}

		clearSelection() {
			if (this.selectedIndex === null) return;
			this.selectedIndex = null;
			this.render();
			this.updateControlButtons();
		}

		duplicateSelectedPoint() {
			if (this.selectedIndex === null) return;

			const source = this.points[this.selectedIndex];
			const duplicate = {
				x: source.x + DUPLICATE_OFFSET.x,
				y: source.y + DUPLICATE_OFFSET.y,
			};

			const insertIndex = this.selectedIndex + 1;
			this.points.splice(insertIndex, 0, duplicate);
			this.selectPoint(insertIndex);
		}

		deleteSelectedPoint() {
			if (this.selectedIndex === null) return;
			if (this.points.length <= MIN_CONTROL_POINTS) return;

			const removedIndex = this.selectedIndex;
			this.points.splice(removedIndex, 1);

			if (this.points.length === 0) {
				this.selectedIndex = null;
			} else {
				this.selectedIndex = Math.min(removedIndex, this.points.length - 1);
			}

			this.render();
			this.updateControlButtons();
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
		const trailToggle = document.getElementById("trail-toggle");
		const duplicateButton = document.getElementById("duplicate-point");
		const deleteButton = document.getElementById("delete-point");

		const visualizer = new BezierVisualizer(canvas, {
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT,
			points: CONTROL_POINTS,
			steps: BEZIER_STEPS,
			duplicateButton,
			deleteButton,
		});

		if (trailToggle) {
			visualizer.setTrailEnabled(trailToggle.checked);
			trailToggle.addEventListener("change", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					visualizer.setTrailEnabled(input.checked);
				}
			});
		}

		if (duplicateButton) {
			duplicateButton.addEventListener("click", () => {
				visualizer.duplicateSelectedPoint();
			});
		}

		if (deleteButton) {
			deleteButton.addEventListener("click", () => {
				visualizer.deleteSelectedPoint();
			});
		}
	}

	init();
})();

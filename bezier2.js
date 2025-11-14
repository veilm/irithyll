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

	const COLORS = {
		control: [255, 32, 32, 255],
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
			const canvasX = Math.round(x + this.width / 2);
			const canvasY = Math.round(this.height / 2 - y);

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
			this.buffer = new CanvasBuffer(canvas, options.width, options.height);
			this.points = options.points.map(point => ({...point}));
			this.steps = options.steps;
			this.step = 0;
			this.stepLabel = options.stepLabel;
			this.stepMaxLabel = options.stepMaxLabel;

			if (this.stepMaxLabel) this.stepMaxLabel.textContent = String(this.steps);
			this.updateStepLabel();
			this.render();
		}

		nextStep() {
			this.step += 1;
			this.updateStepLabel();
			this.render();
		}

		updateStepLabel() {
			if (this.stepLabel) this.stepLabel.textContent = String(this.step);
		}

		render() {
			const t = this.steps === 0 ? 0 : this.step / this.steps;
			this.buffer.clear();

			this.drawBezierHierarchy(this.points, t);
			this.drawControlPoints();

			this.buffer.flush();
		}

		drawControlPoints() {
			this.points.forEach(point => {
				this.buffer.drawCartesianPoint(point.x, point.y, COLORS.control);
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

	function init() {
		const canvas = document.getElementById("curve-canvas");
		const stepLabel = document.getElementById("step-count");
		const stepMaxLabel = document.getElementById("step-max");

		const visualizer = new BezierVisualizer(canvas, {
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT,
			points: CONTROL_POINTS,
			steps: BEZIER_STEPS,
			stepLabel,
			stepMaxLabel,
		});

		document.addEventListener("keydown", event => {
			if (event.key === "n") {
				visualizer.nextStep();
			}
		});
	}

	init();
})();

(() => {
	const CANVAS_WIDTH = 960;
	const CANVAS_HEIGHT = 720;
	const BEZIER_STEPS = 1000;

	const CONTROL_POINTS = Object.freeze([
		{x: -360, y: -60},
		{x: -80, y: 160},
		{x: 140, y: -40},
		{x: 360, y: 220},
	]);

	const SELECT_RADIUS = 18;
	const DUPLICATE_OFFSET = Object.freeze({x: 20, y: 0});
	const MIN_CONTROL_POINTS = 2;
	const CURVE_SUPERSAMPLES = 4;
	const DEFAULT_CURVE_SOFT_RADIUS = 2;
	const DEFAULT_CURVE_SOFT_INTENSITY = 0.4;
	const DEFAULT_REFERENCE_OPACITY = 0.6;
	const DEFAULT_REFERENCE_OFFSET = Object.freeze({x: 0, y: 0});
	const DEFAULT_REFERENCE_ZOOM = 1;
	const MIN_REFERENCE_ZOOM = 0.2;
	const MAX_REFERENCE_ZOOM = 3;
	const SCAFFOLD_GRADIENT = Object.freeze({
		start: [Math.round(255 * 0.1), Math.round(255 * 0.1), Math.round(255 * 0.1)],
		mid: [255, 255, 255],
		end: [255, Math.round(255 * 0.5), Math.round(255 * 0.5)],
	});

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

		drawSoftPoint(x, y, color, radius = 1.5, intensity = 0.5) {
			const canvasCoords = cartesianToCanvas(x, y, this.width, this.height);
			const centerX = canvasCoords.x;
			const centerY = canvasCoords.y;
			const radiusSquared = radius * radius;
			const minX = Math.max(0, Math.floor(centerX - radius));
			const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
			const minY = Math.max(0, Math.floor(centerY - radius));
			const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));

			for (let py = minY; py <= maxY; py++) {
				const offsetY = py + 0.5 - centerY;
				for (let px = minX; px <= maxX; px++) {
					const offsetX = px + 0.5 - centerX;
					const distanceSquared = offsetX * offsetX + offsetY * offsetY;
					if (distanceSquared > radiusSquared) continue;
					const distance = Math.sqrt(distanceSquared);
					const falloff = 1 - distance / radius;
					const alpha = Math.max(0, falloff) * intensity;
					this.blendPixel(px, py, color, alpha);
				}
			}
		}

		blendPixel(px, py, color, alpha) {
			if (alpha <= 0) return;
			const offset = 4 * (py * this.width + px);
			const srcAlpha = clamp01(alpha * (color[3] / 255));
			const dstAlpha = this.data[offset + 3] / 255;
			const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
			if (outAlpha <= 0) {
				return;
			}
			const blendChannel = channel => {
				const src = color[channel] / 255;
				const dst = this.data[offset + channel] / 255;
				const out = (src * srcAlpha + dst * dstAlpha * (1 - srcAlpha)) / outAlpha;
				this.data[offset + channel] = Math.round(out * 255);
			};
			blendChannel(0);
			blendChannel(1);
			blendChannel(2);
			this.data[offset + 3] = Math.round(outAlpha * 255);
		}

		flush(referenceLayer = null) {
			this.ctx.clearRect(0, 0, this.width, this.height);
			this.ctx.putImageData(this.frame, 0, 0);
			if (referenceLayer) {
				this.drawReferenceLayer(referenceLayer);
			}
		}

		drawReferenceLayer(layer) {
			const {image, width, height} = layer;
			if (!image || !width || !height) return;
			const opacity = clamp01(layer.opacity);
			if (opacity <= 0) return;
			const zoom = layer.zoom ?? 1;
			const fit = computeContainFit(width, height, this.width, this.height, zoom);
			const offsetX = layer.offsetX ?? 0;
			const offsetY = layer.offsetY ?? 0;
			const drawX = fit.x + offsetX;
			const drawY = fit.y + offsetY;
			const flipX = layer.flipX ? -1 : 1;
			const flipY = layer.flipY ? -1 : 1;
			this.ctx.save();
			this.ctx.globalAlpha = opacity;
			this.ctx.globalCompositeOperation = "destination-over";
			this.ctx.translate(drawX + fit.width / 2, drawY + fit.height / 2);
			this.ctx.scale(flipX, flipY);
			this.ctx.drawImage(image, -fit.width / 2, -fit.height / 2, fit.width, fit.height);
			this.ctx.restore();
		}
	}

	class BezierVisualizer {
		constructor(canvas, options) {
			this.canvas = canvas;
			this.buffer = new CanvasBuffer(canvas, options.width, options.height);
			this.points = options.points.map(point => ({...point}));
			this.sampleCount = Math.max(1, options.steps ?? 1);
			this.curveSupersamples = Math.max(1, options.curveSupersamples ?? 1);
			this.curveSoftRadius = Math.max(0.1, options.curveSoftRadius ?? DEFAULT_CURVE_SOFT_RADIUS);
			this.curveSoftIntensity = clamp01(options.curveSoftIntensity ?? DEFAULT_CURVE_SOFT_INTENSITY);
			this.referenceImage = null;
			this.referenceOpacity = clamp01(options.referenceOpacity ?? DEFAULT_REFERENCE_OPACITY);
			this.referenceVisible = false;
			this.referenceFlipX = false;
			this.referenceFlipY = false;
			this.referenceOffset = {...DEFAULT_REFERENCE_OFFSET};
			this.referenceZoom = clamp(
				options.referenceZoom ?? DEFAULT_REFERENCE_ZOOM,
				MIN_REFERENCE_ZOOM,
				MAX_REFERENCE_ZOOM
			);
			this.referenceAdjustMode = false;
			this.onReferenceTransformChange = options.onReferenceTransformChange ?? null;
			this.onReferenceAdjustModeChange = options.onReferenceAdjustModeChange ?? null;
			this.selectedIndex = null;
			this.dragPointerId = null;
			this.referencePanPointerId = null;
			this.referencePanStart = null;
			this.referencePanInitialOffset = null;
			this.duplicateButton = options.duplicateButton ?? null;
			this.deleteButton = options.deleteButton ?? null;

			this.trailEnabled = true;

			this.attachPointerHandlers();
			this.attachWheelHandler();
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
			const totalScaffoldLevels = Math.max(1, this.points.length - 2);

			if (drawScaffolds) {
				for (let i = 0; i <= samples; i++) {
					const t = i / samples;
					this.drawBezierHierarchy(
						this.points,
						t,
						drawScaffolds,
						totalScaffoldLevels,
						0,
						false
					);
				}
			}

			this.drawSupersampledCurve(samples);

			this.drawControlPoints();
			const backgroundLayer = this.referenceVisible && this.referenceImage
				? {
					image: this.referenceImage.image,
					width: this.referenceImage.width,
					height: this.referenceImage.height,
					opacity: this.referenceOpacity,
					flipX: this.referenceFlipX,
					flipY: this.referenceFlipY,
					offsetX: this.referenceOffset.x,
					offsetY: this.referenceOffset.y,
					zoom: this.referenceZoom,
				}
				: null;
			this.buffer.flush(backgroundLayer);
		}

		drawSupersampledCurve(baseSamples) {
			const supersampleMultiplier = Math.max(1, this.curveSupersamples);
			const totalSamples = Math.max(1, baseSamples * supersampleMultiplier);
			for (let i = 0; i <= totalSamples; i++) {
				const t = i / totalSamples;
				const point = evaluateBezierPoint(this.points, t);
				if (point) {
					this.buffer.drawSoftPoint(
						point.x,
						point.y,
						COLORS.result,
						this.curveSoftRadius,
						this.curveSoftIntensity
					);
				}
			}
		}

		drawControlPoints() {
			this.points.forEach((point, index) => {
				const isSelected = index === this.selectedIndex;
				const color = isSelected ? COLORS.selectedControl : COLORS.control;
				const radius = isSelected ? POINT_RADII.selectedControl : POINT_RADII.control;
				this.buffer.drawCartesianPoint(point.x, point.y, color, radius);
			});
		}

		drawBezierHierarchy(
			points,
			t,
			drawScaffolds = true,
			totalScaffoldLevels = 1,
			levelIndex = 0,
			drawCurvePoint = true
		) {
			if (points.length < 2) return;

			const scaffolds = [];

			for (let i = 0; i < points.length - 1; i++) {
				const interpolated = lerpPoint(points[i], points[i + 1], t);
				const isCurvePoint = points.length === 2;
				const shouldDraw = (isCurvePoint && drawCurvePoint) || (!isCurvePoint && drawScaffolds);
				if (shouldDraw) {
					const color = isCurvePoint
						? COLORS.result
						: this.getScaffoldColor(levelIndex, totalScaffoldLevels);
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
					const innerColor = this.getScaffoldColor(levelIndex + 1, totalScaffoldLevels);
					this.buffer.drawCartesianPoint(inner.x, inner.y, innerColor, POINT_RADII.intermediate);
				}
				innerPoints.push(inner);
			}

			if (innerPoints.length === 1) {
				if (drawCurvePoint) {
					const finalPoint = innerPoints[0];
					this.buffer.drawCartesianPoint(finalPoint.x, finalPoint.y, COLORS.result, POINT_RADII.curve);
				}
				return;
			}

			if (innerPoints.length > 1) {
				this.drawBezierHierarchy(
					innerPoints,
					t,
					drawScaffolds,
					totalScaffoldLevels,
					levelIndex + 1,
					drawCurvePoint
				);
			}
		}

		setSampleCount(count) {
			const clamped = Math.max(1, Math.floor(count));
			if (clamped === this.sampleCount) return;
			this.sampleCount = clamped;
			this.render();
		}

		hasReferenceImage() {
			return Boolean(this.referenceImage?.image);
		}

		async loadReferenceFile(file) {
			if (!file) return false;
			try {
				const image = await loadImageFromFile(file);
				this.setReferenceImage(image);
				return true;
			} catch (error) {
				console.error("Failed to load reference image", error);
				return false;
			}
		}

		setReferenceImage(image) {
			if (!image) return;
			this.releaseReferenceImage();
			const dimensions = getImageDimensions(image);
			this.referenceImage = {
				image,
				width: dimensions.width,
				height: dimensions.height,
			};
			this.referenceVisible = true;
			this.resetReferenceTransform();
			this.render();
		}

		clearReferenceImage() {
			if (this.referenceImage) {
				this.releaseReferenceImage();
			}
			this.referenceVisible = false;
			this.resetReferenceTransform();
			this.render();
		}

		releaseReferenceImage() {
			if (this.referenceImage?.image && typeof this.referenceImage.image.close === "function") {
				this.referenceImage.image.close();
			}
			this.referenceImage = null;
		}

		setReferenceVisibility(enabled) {
			const normalized = Boolean(enabled);
			const nextValue = normalized && this.hasReferenceImage();
			if (this.referenceVisible === nextValue) return;
			this.referenceVisible = nextValue;
			if (!this.referenceVisible) {
				this.setReferenceAdjustMode(false);
			}
			this.render();
		}

		setReferenceOpacity(value) {
			const normalized = clamp01(Number(value) || 0);
			if (Math.abs(normalized - this.referenceOpacity) < 1e-3) return;
			this.referenceOpacity = normalized;
			this.render();
		}

		setReferenceFlipX(enabled) {
			const next = Boolean(enabled);
			if (this.referenceFlipX === next) return;
			this.referenceFlipX = next;
			if (this.hasReferenceImage()) {
				this.render();
			}
			this.notifyReferenceTransformChange();
		}

		setReferenceFlipY(enabled) {
			const next = Boolean(enabled);
			if (this.referenceFlipY === next) return;
			this.referenceFlipY = next;
			if (this.hasReferenceImage()) {
				this.render();
			}
			this.notifyReferenceTransformChange();
		}

		setReferenceOffset(axis, value, silent = false) {
			if (!(axis === "x" || axis === "y")) return;
			const normalized = Number(value) || 0;
			if (Math.abs(normalized - this.referenceOffset[axis]) < 0.1) return;
			this.referenceOffset[axis] = normalized;
			if (this.hasReferenceImage()) {
				this.render();
			}
			if (!silent) {
				this.notifyReferenceTransformChange();
			}
		}

		setReferenceZoom(value) {
			const normalized = clamp(value, MIN_REFERENCE_ZOOM, MAX_REFERENCE_ZOOM);
			if (Math.abs(normalized - this.referenceZoom) < 1e-3) return;
			this.referenceZoom = normalized;
			if (this.hasReferenceImage()) {
				this.render();
			}
			this.notifyReferenceTransformChange();
		}

		setReferenceZoomAroundPoint(value, canvasX, canvasY) {
			if (!this.hasReferenceImage()) return;
			const normalized = clamp(value, MIN_REFERENCE_ZOOM, MAX_REFERENCE_ZOOM);
			const currentFit = computeContainFit(
				this.referenceImage.width,
				this.referenceImage.height,
				this.buffer.width,
				this.buffer.height,
				this.referenceZoom
			);
			const newFit = computeContainFit(
				this.referenceImage.width,
				this.referenceImage.height,
				this.buffer.width,
				this.buffer.height,
				normalized
			);
			const anchorX = canvasX ?? this.buffer.width / 2;
			const anchorY = canvasY ?? this.buffer.height / 2;
			const currentDrawX = currentFit.x + this.referenceOffset.x;
			const currentDrawY = currentFit.y + this.referenceOffset.y;
			const ratioX = currentFit.width ? (anchorX - currentDrawX) / currentFit.width : 0.5;
			const ratioY = currentFit.height ? (anchorY - currentDrawY) / currentFit.height : 0.5;
			const desiredDrawX = anchorX - ratioX * newFit.width;
			const desiredDrawY = anchorY - ratioY * newFit.height;
			this.referenceOffset.x = desiredDrawX - newFit.x;
			this.referenceOffset.y = desiredDrawY - newFit.y;
			this.referenceZoom = normalized;
			this.render();
			this.notifyReferenceTransformChange();
		}

		resetReferenceTransform() {
			this.referenceFlipX = false;
			this.referenceFlipY = false;
			this.referenceOffset = {...DEFAULT_REFERENCE_OFFSET};
			this.referenceZoom = DEFAULT_REFERENCE_ZOOM;
			this.notifyReferenceTransformChange();
		}

		setReferenceAdjustMode(enabled) {
			const next = Boolean(enabled) && this.hasReferenceImage();
			if (this.referenceAdjustMode === next) return;
			this.referenceAdjustMode = next;
			if (!next) {
				this.referencePanPointerId = null;
				this.referencePanStart = null;
				this.referencePanInitialOffset = null;
			}
			this.canvas.classList.toggle("reference-adjust-mode", this.referenceAdjustMode);
			if (typeof this.onReferenceAdjustModeChange === "function") {
				this.onReferenceAdjustModeChange(this.referenceAdjustMode);
			}
		}

		notifyReferenceTransformChange() {
			if (typeof this.onReferenceTransformChange === "function") {
				this.onReferenceTransformChange({
					flipX: this.referenceFlipX,
					flipY: this.referenceFlipY,
					offsetX: this.referenceOffset.x,
					offsetY: this.referenceOffset.y,
					zoom: this.referenceZoom,
				});
			}
		}

		setCurveSoftRadius(radius) {
			const normalized = Math.max(0.1, Number(radius) || 0);
			if (Math.abs(normalized - this.curveSoftRadius) < 1e-3) return;
			this.curveSoftRadius = normalized;
			this.render();
		}

		setCurveSoftIntensity(intensity) {
			const normalized = clamp01(Number(intensity) || 0);
			if (Math.abs(normalized - this.curveSoftIntensity) < 1e-3) return;
			this.curveSoftIntensity = normalized;
			this.render();
		}

		getScaffoldColor(levelIndex, totalLevels) {
			if (totalLevels <= 0) return COLORS.scaffold;
			const clampedIndex = Math.min(totalLevels, Math.max(0, levelIndex));
			const progress = (clampedIndex + 1) / (totalLevels + 1);
			return computeScaffoldGradient(progress);
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

		attachWheelHandler() {
			this.onWheel = this.handleWheel.bind(this);
			this.canvas.addEventListener("wheel", this.onWheel, {passive: false});
		}

		handlePointerDown(event) {
			if (event.button !== 0) return;
			event.preventDefault();
			if (this.referenceAdjustMode && this.hasReferenceImage()) {
				this.startReferencePan(event);
				return;
			}
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

		startReferencePan(event) {
			const canvasPos = this.getCanvasPositionFromEvent(event);
			this.referencePanPointerId = event.pointerId;
			this.referencePanStart = canvasPos;
			this.referencePanInitialOffset = {...this.referenceOffset};
			this.canvas.setPointerCapture(event.pointerId);
		}

		updateReferencePan(event) {
			if (!this.referencePanStart || !this.referencePanInitialOffset) return;
			const canvasPos = this.getCanvasPositionFromEvent(event);
			const deltaX = canvasPos.x - this.referencePanStart.x;
			const deltaY = canvasPos.y - this.referencePanStart.y;
			this.setReferenceOffset("x", this.referencePanInitialOffset.x + deltaX, true);
			this.setReferenceOffset("y", this.referencePanInitialOffset.y + deltaY, true);
			this.notifyReferenceTransformChange();
		}

		handleWheel(event) {
			if (!this.referenceAdjustMode || !this.hasReferenceImage()) return;
			event.preventDefault();
			const zoomFactor = Math.exp(-event.deltaY * 0.0015);
			const targetZoom = clamp(this.referenceZoom * zoomFactor, MIN_REFERENCE_ZOOM, MAX_REFERENCE_ZOOM);
			const anchor = this.getCanvasPositionFromEvent(event);
			this.setReferenceZoomAroundPoint(targetZoom, anchor.x, anchor.y);
		}

		handlePointerMove(event) {
			if (this.referenceAdjustMode && this.referencePanPointerId !== null) {
				if (event.pointerId !== this.referencePanPointerId) return;
				event.preventDefault();
				this.updateReferencePan(event);
				return;
			}

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
			if (this.referencePanPointerId !== null && event.pointerId === this.referencePanPointerId) {
				this.canvas.releasePointerCapture(event.pointerId);
				this.referencePanPointerId = null;
				this.referencePanStart = null;
				this.referencePanInitialOffset = null;
				return;
			}

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

	function evaluateBezierPoint(points, t) {
		if (!points || points.length === 0) {
			return null;
		}

		let current = points.map(point => ({x: point.x, y: point.y}));
		while (current.length > 1) {
			const next = [];
			for (let i = 0; i < current.length - 1; i++) {
				next.push(lerpPoint(current[i], current[i + 1], t));
			}
			current = next;
		}

		return current[0] ?? null;
	}

	function clamp01(value) {
		if (!Number.isFinite(value)) return 0;
		return Math.min(1, Math.max(0, value));
	}

	function clamp(value, min, max) {
		if (!Number.isFinite(value)) return min;
		const lower = Math.min(min, max);
		const upper = Math.max(min, max);
		return Math.min(upper, Math.max(lower, value));
	}

	async function loadImageFromFile(file) {
		if (!file) {
			throw new Error("No file provided");
		}
		if (typeof createImageBitmap === "function") {
			return await createImageBitmap(file);
		}
		const dataUrl = await readFileAsDataURL(file);
		return await loadImageElement(dataUrl);
	}

	function readFileAsDataURL(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
			reader.onload = () => {
				if (typeof reader.result === "string") {
					resolve(reader.result);
				} else {
					reject(new Error("Unexpected reader result"));
				}
			};
			reader.readAsDataURL(file);
		});
	}

	function loadImageElement(src) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error("Failed to load image"));
			img.src = src;
		});
	}

	function getImageDimensions(image) {
		if (!image) return {width: 0, height: 0};
		const width = image.width ?? image.naturalWidth ?? image.videoWidth ?? 0;
		const height = image.height ?? image.naturalHeight ?? image.videoHeight ?? 0;
		return {width, height};
	}

	function computeContainFit(srcWidth, srcHeight, dstWidth, dstHeight, scaleOverride = 1) {
		if (srcWidth <= 0 || srcHeight <= 0) {
			return {width: dstWidth, height: dstHeight, x: 0, y: 0};
		}
		const containScale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
		const scale = containScale * Math.max(MIN_REFERENCE_ZOOM, scaleOverride);
		const width = srcWidth * scale;
		const height = srcHeight * scale;
		return {
			width,
			height,
			x: (dstWidth - width) / 2,
			y: (dstHeight - height) / 2,
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

	function computeScaffoldGradient(progress) {
		const clamped = Math.min(1, Math.max(0, progress));
		if (clamped <= 0.5) {
			const localT = clamped / 0.5;
			return lerpColor(SCAFFOLD_GRADIENT.start, SCAFFOLD_GRADIENT.mid, localT);
		}
		const localT = (clamped - 0.5) / 0.5;
		return lerpColor(SCAFFOLD_GRADIENT.mid, SCAFFOLD_GRADIENT.end, localT);
	}

	function lerpColor(start, end, t) {
		return [
			Math.round(lerp(start[0], end[0], t)),
			Math.round(lerp(start[1], end[1], t)),
			Math.round(lerp(start[2], end[2], t)),
			255,
		];
	}

	function init() {
		const canvas = document.getElementById("curve-canvas");
		const trailToggle = document.getElementById("trail-toggle");
		const stepsSlider = document.getElementById("steps-slider");
		const stepsValue = document.getElementById("steps-value");
		const referenceInput = document.getElementById("reference-input");
		const referenceFileName = document.getElementById("reference-file-name");
		const referenceToggle = document.getElementById("reference-toggle");
		const referenceModeButton = document.getElementById("reference-mode-toggle");
		const referenceFlipXToggle = document.getElementById("reference-flip-x");
		const referenceFlipYToggle = document.getElementById("reference-flip-y");
		const referenceOpacitySlider = document.getElementById("reference-opacity");
		const referenceOpacityValue = document.getElementById("reference-opacity-value");
		const referenceZoomSlider = document.getElementById("reference-zoom");
		const referenceZoomValue = document.getElementById("reference-zoom-value");
		const referencePanXSlider = document.getElementById("reference-pan-x");
		const referencePanXValue = document.getElementById("reference-pan-x-value");
		const referencePanYSlider = document.getElementById("reference-pan-y");
		const referencePanYValue = document.getElementById("reference-pan-y-value");
		const clearReferenceButton = document.getElementById("clear-reference");
		const softRadiusSlider = document.getElementById("soft-radius-slider");
		const softRadiusValue = document.getElementById("soft-radius-value");
		const softIntensitySlider = document.getElementById("soft-intensity-slider");
		const softIntensityValue = document.getElementById("soft-intensity-value");
		const duplicateButton = document.getElementById("duplicate-point");
		const deleteButton = document.getElementById("delete-point");

		const visualizer = new BezierVisualizer(canvas, {
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT,
			points: CONTROL_POINTS,
			steps: BEZIER_STEPS,
			curveSupersamples: CURVE_SUPERSAMPLES,
			curveSoftRadius: DEFAULT_CURVE_SOFT_RADIUS,
			curveSoftIntensity: DEFAULT_CURVE_SOFT_INTENSITY,
			referenceOpacity: DEFAULT_REFERENCE_OPACITY,
			referenceZoom: DEFAULT_REFERENCE_ZOOM,
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

		if (stepsSlider instanceof HTMLInputElement) {
			const syncSampleControls = value => {
				const normalized = Math.max(1, Number(value));
				if (stepsValue) {
					stepsValue.textContent = String(normalized);
				}
				visualizer.setSampleCount(normalized);
			};

			syncSampleControls(stepsSlider.value || stepsSlider.defaultValue || BEZIER_STEPS);
			stepsSlider.addEventListener("input", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					syncSampleControls(input.value);
				}
			});
		}

		if (softRadiusSlider instanceof HTMLInputElement) {
			const syncSoftRadius = value => {
				const normalized = Math.max(0.1, Number(value));
				if (softRadiusValue) {
					softRadiusValue.textContent = normalized.toFixed(1);
				}
				visualizer.setCurveSoftRadius(normalized);
			};

			softRadiusSlider.value = String(visualizer.curveSoftRadius);
			syncSoftRadius(softRadiusSlider.value);
			softRadiusSlider.addEventListener("input", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					syncSoftRadius(input.value);
				}
			});
		}

		if (softIntensitySlider instanceof HTMLInputElement) {
			const syncSoftIntensity = value => {
				const normalized = clamp01(Number(value));
				if (softIntensityValue) {
					softIntensityValue.textContent = normalized.toFixed(2);
				}
				visualizer.setCurveSoftIntensity(normalized);
			};

			softIntensitySlider.value = String(visualizer.curveSoftIntensity);
			syncSoftIntensity(softIntensitySlider.value);
			softIntensitySlider.addEventListener("input", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					syncSoftIntensity(input.value);
				}
			});
		}

		const setElementDisabled = (element, disabled) => {
			if (!element) return;
			element.disabled = disabled;
		};

		const formatPixels = value => `${Math.round(value)}px`;

		const syncReferenceTransformUi = () => {
			if (referenceFlipXToggle instanceof HTMLInputElement) {
				referenceFlipXToggle.checked = visualizer.referenceFlipX;
			}
			if (referenceFlipYToggle instanceof HTMLInputElement) {
				referenceFlipYToggle.checked = visualizer.referenceFlipY;
			}
			if (referenceZoomSlider instanceof HTMLInputElement) {
				referenceZoomSlider.value = visualizer.referenceZoom.toFixed(2);
			}
			if (referenceZoomValue) {
				referenceZoomValue.textContent = visualizer.referenceZoom.toFixed(2);
			}
			if (referencePanXSlider instanceof HTMLInputElement) {
				referencePanXSlider.value = String(visualizer.referenceOffset.x);
			}
			if (referencePanXValue) {
				referencePanXValue.textContent = formatPixels(visualizer.referenceOffset.x);
			}
			if (referencePanYSlider instanceof HTMLInputElement) {
				referencePanYSlider.value = String(visualizer.referenceOffset.y);
			}
			if (referencePanYValue) {
				referencePanYValue.textContent = formatPixels(visualizer.referenceOffset.y);
			}
		};

		const syncReferenceModeButton = () => {
			if (referenceModeButton instanceof HTMLButtonElement) {
				referenceModeButton.textContent = visualizer.referenceAdjustMode
					? "Exit reference adjust"
					: "Adjust reference";
				referenceModeButton.setAttribute("aria-pressed", visualizer.referenceAdjustMode ? "true" : "false");
				referenceModeButton.classList.toggle("active", visualizer.referenceAdjustMode);
			}
		};

		const resetReferenceTransformDisplays = () => {
			if (referenceFlipXToggle instanceof HTMLInputElement) {
				referenceFlipXToggle.checked = false;
			}
			if (referenceFlipYToggle instanceof HTMLInputElement) {
				referenceFlipYToggle.checked = false;
			}
			if (referenceZoomSlider instanceof HTMLInputElement) {
				referenceZoomSlider.value = DEFAULT_REFERENCE_ZOOM.toFixed(2);
			}
			if (referenceZoomValue) {
				referenceZoomValue.textContent = DEFAULT_REFERENCE_ZOOM.toFixed(2);
			}
			if (referencePanXSlider instanceof HTMLInputElement) {
				referencePanXSlider.value = "0";
			}
			if (referencePanXValue) {
				referencePanXValue.textContent = formatPixels(0);
			}
			if (referencePanYSlider instanceof HTMLInputElement) {
				referencePanYSlider.value = "0";
			}
			if (referencePanYValue) {
				referencePanYValue.textContent = formatPixels(0);
			}
		};

		visualizer.onReferenceTransformChange = () => {
			syncReferenceTransformUi();
		};

		visualizer.onReferenceAdjustModeChange = () => {
			syncReferenceModeButton();
		};

		const updateReferenceUiState = () => {
			const hasImage = visualizer.hasReferenceImage();
			setElementDisabled(referenceToggle, !hasImage);
			setElementDisabled(referenceOpacitySlider, !hasImage);
			setElementDisabled(clearReferenceButton, !hasImage);
			setElementDisabled(referenceFlipXToggle, !hasImage);
			setElementDisabled(referenceFlipYToggle, !hasImage);
			setElementDisabled(referenceModeButton, !hasImage);
			setElementDisabled(referenceZoomSlider, !hasImage);
			setElementDisabled(referencePanXSlider, !hasImage);
			setElementDisabled(referencePanYSlider, !hasImage);
			if (referenceToggle instanceof HTMLInputElement) {
				referenceToggle.checked = hasImage && visualizer.referenceVisible;
			}
			if (hasImage) {
				syncReferenceTransformUi();
			} else {
				visualizer.setReferenceAdjustMode(false);
				resetReferenceTransformDisplays();
			}
			syncReferenceModeButton();
		};

		if (referenceToggle instanceof HTMLInputElement) {
			referenceToggle.addEventListener("change", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					visualizer.setReferenceVisibility(input.checked);
				}
			});
		}

		if (referenceModeButton instanceof HTMLButtonElement) {
			referenceModeButton.addEventListener("click", () => {
				const next = !visualizer.referenceAdjustMode;
				visualizer.setReferenceAdjustMode(next);
				syncReferenceModeButton();
			});
		}

		if (referenceFlipXToggle instanceof HTMLInputElement) {
			referenceFlipXToggle.addEventListener("change", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					visualizer.setReferenceFlipX(input.checked);
				}
			});
		}

		if (referenceFlipYToggle instanceof HTMLInputElement) {
			referenceFlipYToggle.addEventListener("change", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					visualizer.setReferenceFlipY(input.checked);
				}
			});
		}

		const applyReferenceOpacityValue = value => {
			const normalized = clamp01(Number(value));
			if (referenceOpacityValue) {
				referenceOpacityValue.textContent = normalized.toFixed(2);
			}
			visualizer.setReferenceOpacity(normalized);
		};

		if (referenceOpacitySlider instanceof HTMLInputElement) {
			referenceOpacitySlider.value = String(DEFAULT_REFERENCE_OPACITY);
			applyReferenceOpacityValue(referenceOpacitySlider.value);
			referenceOpacitySlider.addEventListener("input", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					applyReferenceOpacityValue(input.value);
				}
			});
		}

		const clampZoomValue = value => clamp(value, MIN_REFERENCE_ZOOM, MAX_REFERENCE_ZOOM);
		const applyReferenceZoomValue = value => {
			const normalized = clampZoomValue(Number(value));
			if (referenceZoomValue) {
				referenceZoomValue.textContent = normalized.toFixed(2);
			}
			visualizer.setReferenceZoom(normalized);
		};

		if (referenceZoomSlider instanceof HTMLInputElement) {
			referenceZoomSlider.min = String(MIN_REFERENCE_ZOOM);
			referenceZoomSlider.max = String(MAX_REFERENCE_ZOOM);
			referenceZoomSlider.step = "0.05";
			referenceZoomSlider.value = DEFAULT_REFERENCE_ZOOM.toFixed(2);
			applyReferenceZoomValue(referenceZoomSlider.value);
			referenceZoomSlider.addEventListener("input", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					applyReferenceZoomValue(input.value);
				}
			});
		}

		const applyReferencePanValue = (axis, value, valueLabel) => {
			const numeric = Number(value) || 0;
			if (valueLabel) {
				valueLabel.textContent = formatPixels(numeric);
			}
			visualizer.setReferenceOffset(axis, numeric);
		};

		if (referencePanXSlider instanceof HTMLInputElement) {
			referencePanXSlider.value = "0";
			referencePanXSlider.addEventListener("input", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					applyReferencePanValue("x", input.value, referencePanXValue);
				}
			});
		}

		if (referencePanYSlider instanceof HTMLInputElement) {
			referencePanYSlider.value = "0";
			referencePanYSlider.addEventListener("input", event => {
				const input = event.currentTarget;
				if (input instanceof HTMLInputElement) {
					applyReferencePanValue("y", input.value, referencePanYValue);
				}
			});
		}

		if (referenceInput instanceof HTMLInputElement) {
			referenceInput.addEventListener("change", async () => {
				const files = referenceInput.files;
				const file = files && files[0];
				if (!file) return;
				if (referenceFileName) {
					referenceFileName.textContent = `Loading ${file.name}...`;
				}
				const success = await visualizer.loadReferenceFile(file);
				if (success) {
					if (referenceFileName) {
						referenceFileName.textContent = file.name;
					}
					if (referenceToggle instanceof HTMLInputElement) {
						referenceToggle.checked = true;
						visualizer.setReferenceVisibility(true);
					}
					if (referenceOpacitySlider instanceof HTMLInputElement) {
						referenceOpacitySlider.value = String(visualizer.referenceOpacity);
						applyReferenceOpacityValue(referenceOpacitySlider.value);
					}
					syncReferenceTransformUi();
				} else if (referenceFileName) {
					referenceFileName.textContent = "Failed to load image";
				}
				referenceInput.value = "";
				updateReferenceUiState();
			});
		}

		if (clearReferenceButton instanceof HTMLButtonElement) {
			clearReferenceButton.addEventListener("click", () => {
				visualizer.clearReferenceImage();
				if (referenceInput instanceof HTMLInputElement) {
					referenceInput.value = "";
				}
				if (referenceFileName) {
					referenceFileName.textContent = "No image loaded";
				}
				if (referenceToggle instanceof HTMLInputElement) {
					referenceToggle.checked = false;
				}
				if (referenceOpacitySlider instanceof HTMLInputElement) {
					referenceOpacitySlider.value = String(DEFAULT_REFERENCE_OPACITY);
					applyReferenceOpacityValue(referenceOpacitySlider.value);
				}
				resetReferenceTransformDisplays();
				updateReferenceUiState();
			});
		}

		updateReferenceUiState();
	}

	init();
})();

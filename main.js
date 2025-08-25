// const CANVAS_WIDTH = 1920 * 3/4
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080 * (3 / 4);

const canvas = document.getElementById("canvas");
const codeTextarea = document.getElementById("codeTextarea");
const patternSelect = document.getElementById("pattern");

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d");

const config = {};

// Will store loaded pattern code
const patterns = {};

// Reality: Internal ground truth
// Display: The window the user sees into the world
const reality = {};
for (let x = -100; x <= 100; x += 10) {
	if (!reality[x]) reality[x] = {};
	reality[x][0] = 1;
}
for (let x = -50; x <= 50; x += 10) {
	if (!reality[x]) reality[x] = {};
	reality[x][25] = 1;
}
for (let x = -50; x <= 50; x += 10) {
	if (!reality[x]) reality[x] = {};
	reality[x][50] = 1;
}

// data: always pass in direct JS form
// x: from 0 (left) to CANVAS_WIDTH (right)
// y: from 0 (top) to CANVAS_HEIGHT (bottom)
// brightness: from 0.0 to 1.0
function setPixel(data, x, y, brightness = 1) {
	brightness = Math.round(brightness * 255);

	x = Math.round(x);
	y = Math.round(y);

	if (x < 0 || x > CANVAS_WIDTH || y < 0 || y > CANVAS_HEIGHT) return;

	// 4: 4 bytes (r, g, b, a) per pixel
	const i = 4 * (y * CANVAS_WIDTH + x);

	data[i] = brightness; // r
	data[i + 1] = brightness; // g
	data[i + 2] = brightness; // b
	data[i + 3] = 255; // a
}

// Textarea will be populated with selected pattern on load

const PRIMARY_PATTERN = "parabola_up_0";

// Load all patterns from individual files
async function loadPatterns() {
	for (const patternName of PATTERN_LIST) {
		try {
			const response = await fetch(`patterns/${patternName}.js`);
			patterns[patternName] = await response.text();
		} catch (error) {
			console.error(`Failed to load pattern ${patternName}:`, error);
		}
	}

	// Add pattern options to select (already sorted newest to oldest in PATTERN_LIST)
	PATTERN_LIST.forEach((pattern) => {
		const option = document.createElement("option");
		option.value = pattern;
		option.innerHTML = pattern;
		patternSelect.appendChild(option);
	});

	// Auto-select the PRIMARY_PATTERN if it exists, otherwise first pattern
	if (patterns[PRIMARY_PATTERN]) {
		patternSelect.value = PRIMARY_PATTERN;
		codeTextarea.value = patterns[PRIMARY_PATTERN];
	} else if (PATTERN_LIST.length > 0 && patterns[PATTERN_LIST[0]]) {
		patternSelect.value = PATTERN_LIST[0];
		codeTextarea.value = patterns[PATTERN_LIST[0]];
	}
}

// source: /home/oboro/src/irithyll/patterns/grid.js
function grid(data, gridCols = 12, gridRows = (12 * 3) / 4, brightness = 0.2) {
	for (let i = 0; i < gridCols; i++) {
		const x = i * (CANVAS_WIDTH / gridCols);

		for (let y = 0; y < CANVAS_HEIGHT; y++) setPixel(data, x, y, brightness);
	}

	for (let i = 0; i < gridRows; i++) {
		const y = i * (CANVAS_HEIGHT / gridRows);

		for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(data, x, y, brightness);
	}
}

function clearScreen(data) {
	for (let y = 0; y < CANVAS_HEIGHT; y++) {
		for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(data, x, y, false);
	}
}

function autoComputeDisplayWindow() {
	const displayWindow = {};

	let minX = Infinity;
	let maxX = -Infinity;

	let minY = Infinity;
	let maxY = -Infinity;

	for (const xStr of Object.keys(reality)) {
		const x = Number(xStr);
		if (x > maxX) maxX = x;
		if (x < minX) minX = x;

		for (const yStr of Object.keys(reality[x])) {
			const y = Number(yStr);
			if (y > maxY) maxY = y;
			if (y < minY) minY = y;
		}
	}

	const rangeX = maxX - minX;
	const rangeY = maxY - minY;

	displayWindow.center = {
		x: (maxX + minX) / 2,
		y: (maxY + minY) / 2,
	};

	console.log(`X goes from ${minX} to ${maxX} which is a range ${rangeX}`);
	console.log(`Y goes from ${minY} to ${maxY} which is a range ${rangeY}`);

	/*
	CANVAS_WIDTH/rangeX = CANVAS_HEIGHT/n
	n = CANVAS_HEIGHT/CANVAS_WIDTH * rangeX

	CANVAS_HEIGHT/rangeY = CANVAS_WIDTH/n
	n = CANVAS_WIDTH/CANVAS_HEIGHT * rangeY
	*/
	const rangeXAdjustedHeight = (CANVAS_HEIGHT / CANVAS_WIDTH) * rangeX;
	const rangeYAdjustedWidth = (CANVAS_WIDTH / CANVAS_HEIGHT) * rangeY;

	console.log(
		`if we scaled so canvas width (${CANVAS_WIDTH}) -> ${rangeX}, then canvas height (${CANVAS_HEIGHT}) -> ${rangeXAdjustedHeight}`,
	);
	console.log(
		`if we scaled so canvas height (${CANVAS_HEIGHT}) -> ${rangeY}, then canvas width (${CANVAS_WIDTH}) -> ${rangeYAdjustedWidth}`,
	);

	if (rangeXAdjustedHeight >= rangeY) {
		console.log(`${rangeX}x${rangeXAdjustedHeight} fits the rangeY ${rangeY}`);
		displayWindow.realWidth = rangeX;
		displayWindow.realHeight = rangeXAdjustedHeight;
	}
	if (rangeYAdjustedWidth >= rangeX) {
		console.log(`${rangeYAdjustedWidth}x${rangeY} fits the rangeX ${rangeX}`);
		displayWindow.realWidth = rangeYAdjustedWidth;
		displayWindow.realHeight = rangeY;
	}

	// reality * scale = display
	// scale = display/reality
	displayWindow.scale = {
		x: CANVAS_WIDTH / displayWindow.realWidth,
		y: CANVAS_HEIGHT / displayWindow.realHeight,
	};

	console.log("final displayWindow", displayWindow);
	return displayWindow;
}

function displayIllusion() {
	const frame = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
	const data = frame.data;
	clearScreen(data);

	if (!config.displayWindow) config.displayWindow = autoComputeDisplayWindow();
	const displayWindow = config.displayWindow;

	for (const xStr of Object.keys(reality)) {
		const x = Number(xStr);

		for (const yStr of Object.keys(reality[x])) {
			const y = Number(yStr);

			let displayX = x;
			let displayY = y;

			displayX *= displayWindow.scale.x;
			displayY *= displayWindow.scale.y;

			// console.log(displayX, displayY);

			displayX -= displayWindow.center.x * displayWindow.scale.x;
			displayY -= displayWindow.center.y * displayWindow.scale.y;

			// At this point, displayX and displayY are correct assuming the
			// canvas is a cartesian plane with 0,0 in the center vertically and horizontally
			// so if our real input is "0,0" we want to actually draw "CANVAS_WIDTH/2, CANVAS_HEIGHT/2"

			// if our real input was "100, 200" then that means we want center -> 100 right -> 200 up
			// that would be CANVAS_WIDTH/2, CANVAS_HEIGHT/2 -> x += 100 -> y -= 200

			displayX += CANVAS_WIDTH / 2;
			displayY = CANVAS_HEIGHT / 2 - displayY;

			setPixel(data, displayX, displayY, reality[x][y]);
			setPixel(data, displayX + 1, displayY + 1, reality[x][y]);
			setPixel(data, displayX - 1, displayY - 1, reality[x][y]);
		}
	}

	// draw the frame
	ctx.putImageData(frame, 0, 0);
}

function main() {
	const frame = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
	const data = frame.data;

	clearScreen(data);

	// Always execute what's in the textarea
	const patternCode = codeTextarea.value;
	eval(patternCode);

	// draw the frame
	ctx.putImageData(frame, 0, 0);
}

patternSelect.onchange = () => {
	const selectedPattern = patternSelect.value;

	// Load the selected pattern into the textarea
	if (patterns[selectedPattern]) {
		codeTextarea.value = patterns[selectedPattern];
	}

	main();
};

// Global Ctrl+Enter handler - just re-render with current textarea content
document.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.key === "Enter") {
		main();
	}
});

// Add click handler for the draw button
const drawButton = document.getElementById("drawButton");
drawButton.addEventListener("click", () => {
	main();
});

// Camera interaction API - you implement these!
let onZoom = (deltaFrac, canvasX, canvasY) => {
	// console.log(
	// 	`Zoom: ${deltaFrac} at (${canvasX}, ${canvasY})`,
	// );

	if (!config.displayWindow) config.displayWindow = autoComputeDisplayWindow();

	config.displayWindow.scale.x *= 1 + deltaFrac;
	config.displayWindow.scale.y *= 1 + deltaFrac;
	displayIllusion();
};

let onPanStart = (canvasX, canvasY) => {
	// console.log(`Pan start at (${canvasX}, ${canvasY})`);
};

let onPanMove = (deltaX, deltaY) => {
	deltaY *= -1;
	// now it's cartesian

	// console.log(`Pan move by (${deltaX}, ${deltaY})`);

	if (!config.displayWindow) config.displayWindow = autoComputeDisplayWindow();

	config.displayWindow.center.x -= deltaX / config.displayWindow.scale.x;
	config.displayWindow.center.y -= deltaY / config.displayWindow.scale.y;
	displayIllusion();
};

let onPanEnd = () => {
	// console.log("Pan end");
};

// Mouse wheel for zooming
canvas.addEventListener("wheel", (e) => {
	e.preventDefault();

	const rect = canvas.getBoundingClientRect();
	const canvasX = e.clientX - rect.left;
	const canvasY = e.clientY - rect.top;

	// Convert wheel delta to zoom percentage (adjust sensitivity as needed)
	const zoomFrac = e.deltaY > 0 ? -0.1 : 0.1;

	onZoom(zoomFrac, canvasX, canvasY);
});

// Mouse drag for panning
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener("mousedown", (e) => {
	if (e.button === 0) {
		// Left mouse button
		isPanning = true;
		const rect = canvas.getBoundingClientRect();
		lastMouseX = e.clientX - rect.left;
		lastMouseY = e.clientY - rect.top;

		onPanStart(lastMouseX, lastMouseY);
	}
});

canvas.addEventListener("mousemove", (e) => {
	if (isPanning) {
		const rect = canvas.getBoundingClientRect();
		const currentX = e.clientX - rect.left;
		const currentY = e.clientY - rect.top;

		const deltaX = currentX - lastMouseX;
		const deltaY = currentY - lastMouseY;

		onPanMove(deltaX, deltaY);

		lastMouseX = currentX;
		lastMouseY = currentY;
	}
});

canvas.addEventListener("mouseup", (e) => {
	if (e.button === 0 && isPanning) {
		isPanning = false;
		onPanEnd();
	}
});

canvas.addEventListener("mouseleave", () => {
	if (isPanning) {
		isPanning = false;
		onPanEnd();
	}
});

// Initialize patterns and start
loadPatterns().then(() => {
	main();
});

// Custom Cursor Implementation
const cursorDot = document.querySelector(".cursor-dot");
const cursorOutline = document.querySelector(".cursor-outline");

let cursorX = 0;
let cursorY = 0;
let outlineX = 0;
let outlineY = 0;

// Track mouse position
document.addEventListener("mousemove", (e) => {
	cursorX = e.clientX;
	cursorY = e.clientY;

	// Immediate update for dot
	cursorDot.style.left = cursorX + "px";
	cursorDot.style.top = cursorY + "px";
});

// Smooth animation for outline
function animateCursor() {
	// Smooth follow effect for outline
	outlineX += (cursorX - outlineX) * 0.15;
	outlineY += (cursorY - outlineY) * 0.15;

	cursorOutline.style.left = outlineX + "px";
	cursorOutline.style.top = outlineY + "px";

	requestAnimationFrame(animateCursor);
}
animateCursor();

// Add hover effects for interactive elements
// 1755190491 exclude canvas because it's too significant and would make this a default
const hoverElements = document.querySelectorAll("a, button, select, textarea");

hoverElements.forEach((element) => {
	element.addEventListener("mouseenter", () => {
		document.body.classList.add("cursor-hover");
	});

	element.addEventListener("mouseleave", () => {
		document.body.classList.remove("cursor-hover");
	});
});

// Click effects
document.addEventListener("mousedown", () => {
	document.body.classList.add("cursor-click");
});

document.addEventListener("mouseup", () => {
	document.body.classList.remove("cursor-click");
});

// Hide cursor when it leaves the window
document.addEventListener("mouseleave", () => {
	cursorDot.style.opacity = "0";
	cursorOutline.style.opacity = "0";
});

document.addEventListener("mouseenter", () => {
	cursorDot.style.opacity = "1";
	cursorOutline.style.opacity = "1";
});

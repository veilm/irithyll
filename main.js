// const CANVAS_WIDTH = 1920 * 3/4
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080 * (3 / 4);

const canvas = document.getElementById("canvas");
const codeTextarea = document.getElementById("codeTextarea");
const patternSelect = document.getElementById("pattern");

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d");

// Will store loaded pattern code
const patterns = {};

// data: always pass
// x: from 0 (left) to CANVAS_WIDTH (right)
// y: from 0 (bottom) to CANVAS_HEIGHT (top)
// brightness: from 0.0 to 1.0
function setPixel(data, x, y, brightness = 1) {
	brightness = Math.round(brightness * 255);

	// Invert so that 0 is the bottom. easier to reason about for
	// Cartesian-friends
	y = CANVAS_HEIGHT - y;

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
let onZoom = (deltaPercent, canvasX, canvasY) => {
	console.log(
		`Zoom: ${deltaPercent > 0 ? "+" : ""}${deltaPercent}% at (${canvasX}, ${canvasY})`,
	);
};

let onPanStart = (canvasX, canvasY) => {
	console.log(`Pan start at (${canvasX}, ${canvasY})`);
};

let onPanMove = (deltaX, deltaY) => {
	console.log(`Pan move by (${deltaX}, ${deltaY})`);
};

let onPanEnd = () => {
	console.log("Pan end");
};

// Mouse wheel for zooming
canvas.addEventListener("wheel", (e) => {
	e.preventDefault();

	const rect = canvas.getBoundingClientRect();
	const canvasX = e.clientX - rect.left;
	const canvasY = e.clientY - rect.top;

	// Convert wheel delta to zoom percentage (adjust sensitivity as needed)
	const zoomPercent = e.deltaY > 0 ? -10 : 10;

	onZoom(zoomPercent, canvasX, canvasY);
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
		canvas.style.cursor = "grabbing";

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
		canvas.style.cursor = "default";
		onPanEnd();
	}
});

canvas.addEventListener("mouseleave", () => {
	if (isPanning) {
		isPanning = false;
		canvas.style.cursor = "default";
		onPanEnd();
	}
});

// Initialize patterns and start
loadPatterns().then(() => {
	main();
});

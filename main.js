// const CANVAS_WIDTH = 1920 * 3/4
const CANVAS_WIDTH = (((1080 * 4) / 3) * 3) / 4;
const CANVAS_HEIGHT = (1080 * 3) / 4;

const canvas = document.getElementById("canvas");
const customTextarea = document.getElementById("customTextarea");
const patternSelect = document.getElementById("pattern");

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d");

// Will store loaded pattern code
const patterns = {};

function setPixel(data, x, y, isOn = true) {
	// Invert so that 0 is the bottom. easier to reason about for
	// Cartesian-friends
	y = CANVAS_HEIGHT - y;

	x = Math.round(x);
	y = Math.round(y);

	// 4: 4 bytes (r, g, b, a) per pixel
	const i = 4 * (y * CANVAS_WIDTH + x);

	const color = isOn ? 255 : 0;
	data[i] = color; // r
	data[i + 1] = color; // g
	data[i + 2] = color; // b
	data[i + 3] = 255; // a
}

// Default custom pattern text
const DEFAULT_CUSTOM_PATTERN = `// infer it yourself

const startY = CANVAS_HEIGHT / 5;
const paddingX = CANVAS_WIDTH / 10;

for (let x = paddingX; x < CANVAS_WIDTH - paddingX; x++) {

const y = startY + (x * x) / CANVAS_WIDTH / 2;
console.log(y);

setPixel(data, x, y);
setPixel(data, x, y + 1);
setPixel(data, x, y + 2);

}`;

customTextarea.innerHTML = DEFAULT_CUSTOM_PATTERN;

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

	// Add pattern options to select
	PATTERN_LIST.slice()
		.reverse()
		.forEach((pattern) => {
			const option = document.createElement("option");
			option.value = pattern;
			option.innerHTML = pattern;
			patternSelect.appendChild(option);
		});

	// Set initial pattern text if primary pattern is selected
	if (patternSelect.value === "primary" && patterns[PRIMARY_PATTERN]) {
		customTextarea.value = patterns[PRIMARY_PATTERN];
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

	const selectedPattern = patternSelect.value;
	if (selectedPattern == "custom") {
		const customPatternStr = customTextarea.value;
		eval(customPatternStr);
	} else {
		const patternKey =
			selectedPattern == "primary" ? PRIMARY_PATTERN : selectedPattern;

		// Execute the pattern code string
		if (patterns[patternKey]) {
			eval(patterns[patternKey]);
		}
	}

	// draw the frame
	ctx.putImageData(frame, 0, 0);
}

patternSelect.onchange = () => {
	const selectedPattern = patternSelect.value;

	// Load the selected pattern into the textarea (except for custom)
	if (selectedPattern !== "custom") {
		const patternKey =
			selectedPattern === "primary" ? PRIMARY_PATTERN : selectedPattern;
		if (patterns[patternKey]) {
			customTextarea.value = patterns[patternKey];
		} else {
			customTextarea.value = DEFAULT_CUSTOM_PATTERN;
		}
	}

	main();
};

// Use Ctrl+Enter to submit
// customTextarea.onkeyup = () => {
// 	patternSelect.value = "custom";
// };

// Global Ctrl+Enter handler
document.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.key === "Enter") {
		patternSelect.value = "custom";
		main();
	}
});

// Initialize patterns and start
loadPatterns().then(() => {
	main();
});

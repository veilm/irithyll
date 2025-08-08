// const CANVAS_WIDTH = 1920 * 3/4
const CANVAS_WIDTH = (((1080 * 4) / 3) * 3) / 4;
const CANVAS_HEIGHT = (1080 * 3) / 4;

const canvas = document.getElementById("canvas");
const customTextarea = document.getElementById("customTextarea");
const patternSelect = document.getElementById("pattern");

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d");

function setPixel(data, x, y, isOn = true) {
	// Invert so that 0 is the bottom. easier to reason about for
	// Cartesian-friends
	y = CANVAS_HEIGHT - y;

	// 4: 4 bytes (r, g, b, a) per pixel
	const i = 4 * (y * CANVAS_WIDTH + x);

	const color = isOn ? 255 : 0;
	data[i] = color; // r
	data[i + 1] = color; // g
	data[i + 2] = color; // b
	data[i + 3] = 255; // a
}

customTextarea.innerHTML = `for (let x = 0; x < CANVAS_WIDTH; x++) {

setPixel(data, x, 200);

}`;

const patterns = {
	hor_half: (data) => {
		const y = Math.round(CANVAS_HEIGHT / 2);
		for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(data, x, y);
	},
	hor_third: (data) => {
		const y = Math.round((CANVAS_HEIGHT * 2) / 3);
		for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(data, x, y);
	},
	hor_third_h2: (data) => {
		const y = Math.round((CANVAS_HEIGHT * 2) / 3);
		for (let x = 0; x < CANVAS_WIDTH; x++)
			setPixel(data, x, y), setPixel(data, x, y + 1);
	},
	hor_third_h3_split: (data) => {
		const y = Math.round((CANVAS_HEIGHT * 2) / 3);

		for (let x = 0; x < CANVAS_WIDTH; x++)
			setPixel(data, x, y - 1), setPixel(data, x, y + 1);
	},
};
const PRIMARY_PATTERN = "hor_third_h3_split";

Object.keys(patterns)
	.reverse()
	.forEach((pattern) => {
		const option = document.createElement("option");
		option.value = pattern;
		option.innerHTML = pattern;
		patternSelect.appendChild(option);
	});

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

		patterns[patternKey](data);
	}

	// draw the frame
	ctx.putImageData(frame, 0, 0);
}

patternSelect.onchange = () => {
	main();
};

// Use Ctrl+Enter to submit
customTextarea.onkeyup = () => {
	patternSelect.value = "custom";
};

// Global Ctrl+Enter handler
document.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.key === "Enter") {
		main();
	}
});

main();

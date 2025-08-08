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

customTextarea.innerHTML = `// infer it yourself

const startY = CANVAS_HEIGHT / 5;
const paddingX = CANVAS_WIDTH / 10;

for (let x = paddingX; x < CANVAS_WIDTH - paddingX; x++) {

const y = startY + (x * x) / CANVAS_WIDTH / 2;
console.log(y);

setPixel(data, x, y);
setPixel(data, x, y + 1);
setPixel(data, x, y + 2);

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
	parabola_up_0: (data) => {
		const startY = CANVAS_HEIGHT / 5;
		const paddingX = CANVAS_WIDTH / 10;

		for (let x = paddingX; x < CANVAS_WIDTH - paddingX; x++) {
			const y = startY + (x * x) / CANVAS_WIDTH / 2;
			console.log(y);

			setPixel(data, x, y);
			setPixel(data, x, y + 1);
			setPixel(data, x, y + 2);
		}
	},
	parabola_down_0: (data) => {
		const startY = (CANVAS_HEIGHT * 4) / 5;
		const paddingX = CANVAS_WIDTH / 10;

		for (let x = paddingX; x < CANVAS_WIDTH - paddingX; x++) {
			const y = startY - (x * x) / CANVAS_WIDTH / 2;
			console.log(y);

			setPixel(data, x, y);
			setPixel(data, x, y + 1);
			setPixel(data, x, y + 2);
		}
	},
	parabola_n_0: (data) => {
		const vertex = (CANVAS_HEIGHT * 4) / 5;
		const paddingX = CANVAS_WIDTH / 10;

		for (let x = paddingX; x < CANVAS_WIDTH - paddingX; x++) {
			const domain = CANVAS_WIDTH - paddingX - paddingX;
			const halfDomain = domain / 2;

			// we want our paddingX to be like a -halfDomain
			// it's a constant offset so it's just -paddingX - halfDomain
			const x2 = x - paddingX - halfDomain;

			const y = vertex - ((x2 * x2) / CANVAS_WIDTH) * 3;

			setPixel(data, x, y);
			setPixel(data, x, y + 1);
			setPixel(data, x, y + 2);
		}
	},
	parabola_u_0: (data) => {
		const vertex = (CANVAS_HEIGHT * 1) / 5;
		const paddingX = CANVAS_WIDTH / 10;

		for (let x = paddingX; x < CANVAS_WIDTH - paddingX; x++) {
			const domain = CANVAS_WIDTH - paddingX - paddingX;
			const halfDomain = domain / 2;

			// we want our paddingX to be like a -halfDomain
			// it's a constant offset so it's just -paddingX - halfDomain
			const x2 = x - paddingX - halfDomain;

			const y = vertex + ((x2 * x2) / CANVAS_WIDTH) * 3;

			setPixel(data, x, y);
			setPixel(data, x, y + 1);
			setPixel(data, x, y + 2);
		}
	},
};
const PRIMARY_PATTERN = "parabola_up_0";

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

main();

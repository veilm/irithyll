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
	line0: (data) => {
		for (let x = 0; x < CANVAS_WIDTH; x++) {
			setPixel(data, x, 200);
		}
	},
};
const PRIMARY_PATTERN_NAME = "line0";

Object.keys(patterns).forEach((pattern) => {
	const option = document.createElement("option");
	option.value = pattern;
	option.innerHTML = pattern;
	patternSelect.appendChild(option);
});

function main() {
	const frame = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
	const data = frame.data;

	patterns[PRIMARY_PATTERN_NAME](data);

	// push the frame
	ctx.putImageData(frame, 0, 0);
}

main();

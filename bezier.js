// const CANVAS_WIDTH = 1080;
// const CANVAS_HEIGHT = 1080 * (3 / 4);
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 100;

const canvas = document.getElementById("canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d");

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

function clearScreen(data) {
	for (let y = 0; y < CANVAS_HEIGHT; y++) {
		for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(data, x, y, 0);
	}
}

function main() {
	const frame = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
	const data = frame.data;

	clearScreen(data);

	for (let i = 0; i < 200; i++)
		setPixel(data, i, 50, 1)

	// draw the frame
	ctx.putImageData(frame, 0, 0);

}

main()

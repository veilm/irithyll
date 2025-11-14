// const CANVAS_WIDTH = 1080;
// const CANVAS_HEIGHT = 1080 * (3 / 4);
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 300;

const canvas = document.getElementById("canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d");

// data: always pass in direct JS form
// x: from 0 (left) to CANVAS_WIDTH (right)
// y: from 0 (top) to CANVAS_HEIGHT (bottom)
// brightness: from 0.0 to 1.0
function setPixel(data, x, y, brightness = 1, green = -1, blue = -1) {
	let r, g, b
	const a = 255

	if (green == -1 && blue == -1) {
		r = 255 * brightness
		g = 255 * brightness
		b = 255 * brightness
	} else {
		r = 255 * brightness // also functions as r otherwise
		g = 255 * green
		b = 255 * blue
		console.log(r, g, b)
	}

	r = Math.round(r)
	g = Math.round(g)
	b = Math.round(b)

	x = Math.round(x);
	y = Math.round(y);

	if (x < 0 || x > CANVAS_WIDTH || y < 0 || y > CANVAS_HEIGHT) return;

	// 4: 4 bytes (r, g, b, a) per pixel
	const i = 4 * (y * CANVAS_WIDTH + x);

	data[i] = r;
	data[i + 1] = g;
	data[i + 2] = b;
	data[i + 3] = a;
}

// input: cartesian
function setCoordinate(data, x, y, brightness = 1, green = -1, blue = -1) {
	// cartesian x goes from -CANVAS_WIDTH/2 (left) to CANVAS_WIDTH/2 (right)
	// canvas goes from 0 (left) to CANVAS_WIDTH (right)
	const canvasX = x + CANVAS_WIDTH/2;

	// cartesian y goes CANVAS_HEIGHT/2 (top) to -CANVAS_HEIGHT/2 (bottom)
	// canvas goes from 0 (top) to CANVAS_HEIGHT (bottom)
	const canvasY = CANVAS_HEIGHT/2 - y;

	setPixel(data, canvasX, canvasY, brightness, green, blue)
}

function clearScreen(data) {
	for (let y = 0; y < CANVAS_HEIGHT; y++) {
		for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(data, x, y, 0);
	}
}

const BEZIER_INPUT_POINTS = [
	{x: -150, y: 0},
	{x: 0, y: 100},
	{x: 150, y: 0},
]

function main() {
	const frame = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
	const data = frame.data;

	clearScreen(data);

	for (let i = 0; i < 600; i++)
		setPixel(data, i, 150, 0.5)

	BEZIER_INPUT_POINTS.forEach(point => {
		setCoordinate(data, point.x, point.y, 0, 1, 1)
	})

	// draw the frame
	ctx.putImageData(frame, 0, 0);
}

main()

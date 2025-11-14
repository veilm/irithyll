// const CANVAS_WIDTH = 1080;
// const CANVAS_HEIGHT = 1080 * (3 / 4);
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 300;

const canvas = document.getElementById("canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const ctx = canvas.getContext("2d");

// x: from 0 (left) to CANVAS_WIDTH (right)
// y: from 0 (top) to CANVAS_HEIGHT (bottom)
// brightness: from 0.0 to 1.0
function setPixel(x, y, brightness = 1, green = -1, blue = -1) {
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
	}

	r = Math.round(r)
	g = Math.round(g)
	b = Math.round(b)

	x = Math.round(x);
	y = Math.round(y);

	if (x < 0 || x > CANVAS_WIDTH || y < 0 || y > CANVAS_HEIGHT) return;

	// 4: 4 bytes (r, g, b, a) per pixel
	const i = 4 * (y * CANVAS_WIDTH + x);

	STATE.data[i] = r;
	STATE.data[i + 1] = g;
	STATE.data[i + 2] = b;
	STATE.data[i + 3] = a;
}

// input: cartesian
function setCoordinate(x, y, brightness = 1, green = -1, blue = -1) {
	// cartesian x goes from -CANVAS_WIDTH/2 (left) to CANVAS_WIDTH/2 (right)
	// canvas goes from 0 (left) to CANVAS_WIDTH (right)
	const canvasX = x + CANVAS_WIDTH/2;

	// cartesian y goes CANVAS_HEIGHT/2 (top) to -CANVAS_HEIGHT/2 (bottom)
	// canvas goes from 0 (top) to CANVAS_HEIGHT (bottom)
	const canvasY = CANVAS_HEIGHT/2 - y;

	setPixel(canvasX, canvasY, brightness, green, blue)
}

function clearScreen() {
	for (let y = 0; y < CANVAS_HEIGHT; y++) {
		for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(x, y, 0);
	}
}

// "[0] and [-1] technically ar-" shut up
const BEZIER_CONTROL_POINTS = [
	// {x: -150, y: 0},
	{x: -250, y: 0},
	{x: 0, y: 100},
	{x: 50, y: 0},
	{x: 150, y: 100},
]

const BEZIER_STEPS = 600;

const STATE = {
	bezierStep: 0,
	frame: null,
	data: null,
}

function renderControlPoints() {
	BEZIER_CONTROL_POINTS.forEach(point => {
		setCoordinate(point.x, point.y, 1, 0, 0)
	})
}

function renderBezierStep(t, points, depth) {
	const scaffolds = []

	for (let i = 0; i < points.length - 1; i++) {
		const x1 = points[i].x
		const x2 = points[i+1].x
		const y1 = points[i].y
		const y2 = points[i+1].y

		const scaffoldX = (x2 - x1) * t + x1;
		const scaffoldY = (y2 - y1) * t + y1;

		if (points.length == 2) setCoordinate(scaffoldX, scaffoldY, 1, 0, 0)
		else setCoordinate(scaffoldX, scaffoldY, 0.5)

		scaffolds.push({x: scaffoldX, y: scaffoldY})
	}

	const newPoints = []

	for (let i = 0; i < scaffolds.length - 1; i++) {
		const x1 = scaffolds[i].x
		const x2 = scaffolds[i+1].x
		const y1 = scaffolds[i].y
		const y2 = scaffolds[i+1].y

		const newX = (x2 - x1) * t + x1;
		const newY = (y2 - y1) * t + y1;
		newPoints.push({x: newX, y: newY})

		setCoordinate(newX, newY, 0.75)
	}

	if (newPoints.length > 1) {
		renderBezierStep(t, newPoints, depth+1)
	}
}

function renderBezierFullStep() {
	const t = STATE.bezierStep/BEZIER_STEPS

	renderBezierStep(t, BEZIER_CONTROL_POINTS, 0)
	renderControlPoints()

	ctx.putImageData(STATE.frame, 0, 0);
}

function init() {
	STATE.frame = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
	STATE.data = STATE.frame.data;

	clearScreen();

	renderBezierFullStep()

	// draw the frame
	ctx.putImageData(STATE.frame, 0, 0);
}

document.addEventListener("keydown", (e) => {
	if (e.key === "n") {
		// clearScreen();
		STATE.bezierStep += 1
		document.getElementById("step").innerHTML = STATE.bezierStep

		renderBezierFullStep()
	}
});

init()

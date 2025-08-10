grid(data);

function linearLine(x1, y1, x2, y2) {
	function mainLinear() {
		/*
y = mx + b

y1 = mx1 + b
b = y1 - mx1
b = y2 - mx2

y1 - mx1 = y2 - mx2
y1 - y2 = mx1 - mx2
m(x1 - x2) = y1 - y2
m = (y1 - y2)/(x1 - x2)
*/

		const m = (y1 - y2) / (x1 - x2);
		const b = y2 - m * x2;

		const lesserX = x1 < x2 ? x1 : x2;
		const greaterX = x1 + x2 - lesserX;

		for (let x = lesserX; x < greaterX; x++) {
			const y = m * x + b;
			setPixel(data, x, y);
			setPixel(data, x, y + 1);
			setPixel(data, x, y - 1);
		}
	}

	if (x1 == x2) {
		const lessY = y1 < y2 ? y1 : y2;
		const moreY = y1 + y2 - lessY;

		for (let y = lessY; y < moreY; y++) setPixel(data, x1, y);

		return;
	}

	mainLinear();
}

linearLine(
	CANVAS_WIDTH / 12,
	CANVAS_HEIGHT / 9,
	(CANVAS_WIDTH * 5) / 12,
	(CANVAS_HEIGHT * 8) / 9,
);

linearLine(
	CANVAS_WIDTH / 2,
	CANVAS_HEIGHT / 18,
	CANVAS_WIDTH / 2,
	(CANVAS_HEIGHT * 17) / 18,
);

// CREATED=1754788468

const startY = (CANVAS_HEIGHT * 4) / 5;
const paddingX = CANVAS_WIDTH / 10;

for (let x = paddingX; x < CANVAS_WIDTH - paddingX; x++) {
	const y = startY - (x * x) / CANVAS_WIDTH / 2;
	console.log(y);

	setPixel(data, x, y);
	setPixel(data, x, y + 1);
	setPixel(data, x, y + 2);
}

// CREATED=1754785560

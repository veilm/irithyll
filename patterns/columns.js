const gridCols = 12;
const gridRows = (12 * 3) / 4;

for (let i = 0; i < gridCols; i++) {
	const x = i * (CANVAS_WIDTH / gridCols);

	for (let y = 0; y < CANVAS_HEIGHT; y++) setPixel(data, x, y);
}

// CREATED=1754786735

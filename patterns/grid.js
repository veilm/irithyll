const gridCols = 12;
const gridRows = (12 * 3) / 4;

for (let i = 0; i < gridCols; i++) {
	const x = i * (CANVAS_WIDTH / gridCols);

	for (let y = 0; y < CANVAS_HEIGHT; y++) setPixel(data, x, y);
}

for (let i = 0; i < gridRows; i++) {
	const y = i * (CANVAS_HEIGHT / gridRows);

	for (let x = 0; x < CANVAS_WIDTH; x++) setPixel(data, x, y);
}

// CREATED=1754786790

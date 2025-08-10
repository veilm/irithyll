const y = Math.round((CANVAS_HEIGHT * 2) / 3);
for (let x = 0; x < CANVAS_WIDTH; x++)
	setPixel(data, x, y), setPixel(data, x, y + 1);

// CREATED=1754785535

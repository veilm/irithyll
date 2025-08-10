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

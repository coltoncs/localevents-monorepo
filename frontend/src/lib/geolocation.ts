export function getCurrentPosition(): Promise<GeolocationCoordinates> {
	return new Promise((resolve, reject) => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			reject(new Error("Geolocation unavailable"));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => resolve(pos.coords),
			(err) => reject(err),
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
		);
	});
}

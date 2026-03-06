package scraper

// NCCities is the hardcoded list of NC cities to scrape events for.
var NCCities = []Location{
	{Name: "Raleigh", Latitude: 35.7796, Longitude: -78.6382, RadiusKM: 40},
	{Name: "Durham", Latitude: 35.9940, Longitude: -78.8986, RadiusKM: 30},
	{Name: "Charlotte", Latitude: 35.2271, Longitude: -80.8431, RadiusKM: 50},
	{Name: "Greensboro", Latitude: 36.0726, Longitude: -79.7920, RadiusKM: 30},
	{Name: "Wilmington", Latitude: 34.2257, Longitude: -77.9447, RadiusKM: 30},
	{Name: "Asheville", Latitude: 35.5951, Longitude: -82.5515, RadiusKM: 30},
	{Name: "Chapel Hill", Latitude: 35.9132, Longitude: -79.0558, RadiusKM: 20},
	{Name: "Fayetteville", Latitude: 35.0527, Longitude: 78.8784, RadiusKM: 30},
}

var VACities = []Location{
	{Name: "Richmond", Latitude: 37.5407, Longitude: -77.4360, RadiusKM: 50},
	{Name: "Virginia Beach", Latitude: 36.8516, Longitude: -75.9780, RadiusKM: 30},
	{Name: "Norfolk", Latitude: 36.8508, Longitude: -76.2859, RadiusKM: 30},
	{Name: "Charlottesville", Latitude: 38.0293, Longitude: -78.4767, RadiusKM: 30},
	{Name: "Roanoke", Latitude: 37.2710, Longitude: -79.9414, RadiusKM: 30},
}

var SCCities = []Location{
	{Name: "Charleston", Latitude: 32.7765, Longitude: -79.9311, RadiusKM: 40},
	{Name: "Columbia", Latitude: 34.0007, Longitude: -81.0348, RadiusKM: 40},
	{Name: "Greenville", Latitude: 34.8526, Longitude: -82.3940, RadiusKM: 30},
	{Name: "Myrtle Beach", Latitude: 33.6891, Longitude: -78.8867, RadiusKM: 30},
}

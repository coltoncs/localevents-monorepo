export interface Event {
	ID: string;
	ExternalID?: string;
	Source: string;
	Title: string;
	Description?: string;
	VenueName?: string;
	Address?: string;
	City?: string;
	State?: string;
	Zip?: string;
	Latitude: number;
	Longitude: number;
	StartTime: string;
	EndTime?: string;
	Categories?: string[];
	Genre?: string[];
	ImageUrl?: string;
	TicketUrl?: string;
	PriceMin?: number;
	PriceMax?: number;
	IsFree?: boolean;
	IsFeatured?: boolean;
	FeaturedAt?: string;
	FeaturedBy?: string;
	SubmittedBy?: string;
	VenueID?: string;
	SeriesID?: string;
	CreatedAt: string;
	UpdatedAt: string;
}

export interface User {
	ID: string;
	ClerkID: string;
	Username?: string;
	Email?: string;
	DefaultLatitude?: number;
	DefaultLongitude?: number;
	DefaultRadiusMiles?: number;
	CreatedAt: string;
	UpdatedAt: string;
}

export interface SavedEvent {
	ID: string;
	UserID: string;
	EventID: string;
	CreatedAt: string;
}

export interface EventListResponse {
	events: Event[];
	total: number;
}

export interface MapEventListResponse {
	events: Event[];
}

export interface FeaturedEventsResponse {
	events: Event[];
}

export interface FeaturedEventsFilters {
	lat: number;
	lng: number;
	radius?: number;
	limit?: number;
}

export interface FeatureQuota {
	used: number;
	limit: number;
	remaining: number;
	unlimited: boolean;
}

export interface MapEventFilters {
	lat: number;
	lng: number;
	radius?: number;
	date?: string;
	endDate?: string;
	category?: string;
	genre?: string; // single music genre for filtering
	venueName?: string;
	venueId?: string;
	search?: string;
}

export interface EventFilters {
	lat: number;
	lng: number;
	radius?: number;
	date?: string;
	endDate?: string;
	category?: string; // single category for filtering
	genre?: string; // single music genre for filtering
	venueName?: string;
	venueId?: string;
	search?: string;
	limit?: number;
	page?: number;
}

export interface CreateEventInput {
	title: string;
	description?: string;
	venue_name?: string;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	latitude: number;
	longitude: number;
	start_time: string;
	end_time?: string;
	categories?: string[];
	genre?: string[];
	image_url?: string;
	ticket_url?: string;
	price_min?: number;
	price_max?: number;
	is_free?: boolean;
	venue_id?: string;
	series_id?: string;
}

export interface Venue {
	ID: string;
	VenueName: string;
	Address: string;
	City: string;
	State: string;
	Zip: string;
	Latitude: number;
	Longitude: number;
	Hours?: string;
	Description?: string;
	Genres?: string[];
	BookingEmail?: string;
	AcceptsBookingRequests?: boolean;
	IsClaimed?: boolean;
}

export interface VenueListResponse {
	venues: Venue[];
}

export interface UpdateVenueInput {
	name: string;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	latitude: number;
	longitude: number;
	hours?: string;
	description?: string;
	genres?: string[];
	booking_email?: string;
	accepts_booking_requests?: boolean;
}

export interface VenueClaim {
	ID: string;
	ClerkID: string;
	VenueID?: string;
	VenueName: string;
	Address?: string;
	City?: string;
	State?: string;
	Zip?: string;
	Latitude?: number;
	Longitude?: number;
	ContactName: string;
	ContactEmail: string;
	BookingEmail?: string;
	Message?: string;
	Status: "pending" | "approved" | "rejected";
	SubmittedAt: string;
	ReviewedAt?: string;
	ReviewedBy?: string;
	ReviewNotes?: string;
}

export interface SubmitVenueClaimInput {
	/** Set when claiming an existing venue; omit to propose a new one. */
	venue_id?: string;
	venue_name: string;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	latitude?: number;
	longitude?: number;
	contact_name: string;
	contact_email: string;
	booking_email?: string;
	message?: string;
}

export interface BookingRequestInput {
	name: string;
	email: string;
	message: string;
}

export interface Artist {
	ID: string;
	Name: string;
	Bio?: string;
	Genres?: string[];
	ImageUrl?: string;
	WebsiteUrl?: string;
	SpotifyUrl?: string;
	InstagramUrl?: string;
	BandcampUrl?: string;
	YoutubeUrl?: string;
	HometownCity?: string;
	HometownState?: string;
	OwnerUserID?: string;
	Source: string;
	IsClaimed?: boolean;
	CreatedAt: string;
	UpdatedAt: string;
}

export interface ArtistListResponse {
	artists: Artist[];
}

export interface ArtistEventsResponse {
	events: Event[];
}

export interface CreateArtistInput {
	name: string;
	bio?: string;
	genres?: string[];
	image_url?: string;
	website_url?: string;
	spotify_url?: string;
	instagram_url?: string;
	bandcamp_url?: string;
	youtube_url?: string;
	hometown_city?: string;
	hometown_state?: string;
}

export type Cuisine = string;
export type BarType = "brewery" | "bar";

export interface Place {
	ID: string;
	Name: string;
	IsFood: boolean;
	IsDrink: boolean;
	Cuisine?: Cuisine;
	BarType?: BarType;
	Address: string;
	City: string;
	State: string;
	Zip: string;
	Latitude: number;
	Longitude: number;
	Phone?: string;
	Website?: string;
	Hours?: string;
	Description?: string;
	Review?: string;
	ImageUrl?: string;
	Tags?: string[];
	PriceLevel?: number;
}

export interface PlaceListResponse {
	places: Place[];
}

export interface PlaceFilters {
	lat: number;
	lng: number;
	radius?: number;
	isFood?: boolean;
	isDrink?: boolean;
	cuisine?: Cuisine[];
	barType?: BarType[];
	minPrice?: number;
	maxPrice?: number;
	search?: string;
}

export interface CreatePlaceInput {
	name: string;
	is_food: boolean;
	is_drink: boolean;
	cuisine?: Cuisine;
	bar_type?: BarType;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	latitude: number;
	longitude: number;
	phone?: string;
	website?: string;
	hours?: string;
	description?: string;
	review?: string;
	image_url?: string;
	tags?: string[];
	price_level?: number;
}

export interface UpdateUserInput {
	default_latitude?: number;
	default_longitude?: number;
	default_radius_miles?: number;
}

export interface AuthorApplication {
	ID: string;
	ClerkID: string;
	FullName: string;
	Email: string;
	Bio: string;
	Experience: string;
	Status: "pending" | "approved" | "rejected";
	SubmittedAt: string;
	ReviewedAt?: string;
	ReviewedBy?: string;
	ReviewNotes?: string;
}

export interface SubmitApplicationInput {
	full_name: string;
	email: string;
	bio: string;
	experience: string;
}

export interface UserImage {
	ID: string;
	UserID: string;
	R2Key: string;
	Url: string;
	Filename: string;
	ContentType: string;
	SizeBytes: number | null;
	CreatedAt: string;
}

export interface PresignResponse {
	upload_url: string;
	public_url: string;
	key: string;
}

export interface NotificationPreferences {
	email_enabled: boolean;
	sms_enabled: boolean;
	phone_number?: string;
	has_subscription: boolean;
	preferred_categories: string[];
	digest_format: "daily" | "bulk";
	email_style: "detailed" | "compact";
}

export interface UpdateNotificationInput {
	email_enabled: boolean;
	sms_enabled: boolean;
	phone_number?: string;
	preferred_categories: string[];
	digest_format: "daily" | "bulk";
	email_style: "detailed" | "compact";
}

export interface MyPlaceCheckIn {
	id: string;
	place_id: string;
	place_name: string;
	is_food: boolean;
	is_drink: boolean;
	cuisine?: Cuisine;
	bar_type?: BarType;
	place_city?: string;
	place_image_url?: string;
	checkin_date: string;
	created_at: string;
}

export interface MyPlaceCheckInStats {
	total_checkins: number;
	unique_places: number;
	unique_foods: number;
	unique_breweries: number;
	unique_bars: number;
	first_checkin_date?: string;
	last_checkin_date?: string;
}

export interface MyPlaceCheckInsResponse {
	stats: MyPlaceCheckInStats;
	checkins: MyPlaceCheckIn[];
}

export type SuggestionAction = "edit" | "create" | "delete";

export interface EditSuggestion {
	ID: string;
	TargetType: "event" | "venue" | "place";
	TargetID?: string;
	SubmittedBy: string;
	Action: SuggestionAction;
	Reason?: string;
	ProposedChanges: Record<string, unknown>;
	Status: "pending" | "approved" | "rejected";
	ReviewNotes?: string;
	ReviewedBy?: string;
	CreatedAt: string;
	ReviewedAt?: string;
	TargetName?: string;
}

export interface CreateEditSuggestionInput {
	target_type: "event" | "venue" | "place";
	target_id?: string;
	action?: SuggestionAction;
	reason?: string;
	proposed_changes: Record<string, unknown>;
	/** Hidden anti-spam field; real users leave it blank. */
	hp?: string;
}

export interface AdminStats {
	total_users: number;
	new_users_this_week: number;
	weekly_active_users: number;
	email_subscribers: number;
	sms_subscribers: number;
	total_upcoming_events: number;
	total_venues: number;
	total_saved_events: number;
	pending_suggestions: number;
	pending_applications: number;
	events_by_source: { source: string; count: number }[];
	authors: { name: string; email: string; event_count: number }[];
	recent_digests: {
		sent: number;
		failed: number;
		total_events_included: number;
	};
	last_scrape: {
		ran_at: string;
		items_affected: number;
		details?: Record<string, number>;
	} | null;
	last_cleanup: {
		ran_at: string;
		items_affected: number;
		details?: Record<string, number>;
	} | null;
}

// Weekly daily-planner itinerary (GET /api/me/planner).
export interface PlanItem {
	event_id: string;
	title: string;
	start_time: string; // RFC3339 (ET)
	time_label: string; // e.g. "7:30 PM"
	venue_name?: string;
	category?: string;
	image_url?: string;
	event_url: string;
	distance_miles: number;
}

export interface PlanDay {
	date: string; // YYYY-MM-DD
	weekday: string; // e.g. "Monday, January 2"
	items: PlanItem[];
}

export interface WeeklyPlan {
	week_of: string;
	days: PlanDay[];
}

export interface PlannerResponse {
	status: "ready" | "none";
	week_of?: string;
	generated_at?: string;
	created_at?: string;
	plan?: WeeklyPlan;
}

export interface CreateSharedPlanResponse {
	token: string;
}

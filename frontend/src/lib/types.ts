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
	ImageUrl?: string;
	TicketUrl?: string;
	PriceMin?: number;
	PriceMax?: number;
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

export interface EventFilters {
	lat: number;
	lng: number;
	radius?: number;
	date?: string;
	endDate?: string;
	category?: string; // single category for filtering
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
	image_url?: string;
	ticket_url?: string;
	price_min?: number;
	price_max?: number;
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
}

export interface Beverage {
	ID: string;
	Name: string;
	Type: "brewery" | "bar";
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

export interface BeverageListResponse {
	beverages: Beverage[];
}

export interface BeverageFilters {
	lat: number;
	lng: number;
	radius?: number;
	type?: "brewery" | "bar";
	search?: string;
}

export interface CreateBeverageInput {
	name: string;
	type: "brewery" | "bar";
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

export type Cuisine =
	| "american"
	| "italian"
	| "mexican"
	| "chinese"
	| "japanese"
	| "korean"
	| "thai"
	| "vietnamese"
	| "indian"
	| "mediterranean"
	| "middle_eastern"
	| "french"
	| "bbq"
	| "pizza"
	| "seafood"
	| "vegan"
	| "cafe"
	| "bakery"
	| "dessert"
	| "other";

export interface Food {
	ID: string;
	Name: string;
	Cuisine: Cuisine;
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

export interface FoodListResponse {
	foods: Food[];
}

export interface FoodFilters {
	lat: number;
	lng: number;
	radius?: number;
	cuisine?: Cuisine[];
	minPrice?: number;
	maxPrice?: number;
	search?: string;
}

export interface CreateFoodInput {
	name: string;
	cuisine: Cuisine;
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

export interface MyFoodCheckIn {
	id: string;
	food_id: string;
	food_name: string;
	food_cuisine: Cuisine;
	food_city?: string;
	food_image_url?: string;
	checkin_date: string;
	created_at: string;
}

export interface MyFoodCheckInStats {
	total_checkins: number;
	unique_restaurants: number;
	first_checkin_date?: string;
	last_checkin_date?: string;
}

export interface MyFoodCheckInsResponse {
	stats: MyFoodCheckInStats;
	checkins: MyFoodCheckIn[];
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

export interface MyCheckIn {
	id: string;
	beverage_id: string;
	beverage_name: string;
	beverage_type: "brewery" | "bar";
	beverage_city?: string;
	beverage_image_url?: string;
	checkin_date: string;
	created_at: string;
}

export interface MyCheckInStats {
	total_checkins: number;
	unique_venues: number;
	unique_breweries: number;
	unique_bars: number;
	first_checkin_date?: string;
	last_checkin_date?: string;
}

export interface MyCheckInsResponse {
	stats: MyCheckInStats;
	checkins: MyCheckIn[];
}

export type SuggestionAction = "edit" | "create" | "delete";

export interface EditSuggestion {
	ID: string;
	TargetType: "event" | "venue" | "beverage" | "food";
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
	target_type: "event" | "venue" | "beverage" | "food";
	target_id?: string;
	action?: SuggestionAction;
	reason?: string;
	proposed_changes: Record<string, unknown>;
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

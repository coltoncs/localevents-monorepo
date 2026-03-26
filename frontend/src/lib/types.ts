export interface Event {
  ID: string
  ExternalID?: string
  Source: string
  Title: string
  Description?: string
  VenueName?: string
  Address?: string
  City?: string
  State?: string
  Zip?: string
  Latitude: number
  Longitude: number
  StartTime: string
  EndTime?: string
  Categories?: string[]
  ImageUrl?: string
  TicketUrl?: string
  PriceMin?: number
  PriceMax?: number
  SubmittedBy?: string
  VenueID?: string
  CreatedAt: string
  UpdatedAt: string
}

export interface User {
  ID: string
  ClerkID: string
  Username?: string
  Email?: string
  DefaultLatitude?: number
  DefaultLongitude?: number
  DefaultRadiusMiles?: number
  CreatedAt: string
  UpdatedAt: string
}

export interface SavedEvent {
  ID: string
  UserID: string
  EventID: string
  CreatedAt: string
}

export interface EventListResponse {
  events: Event[]
  total: number
}

export interface EventFilters {
  lat: number
  lng: number
  radius?: number
  date?: string
  endDate?: string
  category?: string // single category for filtering
  venueName?: string
  venueId?: string
  search?: string
  limit?: number
  page?: number
}

export interface CreateEventInput {
  title: string
  description?: string
  venue_name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  latitude: number
  longitude: number
  start_time: string
  end_time?: string
  categories?: string[]
  image_url?: string
  ticket_url?: string
  price_min?: number
  price_max?: number
  venue_id?: string
}

export interface Venue {
  ID: string
  VenueName: string
  Address: string
  City: string
  State: string
  Zip: string
  Latitude: number
  Longitude: number
  Hours?: string
  Description?: string
}

export interface VenueListResponse {
  venues: Venue[]
}

export interface UpdateVenueInput {
  name: string
  address?: string
  city?: string
  state?: string
  zip?: string
  latitude: number
  longitude: number
  hours?: string
  description?: string
}

export interface UpdateUserInput {
  default_latitude?: number
  default_longitude?: number
  default_radius_miles?: number
}

export interface AuthorApplication {
  ID: string
  ClerkID: string
  FullName: string
  Email: string
  Bio: string
  Experience: string
  Status: 'pending' | 'approved' | 'rejected'
  SubmittedAt: string
  ReviewedAt?: string
  ReviewedBy?: string
  ReviewNotes?: string
}

export interface SubmitApplicationInput {
  full_name: string
  email: string
  bio: string
  experience: string
}

export interface UserImage {
  ID: string
  UserID: string
  R2Key: string
  Url: string
  Filename: string
  ContentType: string
  SizeBytes: number | null
  CreatedAt: string
}

export interface PresignResponse {
  upload_url: string
  public_url: string
  key: string
}

export interface NotificationPreferences {
  email_enabled: boolean
  sms_enabled: boolean
  phone_number?: string
  has_subscription: boolean
  preferred_categories: string[]
}

export interface UpdateNotificationInput {
  email_enabled: boolean
  sms_enabled: boolean
  phone_number?: string
  preferred_categories: string[]
}

export interface EditSuggestion {
  ID: string
  TargetType: 'event' | 'venue'
  TargetID: string
  SubmittedBy: string
  ProposedChanges: Record<string, unknown>
  Status: 'pending' | 'approved' | 'rejected'
  ReviewNotes?: string
  ReviewedBy?: string
  CreatedAt: string
  ReviewedAt?: string
  TargetName?: string
}

export interface CreateEditSuggestionInput {
  target_type: 'event' | 'venue'
  target_id: string
  proposed_changes: Record<string, unknown>
}

-- Music genre tags for events, parallel to categories[]. Populated from source
-- classifications (Ticketmaster genre/sub-genre, SeatGeek performer genres) at
-- scrape time and from the genre input on user-submitted events. Nullable with
-- an empty-array default, like categories.
-- IF NOT EXISTS guards against dev databases that picked up a stray genre
-- column from earlier exploratory work; no-op there, real add everywhere else.
ALTER TABLE events ADD COLUMN IF NOT EXISTS genre TEXT[] DEFAULT '{}';

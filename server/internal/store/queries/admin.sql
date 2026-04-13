-- name: AdminCountUsers :one
SELECT COUNT(*) FROM users;

-- name: AdminCountNewUsersThisWeek :one
SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days';

-- name: AdminCountWeeklyActiveUsers :one
SELECT COUNT(DISTINCT user_id)::bigint FROM (
  SELECT user_id FROM saved_events WHERE created_at > NOW() - INTERVAL '7 days'
  UNION
  SELECT submitted_by AS user_id FROM edit_suggestions WHERE created_at > NOW() - INTERVAL '7 days'
) active_users;

-- name: AdminCountEmailSubscribers :one
SELECT COUNT(*) FROM notification_preferences np
JOIN users u ON np.user_id = u.id
WHERE np.email_enabled = TRUE AND u.email IS NOT NULL;

-- name: AdminCountSMSSubscribers :one
SELECT COUNT(*) FROM notification_preferences np
JOIN users u ON np.user_id = u.id
WHERE np.sms_enabled = TRUE AND u.phone_number IS NOT NULL;

-- name: AdminCountUpcomingEvents :one
SELECT COUNT(*) FROM events WHERE start_time >= NOW();

-- name: AdminCountVenues :one
SELECT COUNT(*) FROM venues;

-- name: AdminCountSavedEvents :one
SELECT COUNT(*) FROM saved_events;

-- name: AdminEventsBySource :many
SELECT source, COUNT(*)::bigint AS count FROM events
WHERE start_time >= NOW()
GROUP BY source ORDER BY count DESC;

-- name: AdminListAuthorsWithEventCounts :many
SELECT
  COALESCE(aa.full_name, u.username, u.email, u.clerk_id) AS name,
  COALESCE(u.email, '') AS email,
  COUNT(e.id) FILTER (WHERE e.start_time >= NOW())::bigint AS event_count
FROM users u
JOIN events e ON e.submitted_by = u.id
LEFT JOIN author_applications aa ON aa.clerk_id = u.clerk_id AND aa.status = 'approved'
GROUP BY u.id, u.username, u.email, u.clerk_id, aa.full_name
ORDER BY event_count DESC;

-- name: AdminRecentDigestStats :one
SELECT
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE status = 'sent')::bigint AS sent,
  COUNT(*) FILTER (WHERE status != 'sent')::bigint AS failed,
  COALESCE(SUM(event_count) FILTER (WHERE status = 'sent'), 0)::bigint AS total_events_included
FROM notification_log
WHERE sent_at > NOW() - INTERVAL '7 days';

-- name: AdminCountPendingSuggestions :one
SELECT COUNT(*) FROM edit_suggestions WHERE status = 'pending';

-- name: AdminCountPendingApplications :one
SELECT COUNT(*) FROM author_applications WHERE status = 'pending';

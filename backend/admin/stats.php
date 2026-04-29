<?php
require_once __DIR__ . '/middleware.php';
cors();
$admin = requireAuth();
$db    = getDB();

// Total registrations
$total = (int)$db->query("SELECT COUNT(*) FROM registrations")->fetchColumn();

// This week
$thisWeek = (int)$db->query("SELECT COUNT(*) FROM registrations WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetchColumn();

// By status
$statusRows = $db->query("SELECT status, COUNT(*) AS cnt FROM registrations GROUP BY status")->fetchAll();
$byStatus   = [];
foreach ($statusRows as $r) { $byStatus[$r['status']] = (int)$r['cnt']; }

// By unit (top 10)
$byUnit = $db->query("
    SELECT unit_name, COUNT(*) AS cnt
    FROM registrations
    GROUP BY unit_name
    ORDER BY cnt DESC
    LIMIT 10
")->fetchAll();

// By sex
$bySex = $db->query("SELECT sex, COUNT(*) AS cnt FROM registrations GROUP BY sex")->fetchAll();

// Daily trend last 14 days
$trend = $db->query("
    SELECT DATE(submitted_at) AS day, COUNT(*) AS cnt
    FROM registrations
    WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
    GROUP BY DATE(submitted_at)
    ORDER BY day ASC
")->fetchAll();

// Active units
$activeUnits = (int)$db->query("SELECT COUNT(*) FROM service_units WHERE is_active = 1")->fetchColumn();

// Total admins
$totalAdmins = (int)$db->query("SELECT COUNT(*) FROM admin_users WHERE is_active = 1")->fetchColumn();

// Recent activity (last 10)
$recentActivity = $db->query("
    SELECT id, admin_name, action, entity_type, description, created_at
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT 10
")->fetchAll();

json_out([
    'totals' => [
        'registrations' => $total,
        'this_week'     => $thisWeek,
        'active_units'  => $activeUnits,
        'total_admins'  => $totalAdmins,
        'pending'       => $byStatus['pending']    ?? 0,
        'approved'      => $byStatus['approved']   ?? 0,
        'rejected'      => $byStatus['rejected']   ?? 0,
        'waitlisted'    => $byStatus['waitlisted'] ?? 0,
    ],
    'by_unit'          => $byUnit,
    'by_sex'           => $bySex,
    'by_status'        => $byStatus,
    'trend'            => $trend,
    'recent_activity'  => $recentActivity,
]);

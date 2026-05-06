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

// Daily trend: dense series (7–365 days) for dashboard charts — optional ?trend_days=
$trendDays = min(365, max(7, (int) ($_GET['trend_days'] ?? 365)));
$interval  = max(0, $trendDays - 1);
$stmt = $db->prepare("
    SELECT DATE(submitted_at) AS day,
      COUNT(*) AS cnt,
      SUM(CASE WHEN status IN ('pending','waitlisted','new','in_progress') THEN 1 ELSE 0 END) AS open_cnt,
      SUM(CASE WHEN status IN ('approved','rejected','accepted','archived') THEN 1 ELSE 0 END) AS closed_cnt
    FROM registrations
    WHERE submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE(submitted_at)
    ORDER BY day ASC
");
$stmt->bindValue(1, $interval, PDO::PARAM_INT);
$stmt->execute();
$byDay = [];
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $byDay[$r['day']] = [
        'cnt'    => (int) $r['cnt'],
        'open'   => (int) $r['open_cnt'],
        'closed' => (int) $r['closed_cnt'],
    ];
}
$trend = [];
for ($i = $interval; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime('-' . $i . ' days'));
    $row       = $byDay[$d] ?? ['cnt' => 0, 'open' => 0, 'closed' => 0];
    $trend[] = [
        'day'    => $d,
        'cnt'    => $row['cnt'],
        'open'   => $row['open'],
        'closed' => $row['closed'],
    ];
}

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

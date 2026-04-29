<?php
require_once __DIR__ . '/middleware.php';
cors();
requireAuth();
$db = getDB();

$action    = $_GET['action']    ?? null;
$adminId   = isset($_GET['admin_id']) ? (int)$_GET['admin_id'] : null;
$entity    = $_GET['entity']    ?? null;
$from      = $_GET['from']      ?? null;
$to        = $_GET['to']        ?? null;
$search    = trim($_GET['search'] ?? '');
$page      = max(1, (int)($_GET['page']     ?? 1));
$perPage   = min(200, max(1, (int)($_GET['per_page'] ?? 50)));
$offset    = ($page - 1) * $perPage;

$where  = ['1=1'];
$params = [];

if ($action)  { $where[] = 'action LIKE :action'; $params[':action'] = '%'.$action.'%'; }
if ($adminId) { $where[] = 'admin_id = :admin_id'; $params[':admin_id'] = $adminId; }
if ($entity)  { $where[] = 'entity_type = :entity'; $params[':entity'] = $entity; }
if ($from)    { $where[] = 'DATE(created_at) >= :from'; $params[':from'] = $from; }
if ($to)      { $where[] = 'DATE(created_at) <= :to'; $params[':to'] = $to; }
if ($search)  { $where[] = '(description LIKE :s OR admin_name LIKE :s)'; $params[':s'] = '%'.$search.'%'; }

$w = implode(' AND ', $where);

$total = (int)$db->prepare("SELECT COUNT(*) FROM activity_logs WHERE $w")->execute($params) ? null : null;
$cs = $db->prepare("SELECT COUNT(*) FROM activity_logs WHERE $w"); $cs->execute($params); $total = (int)$cs->fetchColumn();

$params[':lim'] = $perPage; $params[':off'] = $offset;
$stmt = $db->prepare("SELECT * FROM activity_logs WHERE $w ORDER BY created_at DESC LIMIT :lim OFFSET :off");
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Unique admins for filter dropdown
$admins = $db->query("SELECT DISTINCT admin_id, admin_name FROM activity_logs WHERE admin_id IS NOT NULL ORDER BY admin_name")->fetchAll();

json_out([
    'data'       => $rows,
    'admins'     => $admins,
    'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'pages' => (int)ceil($total / $perPage)],
]);

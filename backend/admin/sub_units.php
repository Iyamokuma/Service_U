<?php
require_once __DIR__ . '/middleware.php';
cors();
requireSuperAdmin();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $b      = body();
    $unitId = (int)($b['unit_id'] ?? 0);
    $name   = trim($b['name'] ?? '');
    if (!$unitId || !$name) { json_out(['error' => 'unit_id and name required'], 422); }
    $db->prepare("INSERT INTO sub_units (unit_id, name, sort_order) VALUES (:u,:n,:s)")
       ->execute([':u'=>$unitId, ':n'=>$name, ':s'=>(int)($b['sort_order']??0)]);
    json_out(['success' => true, 'id' => (int)$db->lastInsertId()]);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    $b  = body();
    if (!$id) { json_out(['error' => 'Missing id'], 422); }
    $db->prepare("UPDATE sub_units SET name=:n, is_active=:a, sort_order=:s WHERE id=:id")
       ->execute([':n'=>trim($b['name']??''), ':a'=>(int)($b['is_active']??1), ':s'=>(int)($b['sort_order']??0), ':id'=>$id]);
    json_out(['success' => true]);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { json_out(['error' => 'Missing id'], 422); }
    $db->prepare("DELETE FROM sub_units WHERE id=:id")->execute([':id'=>$id]);
    json_out(['success' => true]);
}

json_out(['error' => 'Method not allowed'], 405);

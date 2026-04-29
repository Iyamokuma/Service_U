<?php
require_once __DIR__ . '/middleware.php';
cors();
$admin  = requireAuth();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET: list all units with their sub-units ───────────────────────────────
if ($method === 'GET') {
    $units = $db->query("SELECT * FROM service_units ORDER BY sort_order, id")->fetchAll();
    $subs  = $db->query("SELECT * FROM sub_units ORDER BY unit_id, sort_order, id")->fetchAll();
    $subsByUnit = [];
    foreach ($subs as $s) { $subsByUnit[$s['unit_id']][] = $s; }
    foreach ($units as &$u) { $u['sub_units'] = $subsByUnit[$u['id']] ?? []; }
    json_out(['data' => $units]);
}

// ── POST: create unit ──────────────────────────────────────────────────────
if ($method === 'POST') {
    requireSuperAdmin();
    $b = body();
    $name = trim($b['name'] ?? '');
    if (!$name) { json_out(['error' => 'Name is required'], 422); }
    $db->prepare("INSERT INTO service_units (name, description, coordinator, sort_order) VALUES (:n,:d,:c,:s)")
       ->execute([':n' => $name, ':d' => $b['description'] ?? null, ':c' => $b['coordinator'] ?? null, ':s' => (int)($b['sort_order'] ?? 0)]);
    $newId = (int)$db->lastInsertId();
    logActivity($admin, 'unit.create', 'unit', $newId, "Created service unit: $name");
    json_out(['success' => true, 'id' => $newId]);
}

// ── PUT: update unit ───────────────────────────────────────────────────────
if ($method === 'PUT') {
    requireSuperAdmin();
    $id = (int)($_GET['id'] ?? 0);
    $b  = body();
    if (!$id) { json_out(['error' => 'Missing id'], 422); }
    $db->prepare("UPDATE service_units SET name=:n, description=:d, coordinator=:c, sort_order=:s, is_active=:a WHERE id=:id")
       ->execute([':n'=>trim($b['name']??''), ':d'=>$b['description']??null, ':c'=>$b['coordinator']??null, ':s'=>(int)($b['sort_order']??0), ':a'=>(int)($b['is_active']??1), ':id'=>$id]);
    logActivity($admin, 'unit.update', 'unit', $id, "Updated service unit #{$id}");
    json_out(['success' => true]);
}

// ── DELETE: delete unit ────────────────────────────────────────────────────
if ($method === 'DELETE') {
    requireSuperAdmin();
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { json_out(['error' => 'Missing id'], 422); }
    $u = $db->prepare("SELECT name FROM service_units WHERE id=:id"); $u->execute([':id'=>$id]); $unit = $u->fetch();
    $db->prepare("DELETE FROM service_units WHERE id=:id")->execute([':id'=>$id]);
    logActivity($admin, 'unit.delete', 'unit', $id, "Deleted service unit: " . ($unit['name'] ?? "#{$id}"));
    json_out(['success' => true]);
}

json_out(['error' => 'Method not allowed'], 405);

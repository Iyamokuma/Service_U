<?php
require_once __DIR__ . '/middleware.php';
cors();
$me     = requireSuperAdmin();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET: list admins ───────────────────────────────────────────────────────
if ($method === 'GET') {
    $rows = $db->query("
        SELECT id, full_name, username, email, role, unit_access, is_active, last_login, created_at
        FROM admin_users
        ORDER BY role, full_name
    ")->fetchAll();
    foreach ($rows as &$r) {
        $r['unit_access'] = $r['unit_access'] ? json_decode($r['unit_access'], true) : null;
    }
    json_out(['data' => $rows]);
}

// ── POST: create admin ─────────────────────────────────────────────────────
if ($method === 'POST') {
    $b        = body();
    $fullName = trim($b['full_name'] ?? '');
    $username = trim($b['username']  ?? '');
    $email    = trim($b['email']     ?? '');
    $password = $b['password']       ?? '';
    $role     = $b['role']           ?? 'viewer';

    if (!$fullName || !$username || !$email || !$password) {
        json_out(['error' => 'full_name, username, email, password are required'], 422);
    }
    if (!in_array($role, ['super_admin','unit_admin','viewer'], true)) {
        json_out(['error' => 'Invalid role'], 422);
    }
    if (strlen($password) < 8) {
        json_out(['error' => 'Password must be at least 8 characters'], 422);
    }

    $unitAccess = (!empty($b['unit_access']) && is_array($b['unit_access']))
        ? json_encode(array_map('intval', $b['unit_access']))
        : null;

    try {
        $db->prepare("
            INSERT INTO admin_users (full_name, username, email, password_hash, role, unit_access, created_by)
            VALUES (:fn, :un, :em, :ph, :ro, :ua, :cb)
        ")->execute([
            ':fn' => $fullName,
            ':un' => $username,
            ':em' => $email,
            ':ph' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            ':ro' => $role,
            ':ua' => $unitAccess,
            ':cb' => $me['id'],
        ]);
        $newId = (int)$db->lastInsertId();
        logActivity($me, 'admin.create', 'admin', $newId, "Created admin account: $username ($role)");
        json_out(['success' => true, 'id' => $newId]);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') { json_out(['error' => 'Username or email already exists'], 409); }
        throw $e;
    }
}

// ── PUT: update admin ──────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    $b  = body();
    if (!$id) { json_out(['error' => 'Missing id'], 422); }
    if ($id === (int)$me['id'] && isset($b['role']) && $b['role'] !== 'super_admin') {
        json_out(['error' => 'Cannot demote yourself'], 422);
    }

    $sets   = [];
    $params = [':id' => $id];

    if (isset($b['full_name']))  { $sets[] = 'full_name = :fn';  $params[':fn'] = trim($b['full_name']); }
    if (isset($b['email']))      { $sets[] = 'email = :em';       $params[':em'] = trim($b['email']); }
    if (isset($b['role']))       { $sets[] = 'role = :ro';        $params[':ro'] = $b['role']; }
    if (isset($b['is_active']))  { $sets[] = 'is_active = :ia';   $params[':ia'] = (int)$b['is_active']; }
    if (!empty($b['password']))  {
        if (strlen($b['password']) < 8) { json_out(['error' => 'Password must be at least 8 characters'], 422); }
        $sets[] = 'password_hash = :ph'; $params[':ph'] = password_hash($b['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    }
    if (array_key_exists('unit_access', $b)) {
        $sets[] = 'unit_access = :ua';
        $params[':ua'] = (!empty($b['unit_access']) && is_array($b['unit_access']))
            ? json_encode(array_map('intval', $b['unit_access'])) : null;
    }

    if (!$sets) { json_out(['error' => 'Nothing to update'], 422); }
    $db->prepare("UPDATE admin_users SET " . implode(', ', $sets) . " WHERE id = :id")->execute($params);
    logActivity($me, 'admin.update', 'admin', $id, "Updated admin account #{$id}");
    json_out(['success' => true]);
}

// ── DELETE ─────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { json_out(['error' => 'Missing id'], 422); }
    if ($id === (int)$me['id']) { json_out(['error' => 'Cannot delete yourself'], 422); }
    $a = $db->prepare("SELECT username FROM admin_users WHERE id=:id"); $a->execute([':id'=>$id]); $adm = $a->fetch();
    $db->prepare("DELETE FROM admin_users WHERE id=:id")->execute([':id'=>$id]);
    logActivity($me, 'admin.delete', 'admin', $id, "Deleted admin account: " . ($adm['username'] ?? "#{$id}"));
    json_out(['success' => true]);
}

json_out(['error' => 'Method not allowed'], 405);

<?php
require_once __DIR__ . '/middleware.php';
cors();
$admin  = requireAuth();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET: list with filters ──────────────────────────────────────────────────
if ($method === 'GET') {
    $unitId  = isset($_GET['unit_id'])  ? (int)$_GET['unit_id']  : null;
    $status  = $_GET['status']  ?? null;
    $sex     = $_GET['sex']     ?? null;
    $search  = trim($_GET['search'] ?? '');
    $from    = $_GET['from']    ?? null;
    $to      = $_GET['to']      ?? null;
    $sort    = in_array($_GET['sort'] ?? '', ['submitted_at','surname','unit_name','status']) ? $_GET['sort'] : 'submitted_at';
    $dir     = strtoupper($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
    $page    = max(1, (int)($_GET['page']     ?? 1));
    $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 25)));
    $offset  = ($page - 1) * $perPage;

    $where  = ['1=1'];
    $params = [];

    if ($unitId)  { $where[] = 'r.unit_id = :unit_id';    $params[':unit_id']  = $unitId; }
    if ($status)  { $where[] = 'r.status = :status';      $params[':status']   = $status; }
    if ($sex)     { $where[] = 'r.sex = :sex';            $params[':sex']      = $sex; }
    if ($from)    { $where[] = 'DATE(r.submitted_at) >= :from';  $params[':from'] = $from; }
    if ($to)      { $where[] = 'DATE(r.submitted_at) <= :to';    $params[':to']   = $to; }
    if ($search)  {
        $where[] = '(r.surname LIKE :s OR r.first_name LIKE :s OR r.email LIKE :s OR r.phone1 LIKE :s OR r.tithe_card LIKE :s)';
        $params[':s'] = '%' . $search . '%';
    }
    // Scope unit_admin to their units
    if ($admin['role'] === 'unit_admin' && $admin['unit_access']) {
        $ids = array_map('intval', $admin['unit_access']);
        $where[] = 'r.unit_id IN (' . implode(',', $ids) . ')';
    }

    $w = implode(' AND ', $where);

    $countStmt = $db->prepare("SELECT COUNT(*) FROM registrations r WHERE $w");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $params[':lim'] = $perPage;
    $params[':off'] = $offset;
    $stmt = $db->prepare("
        SELECT r.id, r.surname, r.first_name, r.other_names,
               r.sex, r.marital_status, r.nationality,
               r.phone1, r.phone2, r.email,
               r.address, r.bus_stop,
               r.workplace, r.tithe_card, r.homecell,
               r.photo_path,
               r.dob_month, r.dob_day, r.dob_year,
               r.joined_church_month, r.joined_church_year,
               r.born_again, r.baptised, r.wolbi, r.wolbi_level,
               r.unit_id, r.unit_name, r.sub_unit,
               r.status, r.notes, r.submitted_at
        FROM registrations r
        WHERE $w
        ORDER BY r.$sort $dir
        LIMIT :lim OFFSET :off
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    json_out([
        'data'       => $rows,
        'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'pages' => (int)ceil($total / $perPage)],
    ]);
}

// ── PATCH: update status / notes ───────────────────────────────────────────
if ($method === 'PATCH') {
    $id   = (int)($_GET['id'] ?? 0);
    $body = body();
    if (!$id) { json_out(['error' => 'Missing id'], 422); }

    $allowed = ['status' => 1, 'notes' => 1];
    $sets = []; $params = [':id' => $id];
    foreach ($body as $k => $v) {
        if (isset($allowed[$k])) { $sets[] = "$k = :$k"; $params[":$k"] = $v; }
    }
    if (!$sets) { json_out(['error' => 'Nothing to update'], 422); }
    if (isset($body['status'])) {
        $sets[] = 'reviewed_by = :rb'; $params[':rb'] = $admin['id'];
        $sets[] = 'reviewed_at = NOW()';
    }
    $db->prepare("UPDATE registrations SET " . implode(', ', $sets) . " WHERE id = :id")->execute($params);

    $reg = $db->prepare("SELECT surname, first_name, unit_name FROM registrations WHERE id = :id");
    $reg->execute([':id' => $id]);
    $r = $reg->fetch();
    logActivity($admin, 'queue.update', 'registration', $id,
        "Updated registration #{$id} ({$r['first_name']} {$r['surname']}) status to " . ($body['status'] ?? 'n/a'),
        $body
    );
    json_out(['success' => true]);
}

// ── DELETE ─────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    requireSuperAdmin();
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { json_out(['error' => 'Missing id'], 422); }
    $reg = $db->prepare("SELECT surname, first_name FROM registrations WHERE id = :id");
    $reg->execute([':id' => $id]);
    $r = $reg->fetch();
    $db->prepare("DELETE FROM registrations WHERE id = :id")->execute([':id' => $id]);
    logActivity($admin, 'queue.delete', 'registration', $id, "Deleted registration #{$id} ({$r['first_name']} {$r['surname']})");
    json_out(['success' => true]);
}

json_out(['error' => 'Method not allowed'], 405);

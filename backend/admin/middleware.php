<?php
require_once __DIR__ . '/../config.php';

function cors(): void {
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = ['http://localhost:5173', 'http://127.0.0.1:5173'];
    if (in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: $origin");
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

function json_out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($ct, 'application/json')) {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
    return $_POST;
}

function requireAuth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        json_out(['error' => 'Unauthorized'], 401);
    }
    $token = $m[1];
    $db    = getDB();
    $stmt  = $db->prepare("
        SELECT a.id, a.full_name, a.username, a.email, a.role, a.unit_access, a.is_active
        FROM admin_tokens t
        JOIN admin_users  a ON a.id = t.admin_id
        WHERE t.token = :token AND t.expires_at > NOW()
    ");
    $stmt->execute([':token' => $token]);
    $admin = $stmt->fetch();
    if (!$admin || !$admin['is_active']) {
        json_out(['error' => 'Unauthorized'], 401);
    }
    $admin['unit_access'] = $admin['unit_access'] ? json_decode($admin['unit_access'], true) : null;
    return $admin;
}

function requireSuperAdmin(): array {
    $admin = requireAuth();
    if ($admin['role'] !== 'super_admin') {
        json_out(['error' => 'Forbidden: super admin only'], 403);
    }
    return $admin;
}

function logActivity(array $admin, string $action, string $entityType = '', int $entityId = 0, string $description = '', array $meta = []): void {
    try {
        $db   = getDB();
        $stmt = $db->prepare("
            INSERT INTO activity_logs (admin_id, admin_name, admin_role, action, entity_type, entity_id, description, meta, ip_address)
            VALUES (:admin_id, :admin_name, :admin_role, :action, :entity_type, :entity_id, :description, :meta, :ip)
        ");
        $stmt->execute([
            ':admin_id'    => $admin['id'],
            ':admin_name'  => $admin['full_name'],
            ':admin_role'  => $admin['role'],
            ':action'      => $action,
            ':entity_type' => $entityType ?: null,
            ':entity_id'   => $entityId   ?: null,
            ':description' => $description ?: null,
            ':meta'        => $meta ? json_encode($meta) : null,
            ':ip'          => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
    } catch (\Throwable $e) { /* never break the main flow */ }
}

if (!function_exists('str_contains')) {
    function str_contains(string $h, string $n): bool { return strpos($h, $n) !== false; }
}

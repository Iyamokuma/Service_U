<?php
require_once __DIR__ . '/middleware.php';
cors();
$admin = requireAuth();
$header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
preg_match('/^Bearer\s+(.+)$/i', $header, $m);
if (!empty($m[1])) {
    getDB()->prepare("DELETE FROM admin_tokens WHERE token = :t")->execute([':t' => $m[1]]);
}
logActivity($admin, 'admin.logout', 'admin', (int)$admin['id'], 'Admin logged out');
json_out(['success' => true]);

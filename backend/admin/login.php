<?php
require_once __DIR__ . '/middleware.php';
cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { json_out(['error' => 'Method not allowed'], 405); }

$body     = body();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (!$username || !$password) {
    json_out(['error' => 'Username and password are required.'], 422);
}

$db   = getDB();
$stmt = $db->prepare("SELECT * FROM admin_users WHERE (username = :u OR email = :u) AND is_active = 1");
$stmt->execute([':u' => $username]);
$admin = $stmt->fetch();

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    json_out(['error' => 'Invalid credentials.'], 401);
}

// Generate token (48 random bytes = 96 hex chars)
$token     = bin2hex(random_bytes(48));
$expiresAt = date('Y-m-d H:i:s', strtotime('+8 hours'));

$db->prepare("INSERT INTO admin_tokens (token, admin_id, expires_at, ip_address) VALUES (:t,:id,:exp,:ip)")
   ->execute([':t' => $token, ':id' => $admin['id'], ':exp' => $expiresAt, ':ip' => $_SERVER['REMOTE_ADDR'] ?? null]);

$db->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = :id")
   ->execute([':id' => $admin['id']]);

logActivity(
    ['id' => $admin['id'], 'full_name' => $admin['full_name'], 'role' => $admin['role']],
    'admin.login', 'admin', (int)$admin['id'], 'Admin logged in'
);

json_out([
    'token'      => $token,
    'expires_at' => $expiresAt,
    'admin'      => [
        'id'        => $admin['id'],
        'full_name' => $admin['full_name'],
        'username'  => $admin['username'],
        'email'     => $admin['email'],
        'role'      => $admin['role'],
    ],
]);

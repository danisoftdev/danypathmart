<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Database;
use App\Config\Env;
use Firebase\JWT\JWT;
use PDO;

/** Google, Microsoft, and Apple sign-in / sign-up. */
final class OAuthService
{
    /** @return array<int,string> */
    public static function enabledProviders(): array
    {
        $providers = [];
        if (self::isConfigured('google')) {
            $providers[] = 'google';
        }
        if (self::isConfigured('microsoft')) {
            $providers[] = 'microsoft';
        }
        if (self::isConfigured('apple')) {
            $providers[] = 'apple';
        }

        return $providers;
    }

    public static function isConfigured(string $provider): bool
    {
        return match ($provider) {
            'google' => Env::get('GOOGLE_OAUTH_CLIENT_ID') && Env::get('GOOGLE_OAUTH_CLIENT_SECRET'),
            'microsoft' => Env::get('MICROSOFT_OAUTH_CLIENT_ID') && Env::get('MICROSOFT_OAUTH_CLIENT_SECRET'),
            'apple' => Env::get('APPLE_OAUTH_CLIENT_ID')
                && Env::get('APPLE_TEAM_ID')
                && Env::get('APPLE_KEY_ID')
                && (Env::get('APPLE_PRIVATE_KEY') || Env::get('APPLE_PRIVATE_KEY_PATH')),
            default => false,
        };
    }

    public static function redirectUri(string $provider): string
    {
        $base = rtrim((string) Env::get('APP_URL', 'http://localhost:8000'), '/');

        return $base . '/auth/oauth/' . $provider . '/callback';
    }

    public static function frontendCallbackUrl(string $query = ''): string
    {
        $base = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $path = '/auth/oauth/callback';

        return $query !== '' ? $base . $path . '?' . $query : $base . $path;
    }

    public static function startRedirect(string $provider): never
    {
        if (!self::isConfigured($provider)) {
            header('Location: ' . self::frontendCallbackUrl('error=' . urlencode('This sign-in option is not configured yet.')));
            exit;
        }

        $state = bin2hex(random_bytes(16));
        self::storeState($state, $provider);

        $url = match ($provider) {
            'google' => self::googleAuthorizeUrl($state),
            'microsoft' => self::microsoftAuthorizeUrl($state),
            'apple' => self::appleAuthorizeUrl($state),
            default => self::frontendCallbackUrl('error=' . urlencode('Unknown provider.')),
        };

        header('Location: ' . $url);
        exit;
    }

    /**
     * @param array<string,mixed> $params Query (GET) or body (POST) from provider callback.
     */
    public static function handleCallback(string $provider, array $params): never
    {
        try {
            if (!self::isConfigured($provider)) {
                throw new \RuntimeException('This sign-in option is not configured yet.');
            }

            $state = (string) ($params['state'] ?? '');
            if ($state === '' || !self::consumeState($state, $provider)) {
                throw new \RuntimeException('Invalid or expired sign-in session. Please try again.');
            }

            $code = (string) ($params['code'] ?? '');
            if ($code === '') {
                $err = (string) ($params['error_description'] ?? $params['error'] ?? 'Sign-in was cancelled.');
                throw new \RuntimeException($err);
            }

            $profile = match ($provider) {
                'google' => self::exchangeGoogle($code),
                'microsoft' => self::exchangeMicrosoft($code),
                'apple' => self::exchangeApple($code, $params),
                default => throw new \RuntimeException('Unknown provider.'),
            };

            if ($profile['sub'] === '') {
                throw new \RuntimeException('Could not verify your account with the provider.');
            }

            $user = self::findOrCreateUser($provider, $profile);
            if ($user['status'] === 'disabled') {
                throw new \RuntimeException('This account has been disabled.');
            }

            $ticket = self::issueTicket((int) $user['id']);
            header('Location: ' . self::frontendCallbackUrl('ticket=' . urlencode($ticket)));
            exit;
        } catch (\Throwable $e) {
            header('Location: ' . self::frontendCallbackUrl('error=' . urlencode($e->getMessage())));
            exit;
        }
    }

    /**
     * Exchange a one-time ticket for JWT session tokens.
     *
     * @return array<string,mixed>
     */
    public static function exchangeTicket(string $ticket): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT user_id FROM oauth_tickets WHERE ticket = ? AND expires_at > NOW()'
        );
        $stmt->execute([$ticket]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error('Sign-in link expired. Please try again.', 401);
        }

        $pdo->prepare('DELETE FROM oauth_tickets WHERE ticket = ?')->execute([$ticket]);
        self::purgeExpired();

        $userId = (int) $row['user_id'];
        $userStmt = $pdo->prepare(
            'SELECT id, name, username, email, role, status, preferred_currency, phone, profile_photo, totp_enabled
             FROM users WHERE id = ?'
        );
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if ($user === false) {
            Response::error('Account not found.', 404);
        }

        if ($user['status'] === 'disabled') {
            Response::error('This account has been disabled.', 403);
        }

        if ((string) $user['role'] !== 'customer' && (int) ($user['totp_enabled'] ?? 0) === 1) {
            Response::error('Staff accounts must sign in with email, password, and 2FA.', 403);
        }

        return AuthTokens::issueFor($user);
    }

    /**
     * Direct id_token login (optional SDK flow).
     *
     * @param array{name?:string} $extra
     * @return array<string,mixed>
     */
    public static function loginWithIdToken(string $provider, string $idToken, array $extra = []): array
    {
        if (!in_array($provider, ['google', 'microsoft', 'apple'], true)) {
            Response::error('Unknown provider.', 422);
        }
        if (!self::isConfigured($provider)) {
            Response::error('This sign-in option is not configured yet.', 503);
        }

        try {
            $claims = IdTokenVerifier::verify($idToken, $provider);
        } catch (\Throwable $e) {
            Response::error('Could not verify sign-in token.', 401);
        }

        $name = trim((string) ($extra['name'] ?? ''));
        if ($name === '') {
            $name = $claims['name'] ?? '';
        }

        $user = self::findOrCreateUser($provider, [
            'sub'            => $claims['sub'],
            'email'          => $claims['email'],
            'email_verified' => $claims['email_verified'],
            'name'           => $name !== '' ? $name : null,
        ]);

        if ($user['status'] === 'disabled') {
            Response::error('This account has been disabled.', 403);
        }

        if ((string) $user['role'] !== 'customer' && (int) ($user['totp_enabled'] ?? 0) === 1) {
            Response::error('Staff accounts must sign in with email, password, and 2FA.', 403);
        }

        return AuthTokens::issueFor($user);
    }

    private static function googleAuthorizeUrl(string $state): string
    {
        $params = http_build_query([
            'client_id'     => Env::get('GOOGLE_OAUTH_CLIENT_ID'),
            'redirect_uri'  => self::redirectUri('google'),
            'response_type' => 'code',
            'scope'         => 'openid email profile',
            'state'         => $state,
            'prompt'        => 'select_account',
        ]);

        return 'https://accounts.google.com/o/oauth2/v2/auth?' . $params;
    }

    private static function microsoftAuthorizeUrl(string $state): string
    {
        $tenant = Env::get('MICROSOFT_OAUTH_TENANT', 'common');
        $params = http_build_query([
            'client_id'     => Env::get('MICROSOFT_OAUTH_CLIENT_ID'),
            'redirect_uri'  => self::redirectUri('microsoft'),
            'response_type' => 'code',
            'scope'         => 'openid profile email offline_access',
            'state'         => $state,
            'response_mode' => 'query',
        ]);

        return 'https://login.microsoftonline.com/' . rawurlencode((string) $tenant) . '/oauth2/v2.0/authorize?' . $params;
    }

    private static function appleAuthorizeUrl(string $state): string
    {
        $params = http_build_query([
            'client_id'     => Env::get('APPLE_OAUTH_CLIENT_ID'),
            'redirect_uri'  => self::redirectUri('apple'),
            'response_type' => 'code id_token',
            'scope'         => 'name email',
            'state'         => $state,
            'response_mode' => 'form_post',
        ]);

        return 'https://appleid.apple.com/auth/authorize?' . $params;
    }

    /** @return array{sub:string,email:?string,email_verified:bool,name:?string} */
    private static function exchangeGoogle(string $code): array
    {
        $token = self::postForm('https://oauth2.googleapis.com/token', [
            'code'          => $code,
            'client_id'     => Env::get('GOOGLE_OAUTH_CLIENT_ID'),
            'client_secret' => Env::get('GOOGLE_OAUTH_CLIENT_SECRET'),
            'redirect_uri'  => self::redirectUri('google'),
            'grant_type'    => 'authorization_code',
        ]);

        $idToken = (string) ($token['id_token'] ?? '');
        if ($idToken === '') {
            throw new \RuntimeException('Google did not return an id_token.');
        }

        return IdTokenVerifier::verify($idToken, 'google');
    }

    /** @return array{sub:string,email:?string,email_verified:bool,name:?string} */
    private static function exchangeMicrosoft(string $code): array
    {
        $tenant = Env::get('MICROSOFT_OAUTH_TENANT', 'common');
        $token = self::postForm(
            'https://login.microsoftonline.com/' . rawurlencode((string) $tenant) . '/oauth2/v2.0/token',
            [
                'client_id'     => Env::get('MICROSOFT_OAUTH_CLIENT_ID'),
                'client_secret' => Env::get('MICROSOFT_OAUTH_CLIENT_SECRET'),
                'redirect_uri'  => self::redirectUri('microsoft'),
                'grant_type'    => 'authorization_code',
                'code'          => $code,
            ]
        );

        $idToken = (string) ($token['id_token'] ?? '');
        if ($idToken === '') {
            throw new \RuntimeException('Microsoft did not return an id_token.');
        }

        return IdTokenVerifier::verify($idToken, 'microsoft');
    }

    /**
     * @param array<string,mixed> $params
     * @return array{sub:string,email:?string,email_verified:bool,name:?string}
     */
    private static function exchangeApple(string $code, array $params): array
    {
        $token = self::postForm('https://appleid.apple.com/auth/token', [
            'client_id'     => Env::get('APPLE_OAUTH_CLIENT_ID'),
            'client_secret' => self::appleClientSecret(),
            'code'          => $code,
            'grant_type'    => 'authorization_code',
            'redirect_uri'  => self::redirectUri('apple'),
        ]);

        $idToken = (string) ($token['id_token'] ?? ($params['id_token'] ?? ''));
        if ($idToken === '') {
            throw new \RuntimeException('Apple did not return an id_token.');
        }

        $claims = IdTokenVerifier::verify($idToken, 'apple');

        $name = $claims['name'];
        $userJson = $params['user'] ?? null;
        if ($name === null && is_string($userJson) && $userJson !== '') {
            $userData = json_decode($userJson, true);
            if (is_array($userData)) {
                $first = trim((string) ($userData['name']['firstName'] ?? ''));
                $last = trim((string) ($userData['name']['lastName'] ?? ''));
                $full = trim($first . ' ' . $last);
                if ($full !== '') {
                    $name = $full;
                }
            }
        }

        $claims['name'] = $name;

        return $claims;
    }

    private static function appleClientSecret(): string
    {
        $key = Env::get('APPLE_PRIVATE_KEY');
        if (!$key) {
            $path = Env::get('APPLE_PRIVATE_KEY_PATH');
            if (!$path || !is_file($path)) {
                throw new \RuntimeException('Apple private key is not configured.');
            }
            $key = (string) file_get_contents($path);
        }

        $key = str_replace('\\n', "\n", (string) $key);

        return JWT::encode([
            'iss' => Env::get('APPLE_TEAM_ID'),
            'iat' => time(),
            'exp' => time() + 86400 * 150,
            'aud' => 'https://appleid.apple.com',
            'sub' => Env::get('APPLE_OAUTH_CLIENT_ID'),
        ], $key, 'ES256', (string) Env::get('APPLE_KEY_ID'));
    }

    /**
     * @param array{sub:string,email:?string,email_verified:bool,name:?string} $profile
     * @return array<string,mixed>
     */
    private static function findOrCreateUser(string $provider, array $profile): array
    {
        $pdo = Database::pdo();

        $identity = $pdo->prepare(
            'SELECT u.id, u.name, u.username, u.email, u.role, u.status, u.preferred_currency,
                    u.phone, u.profile_photo, u.totp_enabled
             FROM oauth_identities oi
             INNER JOIN users u ON u.id = oi.user_id
             WHERE oi.provider = ? AND oi.provider_user_id = ?'
        );
        $identity->execute([$provider, $profile['sub']]);
        $existing = $identity->fetch();
        if ($existing !== false) {
            return $existing;
        }

        $email = $profile['email'] ? strtolower(trim($profile['email'])) : null;

        if ($email !== null) {
            $byEmail = $pdo->prepare(
                'SELECT id, name, username, email, role, status, preferred_currency, phone, profile_photo, totp_enabled
                 FROM users WHERE email = ?'
            );
            $byEmail->execute([$email]);
            $user = $byEmail->fetch();

            if ($user !== false) {
                if (in_array($user['role'], ['super_admin', 'staff'], true)) {
                    throw new \RuntimeException('This email is registered for staff login. Use email and password instead.');
                }

                self::attachIdentity($pdo, (int) $user['id'], $provider, $profile['sub'], $email);

                if ($user['status'] === 'unverified' && $profile['email_verified']) {
                    $pdo->prepare("UPDATE users SET status = 'verified' WHERE id = ?")->execute([(int) $user['id']]);
                    $user['status'] = 'verified';
                }

                return $user;
            }
        }

        if ($email === null) {
            throw new \RuntimeException('We could not read an email from your account. Try email sign-up instead.');
        }

        $name = $profile['name'] ?: self::nameFromEmail($email);
        $username = self::uniqueUsername($pdo, explode('@', $email)[0]);
        $status = $profile['email_verified'] ? 'verified' : 'unverified';

        $insert = $pdo->prepare(
            'INSERT INTO users (name, username, email, password_hash, role, status)
             VALUES (?, ?, ?, NULL, ?, ?)'
        );
        $insert->execute([$name, $username, $email, 'customer', $status]);
        $userId = (int) $pdo->lastInsertId();

        self::attachIdentity($pdo, $userId, $provider, $profile['sub'], $email);

        $userStmt = $pdo->prepare(
            'SELECT id, name, username, email, role, status, preferred_currency, phone, profile_photo, totp_enabled
             FROM users WHERE id = ?'
        );
        $userStmt->execute([$userId]);
        $created = $userStmt->fetch();

        return $created !== false ? $created : [];
    }

    private static function attachIdentity(PDO $pdo, int $userId, string $provider, string $sub, ?string $email): void
    {
        $pdo->prepare(
            'INSERT INTO oauth_identities (user_id, provider, provider_user_id, email)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE email = VALUES(email)'
        )->execute([$userId, $provider, $sub, $email]);
    }

    private static function uniqueUsername(PDO $pdo, string $base): string
    {
        $base = preg_replace('/[^a-z0-9._-]/', '', strtolower($base)) ?? '';
        if (strlen($base) < 3) {
            $base = 'user' . $base;
        }
        $base = substr($base, 0, 50);
        $candidate = $base;
        $suffix = 0;
        $stmt = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
        do {
            $stmt->execute([$candidate]);
            $taken = $stmt->fetchColumn() !== false;
            if ($taken) {
                $suffix++;
                $candidate = $base . $suffix;
            }
        } while ($taken);

        return $candidate;
    }

    private static function nameFromEmail(string $email): string
    {
        $local = explode('@', $email)[0];
        $local = str_replace(['.', '_', '-'], ' ', $local);

        return ucwords($local);
    }

    private static function storeState(string $state, string $provider): void
    {
        $pdo = Database::pdo();
        $pdo->prepare('INSERT INTO oauth_states (state, provider, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))')
            ->execute([$state, $provider]);
    }

    private static function consumeState(string $state, string $provider): bool
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT provider FROM oauth_states WHERE state = ? AND provider = ? AND expires_at > NOW()'
        );
        $stmt->execute([$state, $provider]);
        $row = $stmt->fetch();
        if ($row === false) {
            return false;
        }

        $pdo->prepare('DELETE FROM oauth_states WHERE state = ?')->execute([$state]);

        return true;
    }

    private static function issueTicket(int $userId): string
    {
        $pdo = Database::pdo();
        $ticket = bin2hex(random_bytes(32));
        $pdo->prepare(
            'INSERT INTO oauth_tickets (ticket, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE))'
        )->execute([$ticket, $userId]);

        return $ticket;
    }

    private static function purgeExpired(): void
    {
        $pdo = Database::pdo();
        $pdo->exec('DELETE FROM oauth_tickets WHERE expires_at <= NOW()');
        $pdo->exec('DELETE FROM oauth_states WHERE expires_at <= NOW()');
    }

    /** @return array<string,mixed> */
    private static function postForm(string $url, array $fields): array
    {
        $body = http_build_query($fields);

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $body,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 20,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            ]);
            $response = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($response === false || $code >= 400) {
                throw new \RuntimeException('Could not complete sign-in with the provider.');
            }
        } else {
            $ctx = stream_context_create([
                'http' => [
                    'method'  => 'POST',
                    'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
                    'content' => $body,
                    'timeout' => 20,
                ],
            ]);
            $response = @file_get_contents($url, false, $ctx);
            if ($response === false) {
                throw new \RuntimeException('Could not complete sign-in with the provider.');
            }
        }

        $data = json_decode((string) $response, true);
        if (!is_array($data)) {
            throw new \RuntimeException('Invalid response from the provider.');
        }

        if (isset($data['error'])) {
            $msg = (string) ($data['error_description'] ?? $data['error']);
            throw new \RuntimeException($msg !== '' ? $msg : 'Sign-in failed.');
        }

        return $data;
    }
}

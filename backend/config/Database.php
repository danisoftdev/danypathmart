<?php

declare(strict_types=1);

namespace App\Config;

use PDO;

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        Env::load();
        $host = Env::get('DB_HOST', '127.0.0.1');
        $name = Env::get('DB_NAME', 'danypathmart');
        $user = Env::get('DB_USER', 'root');
        $pass = Env::get('DB_PASS', '');
        $port = Env::get('DB_PORT', '3306');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

        self::$pdo = self::connect($dsn, $user, $pass);

        return self::$pdo;
    }

    /** Drop the cached connection and open a fresh one (used by migrators after PDO 2014). */
    public static function reconnect(): PDO
    {
        self::$pdo = null;

        return self::pdo();
    }

    private static function connect(string $dsn, string $user, string $pass): PDO
    {
        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
        ]);
    }
}

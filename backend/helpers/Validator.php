<?php

declare(strict_types=1);

namespace App\Helpers;

final class Validator
{
    public static function email(mixed $email): bool
    {
        return is_string($email) && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Password policy: minimum 8 chars, at least 1 uppercase letter and 1 number.
     */
    public static function passwordStrong(mixed $password): bool
    {
        return is_string($password)
            && strlen($password) >= 8
            && preg_match('/[A-Z]/', $password) === 1
            && preg_match('/\d/', $password) === 1;
    }

    public static function nonEmpty(mixed $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }

    public static function username(mixed $value): bool
    {
        return is_string($value)
            && preg_match('/^[A-Za-z0-9._-]{3,60}$/', $value) === 1;
    }
}

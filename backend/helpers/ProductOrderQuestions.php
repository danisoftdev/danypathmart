<?php

declare(strict_types=1);

namespace App\Helpers;

/** Normalises product MCQ questions stored as JSON on products.order_questions. */
final class ProductOrderQuestions
{
    /**
     * @return array<int,array<string,mixed>>
     */
    public static function decode(mixed $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }
        $decoded = is_array($raw) ? $raw : json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $out = [];
        foreach ($decoded as $row) {
            if (!is_array($row)) {
                continue;
            }
            $question = trim((string) ($row['question'] ?? ''));
            if ($question === '') {
                continue;
            }
            $options = [];
            foreach ((array) ($row['options'] ?? []) as $opt) {
                $text = trim((string) $opt);
                if ($text !== '') {
                    $options[] = $text;
                }
            }
            if ($options === []) {
                continue;
            }
            $id = trim((string) ($row['id'] ?? ''));
            if ($id === '') {
                $id = 'q' . (count($out) + 1);
            }
            $out[] = [
                'id'       => $id,
                'question' => $question,
                'required' => !empty($row['required']),
                'options'  => array_values(array_unique($options)),
            ];
        }

        return $out;
    }

    /** @param mixed $raw @return string|null JSON for DB */
    public static function encodeForStorage(mixed $raw): ?string
    {
        $list = self::decode($raw);
        if ($list === []) {
            return null;
        }

        return json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * @param array<int,array<string,mixed>> $questions
     * @param array<string,string> $answers
     * @return array{ok:bool,error:?string}
     */
    public static function validateAnswers(array $questions, array $answers): array
    {
        foreach ($questions as $q) {
            if (empty($q['required'])) {
                continue;
            }
            $id = (string) ($q['id'] ?? '');
            $answer = trim((string) ($answers[$id] ?? ''));
            if ($answer === '') {
                return ['ok' => false, 'error' => 'Please answer: ' . ($q['question'] ?? 'all required questions')];
            }
            if (!in_array($answer, (array) ($q['options'] ?? []), true)) {
                return ['ok' => false, 'error' => 'Invalid answer for: ' . ($q['question'] ?? 'question')];
            }
        }

        return ['ok' => true, 'error' => null];
    }

    /** @param array<string,string> $answers */
    public static function formatInstructions(array $answers): ?string
    {
        if ($answers === []) {
            return null;
        }
        $parts = [];
        foreach ($answers as $question => $answer) {
            $q = trim((string) $question);
            $a = trim((string) $answer);
            if ($q !== '' && $a !== '') {
                $parts[] = $q . ': ' . $a;
            }
        }

        return $parts !== [] ? implode('; ', $parts) : null;
    }
}

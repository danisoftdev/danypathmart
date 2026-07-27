<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Seeds default About Us page content when the row is missing. */
final class AboutPageSeeder
{
    public static function seedDefaults(PDO $pdo): bool
    {
        try {
            $pdo->query('SELECT id FROM about_page LIMIT 1');
        } catch (\Throwable) {
            return false;
        }

        $exists = (int) $pdo->query('SELECT COUNT(*) FROM about_page WHERE id = 1')->fetchColumn();
        if ($exists > 0) {
            return false;
        }

        $story = implode("\n\n", [
            'DanyPathMart started as a practical answer to a simple problem: parents, students, and local shops needed a clearer way to buy and sell everyday goods online in Ghana — without giving up control of their money or building their own website.',
            'We host independent shops on their own storefront links and also sell as DanyPathMart on the main shop. Sellers keep 100% of product sales. They pay DPM only for the subscription that keeps their public shop link open.',
            'Today DPM is operated online at danypathmart.store as we grow toward formal registration in Ghana.',
        ]);

        $pdo->prepare(
            'INSERT INTO about_page (
                id, page_enabled, trusted_by_enabled, trusted_by_heading, trusted_by_items,
                hero_kicker, hero_title, hero_subtitle,
                hero_cta_label, hero_cta_link, hero_secondary_label, hero_secondary_link,
                story_heading, story_body,
                what_we_do_heading, what_we_do_intro, what_we_do_items,
                who_we_serve_heading, who_we_serve_intro, who_we_serve_items,
                team_heading, team_intro,
                dsd_heading, dsd_intro, dsd_vision, dsd_mission, dsd_values,
                cta_heading, cta_body,
                cta_primary_label, cta_primary_link, cta_secondary_label, cta_secondary_link,
                seo_title, seo_description
            ) VALUES (
                1, 1, 0, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?,
                ?, ?
            )'
        )->execute([
            'Trusted by',
            json_encode([
                ['label' => 'Schools & clubs', 'value' => ''],
                ['label' => 'Local shops', 'value' => ''],
                ['label' => 'Families across Ghana', 'value' => ''],
            ], JSON_UNESCAPED_UNICODE),
            'A DSD Groups product',
            'DanyPathMart',
            'Your shop. Your sales. Our platform — commerce built for people traditional tech leaves behind.',
            'Shop now',
            '/shop',
            'Sell on DPM',
            '/sell',
            'Our story',
            $story,
            'What we do',
            'We make online buying and selling simpler for Ghana.',
            json_encode([
                ['title' => 'DPM shop', 'body' => 'Buy school supplies and related goods from the main DanyPathMart catalog.'],
                ['title' => 'Independent shops', 'body' => 'Local sellers get their own storefront link, orders, chat, and payment tools.'],
                ['title' => 'Fair money model', 'body' => 'Shops keep 100% of product sales. Subscription keeps the shop link live — it is not a sales commission.'],
            ], JSON_UNESCAPED_UNICODE),
            'Who we serve',
            'Built for everyday people and local businesses.',
            json_encode([
                ['title' => 'Parents & students', 'body' => 'Find supplies and everyday items without the runaround.'],
                ['title' => 'Schools & clubs', 'body' => 'Order what groups need with clear contact and delivery options.'],
                ['title' => 'Shop owners', 'body' => 'Open a professional online storefront and keep what you earn.'],
            ], JSON_UNESCAPED_UNICODE),
            'Our team',
            'The people building and running DanyPathMart.',
            'Part of DSD Groups',
            'DanyPathMart is a product company under DSD Groups. The vision, mission, and values below belong to DSD Groups and guide every product we build, including DPM.',
            'To build a family of software products that power everyday life — commerce, services, and opportunity — for the people traditional tech leaves behind.',
            'We find the problems ordinary people face and solve them with sharp, affordable software — expanding access wherever technology underserves them.',
            json_encode([
                ['title' => 'Problem-solving', 'body' => 'We build for real problems, not trends.'],
                ['title' => 'Ownership', 'body' => 'We take full responsibility for what we build.'],
                ['title' => 'Speed', 'body' => 'We move fast and iterate faster than the problem changes.'],
                ['title' => 'Trust', 'body' => 'Every product carries the DSD name.'],
                ['title' => 'Growth', 'body' => 'For our users, our team, and the company.'],
            ], JSON_UNESCAPED_UNICODE),
            'Ready to get started?',
            'Shop the DPM catalog, open a shop of your own, or talk to us.',
            'Shop now',
            '/shop',
            'Contact us',
            '/contact',
            'About us | DanyPathMart',
            'Learn about DanyPathMart — a DSD Groups marketplace for Ghana shops, parents, and schools.',
        ]);

        self::seedFounderIfEmpty($pdo);

        return true;
    }

    /** Seed founder card once when the team table is empty. */
    public static function seedFounderIfEmpty(PDO $pdo): bool
    {
        try {
            $pdo->query('SELECT id FROM about_team_members LIMIT 1');
        } catch (\Throwable) {
            return false;
        }

        $count = (int) $pdo->query('SELECT COUNT(*) FROM about_team_members')->fetchColumn();
        if ($count > 0) {
            return false;
        }

        $bio = 'Software engineer and founder of DSD Groups. Passionate about building innovative digital solutions that solve real-world challenges. Leads DanyPathMart so everyday people and local shops can buy and sell online with clarity and fairness across Ghana.';

        $hasSocial = false;
        try {
            $pdo->query('SELECT linkedin_url FROM about_team_members LIMIT 1');
            $hasSocial = true;
        } catch (\Throwable) {
            $hasSocial = false;
        }

        if ($hasSocial) {
            $pdo->prepare(
                'INSERT INTO about_team_members (name, role_title, bio, photo_url, linkedin_url, website_url, sort_order, is_visible)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 1)'
            )->execute([
                'Daniel Awuah Appiah',
                'Founder & Lead Developer',
                $bio,
                '/images/team/daniel-awuah-appiah.png',
                '',
                'https://danysoftdev.com',
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO about_team_members (name, role_title, bio, photo_url, sort_order, is_visible)
                 VALUES (?, ?, ?, ?, 0, 1)'
            )->execute([
                'Daniel Awuah Appiah',
                'Founder & Lead Developer',
                $bio,
                '/images/team/daniel-awuah-appiah.png',
            ]);
        }

        return true;
    }
}

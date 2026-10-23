<?php

namespace App\Support;

/**
 * Drawing and layout helpers for certificate PDFs. dompdf has no flexbox, gradients,
 * clipping or text measuring, so ornaments are small SVGs embedded as data URIs.
 */
class CertificateArt
{
    public static function uri(string $svg): string
    {
        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    /**
     * A font size that keeps a name on one line of the given width. Widths are estimated
     * from average letter widths per em; Ethiopic letters are wider than Latin ones.
     */
    public static function fitSize(string $text, float $width, float $latinEm, float $max, float $min = 20, float $ethiopicEm = 0.74): int
    {
        $ethiopic = preg_match_all('/[\x{1200}-\x{139F}]/u', $text);
        $em = (mb_strlen($text) - $ethiopic) * $latinEm + $ethiopic * $ethiopicEm;

        return (int) max($min, min($max, floor($width / max($em, 1))));
    }

    /** Fine wavy engraving lines across a box, like security paper. */
    public static function engraving(int $width, int $height, string $color, int $gap = 9): string
    {
        $lines = '';
        for ($y = -$gap; $y <= $height + $gap; $y += $gap) {
            $points = [];
            for ($x = 0; $x <= $width; $x += 6) {
                $points[] = $x.','.round($y + 2.2 * sin($x / 22) + 1.4 * sin($x / 9 + $y / 30), 1);
            }
            $lines .= '<polyline points="'.implode(' ', $points).'"/>';
        }

        return self::uri("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{$width}\" height=\"{$height}\" viewBox=\"0 0 {$width} {$height}\"><g fill=\"none\" stroke=\"{$color}\" stroke-width=\"0.35\">{$lines}</g></svg>");
    }

    /** A gold corner flourish for the given corner (tl, tr, bl, br). */
    public static function corner(string $color, string $corner = 'tl'): string
    {
        // Drawn for the top-left corner, then mirrored for the others.
        $transform = match ($corner) {
            'tr' => 'translate(80,0) scale(-1,1)',
            'bl' => 'translate(0,80) scale(1,-1)',
            'br' => 'translate(80,80) scale(-1,-1)',
            default => 'translate(0,0)',
        };

        return self::uri(<<<SVG
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
                <g transform="{$transform}" fill="none" stroke="{$color}" stroke-linecap="round">
                    <path d="M4 60 L4 4 L60 4" stroke-width="1.6"/>
                    <path d="M10 46 L10 10 L46 10" stroke-width="0.7"/>
                    <path d="M10 10 C 22 14, 26 22, 24 32 C 22 40, 14 40, 14 32 C 14 26, 22 24, 26 30" stroke-width="0.9"/>
                    <path d="M10 10 C 14 22, 22 26, 32 24 C 40 22, 40 14, 32 14 C 26 14, 24 22, 30 26" stroke-width="0.9"/>
                    <circle cx="4" cy="4" r="2.6" fill="{$color}" stroke="none"/>
                    <circle cx="60" cy="4" r="1.6" fill="{$color}" stroke="none"/>
                    <circle cx="4" cy="60" r="1.6" fill="{$color}" stroke="none"/>
                </g>
            </svg>
        SVG);
    }

    /** Gold divider: fine rules running out from an interlaced knot with a lozenge. */
    public static function flourish(int $width, string $color): string
    {
        $c = $width / 2;
        $a = $c - 34;
        $b = $c + 34;
        $dl = $a - 6;
        $dr = $b + 6;
        $pl = $c - 5;
        $pr = $c + 5;

        return self::uri(<<<SVG
            <svg xmlns="http://www.w3.org/2000/svg" width="{$width}" height="16" viewBox="0 0 {$width} 16">
                <line x1="0" y1="8" x2="{$dl}" y2="8" stroke="{$color}" stroke-width="0.8"/>
                <line x1="{$dr}" y1="8" x2="{$width}" y2="8" stroke="{$color}" stroke-width="0.8"/>
                <path d="M{$a} 8 C {$a} 2, {$c} 2, {$c} 8 C {$c} 14, {$b} 14, {$b} 8" fill="none" stroke="{$color}" stroke-width="0.9"/>
                <path d="M{$a} 8 C {$a} 14, {$c} 14, {$c} 8 C {$c} 2, {$b} 2, {$b} 8" fill="none" stroke="{$color}" stroke-width="0.9"/>
                <polygon points="{$c},3 {$pr},8 {$c},13 {$pl},8" fill="{$color}"/>
                <circle cx="{$dl}" cy="8" r="1.6" fill="{$color}"/>
                <circle cx="{$dr}" cy="8" r="1.6" fill="{$color}"/>
            </svg>
        SVG);
    }

    /** A rosette seal: starburst edge, ringed disc. */
    public static function seal(string $edge, string $disc, string $ring, int $rays = 30): string
    {
        $points = collect(range(0, $rays * 2 - 1))->map(function ($i) use ($rays) {
            $r = $i % 2 === 0 ? 50 : 45;
            $a = deg2rad($i * 180 / $rays - 90);

            return round(50 + $r * cos($a), 2).','.round(50 + $r * sin($a), 2);
        })->implode(' ');

        return self::uri(<<<SVG
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
                <polygon points="{$points}" fill="{$edge}"/>
                <circle cx="50" cy="50" r="40" fill="{$disc}"/>
                <circle cx="50" cy="50" r="36.5" fill="none" stroke="{$ring}" stroke-width="0.9"/>
                <circle cx="50" cy="50" r="34" fill="none" stroke="{$ring}" stroke-width="0.4" stroke-dasharray="1.2 1.4"/>
            </svg>
        SVG);
    }

    /** Two ribbon tails to hang under a seal. */
    public static function ribbons(string $fill, string $edge): string
    {
        return self::uri(<<<SVG
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 80 60">
                <polygon points="18,0 36,0 30,60 22,50 12,58" fill="{$fill}" stroke="{$edge}" stroke-width="1"/>
                <polygon points="44,0 62,0 68,58 58,50 50,60" fill="{$fill}" stroke="{$edge}" stroke-width="1"/>
            </svg>
        SVG);
    }

    /**
     * A laurel wreath: two branches rising from the bottom of a circle up each side,
     * open at the top, with leaves set along the stem (tangent to it) in pairs.
     */
    public static function laurel(string $color): string
    {
        $r = 41;
        $svg = '';
        foreach ([[100, 245], [80, -65]] as [$from, $to]) {
            $step = $from < $to ? 1 : -1;
            $stem = [];
            for ($deg = $from; $step > 0 ? $deg <= $to : $deg >= $to; $deg += 3 * $step) {
                $stem[] = round(50 + $r * cos(deg2rad($deg)), 1).','.round(50 + $r * sin(deg2rad($deg)), 1);
            }
            $svg .= '<polyline points="'.implode(' ', $stem).'" fill="none" stroke="'.$color.'" stroke-width="1"/>';

            // Leaf pairs: one outside the stem, one inside, angled toward the tip.
            for ($i = 0; $i < 7; $i++) {
                $deg = $from + $step * (10 + $i * 20);
                foreach ([4.2, -4.2] as $offset) {
                    $x = round(50 + ($r + $offset) * cos(deg2rad($deg)), 1);
                    $y = round(50 + ($r + $offset) * sin(deg2rad($deg)), 1);
                    $tilt = $offset > 0 ? 28 : -28;
                    $rot = round($deg + 90 + $step * $tilt, 1);
                    $svg .= "<ellipse cx=\"{$x}\" cy=\"{$y}\" rx=\"2.3\" ry=\"5.4\" transform=\"rotate({$rot} {$x} {$y})\" fill=\"{$color}\"/>";
                }
            }
            // A berry at the tip.
            $tx = round(50 + $r * cos(deg2rad($to)), 1);
            $ty = round(50 + $r * sin(deg2rad($to)), 1);
            $svg .= "<circle cx=\"{$tx}\" cy=\"{$ty}\" r=\"2\" fill=\"{$color}\"/>";
        }

        return self::uri("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\" viewBox=\"0 0 100 100\">{$svg}</svg>");
    }
}

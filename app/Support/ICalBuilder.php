<?php

namespace App\Support;

use Carbon\Carbon;

class ICalBuilder
{
    /** @var array<int, string> */
    private array $events = [];

    private string $calName;

    private string $prodId;

    public function __construct(string $calName = 'RTT Platform Calendar')
    {
        $this->calName = $calName;
        $this->prodId = '-//RTT Platform//EN';
    }

    public function addEvent(
        string $uid,
        string $summary,
        Carbon $start,
        Carbon $end,
        ?string $description = null,
        ?string $url = null
    ): static {
        $lines = [];
        $lines[] = 'BEGIN:VEVENT';
        $lines[] = 'UID:'.$uid.'@rtt-platform';
        $lines[] = 'DTSTAMP:'.now()->utc()->format('Ymd\THis\Z');
        $lines[] = 'DTSTART:'.$start->utc()->format('Ymd\THis\Z');
        $lines[] = 'DTEND:'.$end->utc()->format('Ymd\THis\Z');
        $lines[] = 'SUMMARY:'.$this->escape($summary);

        if ($description) {
            $lines[] = 'DESCRIPTION:'.$this->escape($description);
        }

        if ($url) {
            $lines[] = 'URL:'.$url;
        }

        $lines[] = 'END:VEVENT';

        $this->events[] = implode("\r\n", $lines);

        return $this;
    }

    public function build(): string
    {
        $lines = [];
        $lines[] = 'BEGIN:VCALENDAR';
        $lines[] = 'VERSION:2.0';
        $lines[] = 'PRODID:'.$this->prodId;
        $lines[] = 'CALSCALE:GREGORIAN';
        $lines[] = 'METHOD:PUBLISH';
        $lines[] = 'X-WR-CALNAME:'.$this->escape($this->calName);
        $lines[] = 'X-WR-TIMEZONE:UTC';
        $lines[] = implode("\r\n", $this->events);
        $lines[] = 'END:VCALENDAR';

        return implode("\r\n", $lines);
    }

    private function escape(string $value): string
    {
        // Backslashes must be escaped first to avoid double-escaping the \ we introduce below.
        $value = str_replace('\\', '\\\\', $value);
        $value = str_replace(["\r\n", "\n", "\r"], '\\n', $value);
        $value = str_replace(',', '\\,', $value);
        $value = str_replace(';', '\\;', $value);

        return $value;
    }
}

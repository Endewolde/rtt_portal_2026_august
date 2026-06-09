<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StoreInAppNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public string $userId,
        public string $event,
        public array $data
    ) {
        $this->onQueue('notifications');
    }

    public function handle(): void
    {
        DB::table('notifications')->insert([
            'id'              => Str::uuid()->toString(),
            'notifiable_type' => User::class,
            'notifiable_id'   => $this->userId,
            'type'            => $this->event,
            'data'            => json_encode($this->data),
            'read_at'         => null,
            'created_at'      => now(),
        ]);
    }
}

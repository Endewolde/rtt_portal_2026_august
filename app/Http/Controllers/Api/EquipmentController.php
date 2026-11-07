<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\Equipment;
use App\Models\EquipmentBooking;
use App\Models\User;
use App\Support\AuditLogger;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The research equipment register: who looks after what and where, and booking it.
 * Two bookings of the same equipment never overlap; a custodian (or an equipment
 * manager) approves the bookings of equipment that needs approval.
 */
class EquipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $equipment = Equipment::with(['college:id,name', 'custodian:id,name'])
            ->where('status', '!=', 'retired')
            ->when($request->query('search'), fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'like', "%{$s}%")->orWhere('category', 'like', "%{$s}%")->orWhere('location', 'like', "%{$s}%")))
            ->when($request->query('college_id'), fn ($q, $c) => $q->where('college_id', $c))
            ->orderBy('name')->get()
            ->map(fn (Equipment $e) => $e->toArray() + [
                'upcoming' => $e->bookings()->whereIn('status', EquipmentBooking::HOLDS_SLOT)->where('ends_at', '>=', now())
                    ->orderBy('starts_at')->limit(5)->get(['id', 'starts_at', 'ends_at', 'status']),
                'can_approve' => $this->approves($user, $e),
            ]);

        return $this->ok([
            'equipment' => $equipment,
            'mine' => EquipmentBooking::with('equipment:id,name,location')->where('user_id', $user->id)->latest('starts_at')->limit(50)->get(),
            // Requests waiting for this person's approval.
            'to_approve' => EquipmentBooking::with(['equipment:id,name,custodian_id', 'user:id,name,email'])->where('status', 'pending')
                ->whereHas('equipment', fn ($q) => $user->can('equipment.manage') ? $q : $q->where('custodian_id', $user->id))
                ->orderBy('starts_at')->get(),
            'can_manage' => $user->can('equipment.manage'),
        ]);
    }

    public function save(Request $request, ?string $id = null): JsonResponse
    {
        abort_unless($request->user()->can('equipment.manage'), 403);
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:60',
            'asset_tag' => 'nullable|string|max:60',
            'description' => 'nullable|string|max:3000',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'location' => 'nullable|string|max:255',
            'custodian_id' => 'nullable|uuid|exists:users,id',
            'status' => ['required', Rule::in(Equipment::STATUSES)],
            'requires_approval' => 'boolean',
            'max_booking_hours' => 'nullable|integer|min:1|max:2000',
        ]);
        $equipment = $id ? tap(Equipment::findOrFail($id))->update($data) : Equipment::create($data + ['created_by' => $request->user()->id]);

        return $this->ok($equipment->fresh(['college:id,name', 'custodian:id,name']), $id ? 'Saved.' : 'Added to the register.', $id ? 200 : 201);
    }

    public function book(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $equipment = Equipment::with('custodian:id,name,email')->findOrFail($id);
        $data = $request->validate([
            'starts_at' => 'required|date|after:now',
            'ends_at' => 'required|date|after:starts_at',
            'purpose' => 'required|string|max:500',
            'proposal_id' => 'nullable|uuid|exists:proposals,id',
        ], ['starts_at.after' => 'Bookings start in the future.']);

        if ($equipment->status !== 'available') {
            return $this->fail("{$equipment->name} is not available for booking right now ({$equipment->status}).");
        }
        $hours = Carbon::parse($data['starts_at'])->diffInMinutes(Carbon::parse($data['ends_at'])) / 60;
        if ($equipment->max_booking_hours && $hours > $equipment->max_booking_hours) {
            return $this->fail("A booking can last at most {$equipment->max_booking_hours} hours.");
        }

        $booking = DB::transaction(function () use ($equipment, $data, $user) {
            Equipment::whereKey($equipment->id)->lockForUpdate()->first();
            $clash = $equipment->bookings()->whereIn('status', EquipmentBooking::HOLDS_SLOT)
                ->where('starts_at', '<', $data['ends_at'])->where('ends_at', '>', $data['starts_at'])->first();
            if ($clash) {
                return 'It is already booked from '.$clash->starts_at->format('j M H:i').' to '.$clash->ends_at->format('j M H:i').'.';
            }

            return $equipment->bookings()->create($data + [
                'user_id' => $user->id,
                'status' => $equipment->requires_approval ? 'pending' : 'approved',
            ]);
        });
        if (is_string($booking)) {
            return $this->fail($booking);
        }

        if ($booking->status === 'pending' && $equipment->custodian?->email && $equipment->custodian_id !== $user->id) {
            $this->email($equipment->custodian, "Booking request — {$equipment->name}", $booking, 'request');
        }
        AuditLogger::log('equipment.booked', 'Equipment', $equipment->id, $user->id, null, ['target_name' => $equipment->name, 'from' => $booking->starts_at, 'to' => $booking->ends_at], 201);

        return $this->ok($booking, $booking->status === 'approved' ? 'Booked.' : 'Requested — the custodian will confirm it.', 201);
    }

    public function decide(Request $request, string $bookingId): JsonResponse
    {
        $user = $request->user();
        $booking = EquipmentBooking::with(['equipment', 'user:id,name,email'])->findOrFail($bookingId);
        abort_unless($this->approves($user, $booking->equipment), 403);
        $data = $request->validate(['action' => 'required|in:approve,reject', 'decision_note' => 'required_if:action,reject|nullable|string|max:500']);

        if ($booking->status !== 'pending') {
            return $this->fail('This request has already been decided.');
        }
        $booking->update(['status' => $data['action'] === 'approve' ? 'approved' : 'rejected', 'decision_note' => $data['decision_note'] ?? null, 'decided_by' => $user->id]);
        if ($booking->user?->email) {
            $this->email($booking->user, ($booking->status === 'approved' ? 'Booking confirmed' : 'Booking not possible')." — {$booking->equipment->name}", $booking, 'decision');
        }

        return $this->ok($booking, $booking->status === 'approved' ? 'Approved — the researcher has been told.' : 'Declined — the researcher has been told why.');
    }

    public function cancel(Request $request, string $bookingId): JsonResponse
    {
        $booking = EquipmentBooking::where('user_id', $request->user()->id)->findOrFail($bookingId);
        if (! in_array($booking->status, EquipmentBooking::HOLDS_SLOT, true) || $booking->ends_at->isPast()) {
            return $this->fail('This booking can no longer be cancelled.');
        }
        $booking->update(['status' => 'cancelled']);

        return $this->ok($booking, 'Booking cancelled.');
    }

    private function approves(User $user, Equipment $equipment): bool
    {
        return $user->can('equipment.manage') || $equipment->custodian_id === $user->id;
    }

    private function email(User $to, string $subject, EquipmentBooking $booking, string $kind): void
    {
        $booking->loadMissing(['equipment', 'user:id,name']);
        SendRawMailJob::deliver(
            view('emails.equipment_booking', ['booking' => $booking, 'kind' => $kind, 'name' => $to->name,
                'url' => rtrim(config('app.url'), '/').'/equipment',
                'senderName' => AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name')])->render(),
            $to->email,
            $to->name,
            $subject
        );
    }

    private function ok(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }

    private function fail(string $message): JsonResponse
    {
        return response()->json(['data' => null, 'message' => $message, 'errors' => [], 'meta' => []], 422);
    }
}

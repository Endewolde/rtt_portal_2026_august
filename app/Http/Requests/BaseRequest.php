<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

abstract class BaseRequest extends FormRequest
{
    /**
     * Sanitize all string inputs — strips HTML tags before validation runs.
     */
    protected function prepareForValidation(): void
    {
        $sanitized = collect($this->all())->map(function ($value) {
            if (is_string($value)) {
                return strip_tags(trim($value));
            }

            if (is_array($value)) {
                return array_map(fn ($v) => is_string($v) ? strip_tags(trim($v)) : $v, $value);
            }

            return $value;
        })->toArray();

        $this->merge($sanitized);
    }
}

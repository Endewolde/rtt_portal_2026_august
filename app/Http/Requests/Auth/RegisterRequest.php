<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseRequest;

class RegisterRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'          => ['required', 'string', 'max:255'],
            'email'         => ['required', 'email', 'unique:users,email'],
            'password'      => ['required', 'string', 'min:8', 'confirmed'],
            'employee_id'   => ['nullable', 'string', 'max:50'],
            'college_id'    => ['nullable', 'uuid', 'exists:colleges,id'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'phone'         => ['nullable', 'string', 'max:30'],
        ];
    }
}

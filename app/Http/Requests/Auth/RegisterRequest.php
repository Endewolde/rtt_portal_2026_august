<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseRequest;
use App\Models\AppSetting;
use App\Models\College;
use Illuminate\Validation\Rule;

class RegisterRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'employee_id' => $this->employee_id !== '' ? $this->employee_id : null,
            'phone' => $this->phone !== '' ? $this->phone : null,
            'title' => $this->title !== '' ? $this->title : null,
        ]);
    }

    public function rules(): array
    {
        $emailRules = ['required', 'email', 'unique:users,email'];

        $domain = AppSetting::where('key', 'registration_email_domain')->value('value');
        if ($domain) {
            $suffix = str_starts_with($domain, '@') ? $domain : "@{$domain}";
            $emailRules[] = Rule::when(true, function () use ($suffix) {
                return ['regex:/'.preg_quote($suffix, '/').'$/i'];
            });
        }

        // Department is required only when the selected college has departments
        $collegeId = $this->input('college_id');
        $hasDepartments = $collegeId
            ? College::find($collegeId)?->departments()->exists()
            : false;

        return [
            'name' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:100'],
            'email' => $emailRules,
            'gender' => ['required', 'in:male,female,other'],
            'phone' => ['nullable', 'string', 'max:30'],
            'employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users', 'employee_id')],
            'password' => ['nullable', 'string', 'min:8'],
            'college_id' => ['required', 'uuid', 'exists:colleges,id'],
            'department_id' => $hasDepartments
                ? ['required', 'uuid', 'exists:departments,id']
                : ['nullable', 'uuid', 'exists:departments,id'],
            'expertise' => ['required', 'array', 'min:1'],
            'expertise.*' => ['string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        $domain = AppSetting::where('key', 'registration_email_domain')->value('value');
        $suffix = $domain ? (str_starts_with($domain, '@') ? $domain : "@{$domain}") : '';

        return [
            'email.regex' => "Email must end with {$suffix}",
            'college_id.required' => 'Please select your college.',
            'department_id.required' => 'Please select your department.',
            'expertise.required' => 'Add at least one area of expertise.',
            'expertise.min' => 'Add at least one area of expertise.',
            'employee_id.unique' => 'This employee ID is already registered. Leave it blank if you are unsure.',
        ];
    }
}

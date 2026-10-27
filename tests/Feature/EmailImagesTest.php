<?php

use App\Listeners\MakeEmailImagesGmailSafe;
use Illuminate\Mail\Events\MessageSending;
use Symfony\Component\Mime\Email;

test('base64 images and inline svg icons become inline attachments Gmail can show', function () {
    $png = base64_encode(file_get_contents(base_path('public/favicon.ico')) ?: 'x');
    $email = (new Email)->to('a@example.com')->subject('Hi')->html(
        '<img src="data:image/png;base64,'.$png.'" alt="logo">'
        .'<div class="hero-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white"><path d="M9 11l3 3L22 4"/></svg></div>'
        .'<img src="data:image/png;base64,'.$png.'" alt="again">'
    );

    (new MakeEmailImagesGmailSafe)->handle(new MessageSending($email, []));
    $html = $email->getHtmlBody();

    expect($html)->not->toContain('data:image')
        ->and($html)->not->toContain('<svg')
        ->and(substr_count($html, 'cid:'))->toBe(class_exists(Imagick::class) ? 3 : 2);

    // The same logo twice is attached once.
    $parts = $email->getAttachments();
    expect(count($parts))->toBe(class_exists(Imagick::class) ? 2 : 1);
});

test('emails without images are left as they are', function () {
    $email = (new Email)->to('a@example.com')->subject('Hi')->html('<p>Plain</p>');
    (new MakeEmailImagesGmailSafe)->handle(new MessageSending($email, []));

    expect($email->getHtmlBody())->toBe('<p>Plain</p>')->and($email->getAttachments())->toBeEmpty();
});

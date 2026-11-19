<?php

// Public respondent pages: QR code scan and survey link (phases R2 and R3).

return [
    'title' => 'Occupational safety and health (OSH) culture survey',
    'states' => [
        'QR_INVALID' => 'This QR code is not valid or has been replaced. Ask your unit coordinator for the latest code.',
        'QR_CLOSED' => 'The survey is not open at the moment. Check the survey schedule with your unit coordinator.',
        'QR_LIMIT' => 'The quota for this QR code has been used up. Contact your unit coordinator.',
        'INVALID' => 'This survey link is not valid. It may have been replaced by a newer link. Check the latest email or message you received, or contact your unit coordinator.',
        'USED' => 'The answers for this link have been received. Thank you for taking part.',
        'NOT_OPEN' => 'The survey is not open at the moment. Your link remains valid during the survey window.',
        'CLOSED' => 'The survey has closed. Thank you for your attention.',
    ],
    'opens' => 'The survey opens on :date.',
    'closes' => 'The survey is open until :date.',
    'anonymous' => 'Your answers cannot be linked to your identity and are only presented in combined form for groups of at least five people.',
    'privacy' => 'This page does not store your identity or your device address.',
    'noScript' => 'This survey needs JavaScript. Turn on JavaScript in your browser, then reload this page.',
    'footer' => 'Nusa Safety',
];

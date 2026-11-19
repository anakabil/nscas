<?php

// Action plan deadline reminder (phase R9).

return [
    'subject' => ':organization occupational safety and health culture action plan deadline reminder',
    'greeting' => 'Dear :name,',
    'intro' => 'The following actions in the :assessment action plan are due soon or overdue:',
    'item' => ':code :title, due :date (:state)',
    'states' => ['dueSoon' => 'due soon', 'overdue' => 'overdue'],
    'button' => 'Open action plan monitoring',
    'closing' => 'Please update their progress in NSCAS. Thank you.',
    'signature' => 'Nusa Safety',
    'otherLanguage' => 'English version below.',
];

// Teks formulir penilaian mandiri bertoken (fase R4), dibawa dari v1 messages/en.json bagian selfAssessmentForm.
// Hanya dimuat paket formulir (resources/js/self-assessment), tidak oleh konsol.

export const selfAssessmentForm = {
    heading: 'Occupational safety and health (OSH) culture self-assessment',
    identified: {
        title: 'This self-assessment is identified',
        body: 'Your name and position are stored with your answers. The self-assessment is a matter of accountability: Nusa Safety assessors trace the reasons and evidence you give and confirm them in interviews or discussions. It is therefore not anonymous, unlike the worker survey.',
        access: 'Your answers can be read by Nusa Safety assessors and the assessment administrator in your organisation, and are not combined with the worker survey answers.',
    },
    profile: {
        title: 'About you',
        name: 'Full name',
        position: 'Position',
        save: 'Save details',
        saved: 'Details saved.',
    },
    start: 'Start the assessment',
    characteristic: {
        label: 'Characteristic {current} of {total}',
        instruction: 'Choose the one statement that best describes your organisation today.',
        justification: 'Reason',
        justificationHint:
            'Explain the basis for your choice, for example practices, data, or events that support it. At least {min} characters.',
        counter: '{count} of at least {min} characters',
        evidence: 'Supporting evidence',
        noEvidence: 'No evidence linked yet. You can continue, but the assessors will rate this without supporting evidence.',
        noEvidenceUploaded:
            'Documents can be linked once the Evidence module is available. Explain the basis of your rating in the reason field.',
    },
    jump: 'Go to characteristic',
    nav: {
        previous: 'Previous',
        saveNext: 'Save and continue',
        saveReview: 'Save and review',
        saving: 'Saving',
        saved: 'Draft saved.',
    },
    review: {
        title: 'Review before sending',
        complete: 'All characteristics are complete.',
        incomplete: '{count} characteristics are not complete:',
        reasons: {
            LEVEL: 'no statement chosen',
            JUSTIFICATION: 'reason shorter than {min} characters',
        },
        warning: 'Once sent, the answers are locked and cannot be changed.',
        submit: 'Send self-assessment',
        submitting: 'Sending',
        edit: 'Edit',
    },
    submitted: {
        title: 'Self-assessment sent',
        body: 'Thank you. Your answers have been locked since {date}.',
        answers: 'Your answers',
    },
    status: {
        INVALID: {
            title: 'Link not valid',
            body: 'This self-assessment link is not recognised or has been replaced. Contact the assessment administrator in your organisation for the latest link.',
        },
        CLOSED: {
            title: 'Self-assessment closed',
            body: 'The self-assessment period has ended.',
        },
    },
    errors: {
        INVALID_INPUT: 'Please check your entries.',
        INVALID_TOKEN: 'This link is no longer valid. Contact the assessment administrator for the latest link.',
        SELF_ASSESSMENT_SUBMITTED: 'The self-assessment has been sent and can no longer be changed.',
        DISTRIBUTION_CLOSED: 'The filling period has ended.',
        UNKNOWN_ITEM: 'Choice not recognised. Reload the page.',
        UNKNOWN_EVIDENCE: 'One of the evidence items is no longer available. Reload the page.',
        INCOMPLETE: 'Some characteristics are not complete yet.',
        NETWORK: 'Cannot reach the server. Check your connection and try again. Your entries on this screen are still here.',
    },
    readOnly: 'Answers are read-only.',
    level: 'Chosen statement',
    switchLanguage: 'Bahasa Indonesia',
    contentInIndonesian: 'The statements are currently available in Indonesian.',
};

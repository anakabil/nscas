// Survey page text (phase R3), carried over from v1 messages/en.json section survey. Loaded only by the survey bundle
// (resources/js/survey), not by the console, so the survey page stays light.

export const survey = {
    heading: 'Occupational safety and health (OSH) culture survey',
    switchLanguage: 'Bahasa Indonesia',
    language: {
        title: 'Choose a language',
        intro: 'You can switch the language at any time.',
        id: 'Bahasa Indonesia',
        en: 'English',
    },
    consent: {
        title: 'Consent to data processing',
        accept: 'I agree and start the survey',
        decline: 'I do not agree',
        declinedTitle: 'Thank you',
        declinedBody: 'You chose not to take part. No answers have been stored.',
        changeMind: 'Back to consent',
    },
    stratum: {
        title: 'Your job group',
        intro: 'This is only used to group the results, not to identify you.',
    },
    intro: {
        title: 'Quick guide',
        partA: 'Part A, {count} questions: choose the one statement that best matches your workplace today.',
        partB: 'Part B, {count} statements: choose how much you agree.',
        change: 'You can change answers through the Question list before sending.',
        anonymous: 'There are no right or wrong answers. Your answers cannot be linked to your identity.',
        start: 'Start',
    },
    partA: {
        label: 'Part A',
        question: 'Question {current} of {total}',
        instruction: 'Choose the one that best matches your workplace today.',
        dontKnow: "Don't know",
    },
    partB: {
        label: 'Part B',
        screen: 'Screen {current} of {total}',
        instruction: 'How much do you agree with the following statements?',
    },
    scale: {
        '1': 'Strongly disagree',
        '2': 'Disagree',
        '3': 'Not sure',
        '4': 'Agree',
        '5': 'Strongly agree',
    },
    progress: 'Progress {percent} percent',
    remaining: 'About {minutes} minutes left',
    remainingLessThanOne: 'Less than 1 minute left',
    allAnswered: 'All answered',
    nav: {
        label: 'Question navigation',
        back: 'Back',
        next: 'Next',
        toReview: 'To summary',
        answerFirst: 'Choose an answer to continue.',
    },
    list: {
        open: 'Question list',
        title: 'Question list',
        close: 'Close',
        stratum: 'Job group',
        partA: 'Part A',
        partB: 'Part B',
        screen: 'Screen {current}, {count} statements',
        statuses: {
            done: 'Answered',
            partial: '{answered} of {total}',
            todo: 'Not answered',
        },
        review: 'Summary and send',
    },
    review: {
        title: 'Check your answers',
        body: 'Tap Change to edit an answer. Once sent, answers cannot be changed.',
        stratum: 'Job group',
        partA: 'Part A, {count} questions',
        partB: 'Part B, {count} statements',
        edit: 'Change',
        editLabel: 'Change answer: {label}',
        submit: 'Send answers',
        sending: 'Sending',
    },
    offline: {
        banner: 'Connection lost. Your answers are still saved on this device.',
        waiting:
            'Not sent yet because the connection is lost. Your answers will be sent automatically when the connection returns. Do not close this page.',
        retry: 'Try sending now',
    },
    done: {
        title: 'Thank you',
        body: 'We have received your answers. They cannot be linked to your identity and are only reported for groups of at least five people.',
        close: 'You may close this page.',
    },
    status: {
        INVALID: {
            title: 'Link not valid',
            body: 'This survey link is not recognised or has been replaced. Use the latest link from your invitation, or contact your unit coordinator.',
        },
        USED: {
            title: 'Survey already sent',
            body: 'We have already received the answers for this link. Each link can only be used once. Thank you for taking part.',
        },
        NOT_OPEN: {
            title: 'Survey not open yet',
            body: 'The survey cannot be filled in yet. Please open this link again once the survey opens.',
        },
        CLOSED: {
            title: 'Survey closed',
            body: 'The survey period has ended. Thank you for your interest.',
        },
        ERROR: {
            title: 'Answers not sent yet',
            body: 'Something went wrong while sending. Your answers are still saved on this device. Please try again shortly.',
        },
    },
    closesAt: 'The survey is open until {date} WIB.',
    contentInIndonesian: 'The survey statements are currently available in Indonesian.',
};

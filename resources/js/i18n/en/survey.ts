// Survey page text (phase R3), carried over from v1 messages/en.json section survey. Loaded only by the survey bundle
// (resources/js/survey), not by the console, so the survey page stays light.

export const survey = {
    heading: 'Occupational safety and health (OSH) culture survey',
    switchLanguage: 'Bahasa Indonesia',
    language: {
        title: 'Choose a language',
        intro: 'The survey is available in Indonesian and English. You can switch at any time.',
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
        intro: 'Choose the job group that fits you best. It is only used to group the results and does not identify you.',
    },
    intro: {
        title: 'How to answer',
        partA: "Part A has {count} questions. Each question shows five statements. Choose the one statement that best describes your workplace today. If you do not know, choose Don't know.",
        partB: 'Part B has {count} statements. Choose how much you agree with each statement.',
        honest: 'There are no right or wrong answers. Answer based on what you experience.',
        anonymous: 'Answers are kept on this device until you send them at the end. They cannot be linked to your identity.',
        start: 'Start',
    },
    partA: {
        label: 'Part A',
        question: 'Question {current} of {total}',
        instruction: 'Choose the one statement that best matches your workplace today.',
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
    nav: {
        back: 'Back',
        next: 'Next',
        answerFirst: 'Choose an answer to continue.',
    },
    review: {
        title: 'Ready to send',
        body: 'All questions are answered. Answers are sent once and cannot be changed afterwards.',
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

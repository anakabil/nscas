<?php

declare(strict_types=1);

namespace App\Domain\Access;

/** Sumber daya pada matriks hak akses (docs/04 bagian 2). */
enum Resource: string
{
    case OrganizationsAndUsers = 'organizationsAndUsers';
    case ParametersBeforeLock = 'parametersBeforeLock';
    case ParametersAfterLock = 'parametersAfterLock';
    case Roster = 'roster';
    case TokensAndParticipation = 'tokensAndParticipation';
    case RawSurveyAnswers = 'rawSurveyAnswers';
    case SelfAssessments = 'selfAssessments';
    case EvidenceAndObservations = 'evidenceAndObservations';
    case AssessorRatings = 'assessorRatings';
    case PanelAndFinalization = 'panelAndFinalization';
    case ResultsDashboard = 'resultsDashboard';
    case ActionPlans = 'actionPlans';
    case Reports = 'reports';
    case AuditTrail = 'auditTrail';
}

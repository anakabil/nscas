<?php

declare(strict_types=1);

namespace App\Domain\Navigation;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\Stage;

/**
 * Daftar halaman kerja asesmen, dikelompokkan per tahap (docs/12 bagian 4). Hak buka diturunkan dari matriks
 * docs/04 agar menu tidak pernah menampilkan halaman yang pasti ditolak. Menu hanya kenyamanan: hak akses
 * tetap diperiksa di server pada setiap permintaan.
 */
final class ModuleCatalog
{
    /** @return list<Module> */
    public static function all(AssessmentStatus $status): array
    {
        $read = static fn (Resource $resource): array => Permissions::of($resource)['read'];
        $parameters = $read($status->parametersLocked() ? Resource::ParametersAfterLock : Resource::ParametersBeforeLock);
        $lead = [Role::LeadAssessor];
        $assessors = [Role::LeadAssessor, Role::Assessor];

        return [
            // Tahap 1. Perencanaan
            new Module('details', Stage::Planning, 'setup', $parameters, 'R1', ready: true),
            new Module('units', Stage::Planning, 'setup/units', $parameters, 'R1', ready: true),
            new Module('strata', Stage::Planning, 'setup/strata', $parameters, 'R1', ready: true),
            new Module('parameters', Stage::Planning, 'setup/parameters', $parameters, 'R1', ready: true),
            new Module('sampling', Stage::Planning, 'setup/sampling', $parameters, 'R1', ready: true),
            new Module('team', Stage::Planning, 'setup/team', [Role::SuperAdmin, ...$assessors, Role::ClientAdmin], 'R1', ready: true),
            new Module('kickoff', Stage::Planning, 'setup/kickoff', [...$assessors, Role::ClientAdmin], 'R1', ready: true),

            // Tahap 2. Pengumpulan data
            new Module('respondents', Stage::DataCollection, 'respondents', $read(Resource::Roster), 'R2', ready: true),
            new Module('qr', Stage::DataCollection, 'respondents/qr', [Role::LeadAssessor, Role::ClientAdmin], 'R2', ready: true),
            new Module('participation', Stage::DataCollection, 'participation', $read(Resource::TokensAndParticipation), 'R2', ready: true),
            new Module('selfAssessments', Stage::DataCollection, 'self-assessments', $read(Resource::SelfAssessments), 'R4'),
            new Module('evidence', Stage::DataCollection, 'evidence', $read(Resource::EvidenceAndObservations), 'R5'),
            new Module('observations', Stage::DataCollection, 'observations', $read(Resource::EvidenceAndObservations), 'R5'),

            // Tahap 3. Validasi dan triangulasi
            new Module('dataQuality', Stage::Validation, 'data-quality', $read(Resource::RawSurveyAnswers), 'R6'),
            new Module('findings', Stage::Validation, 'findings', $read(Resource::RawSurveyAnswers), 'R6'),
            new Module('validation', Stage::Validation, 'validation', $assessors, 'R6'),

            // Tahap 4. Penilaian dan penetapan
            new Module('scoring', Stage::Rating, 'scoring', $read(Resource::AssessorRatings), 'R7'),
            new Module('panel', Stage::Rating, 'panel', $read(Resource::PanelAndFinalization), 'R7'),

            // Tahap 5. Pelaporan dan rencana aksi
            new Module('dashboard', Stage::Reporting, 'dashboard', $read(Resource::ResultsDashboard), 'R8'),
            new Module('gaps', Stage::Reporting, 'gaps', $read(Resource::ActionPlans), 'R9'),
            new Module('report', Stage::Reporting, 'report', $read(Resource::Reports), 'R10'),
            new Module('communication', Stage::Reporting, 'communication', [...$lead, Role::ClientAdmin], 'R10'),

            // Tahap 6. Pemantauan dan perbaikan berkelanjutan
            new Module('monitoring', Stage::Monitoring, 'monitoring', $read(Resource::ActionPlans), 'R9'),
            new Module('trend', Stage::Monitoring, 'trend', $read(Resource::ResultsDashboard), 'R8'),

            // Lintas tahap
            new Module('audit', null, 'audit', $read(Resource::AuditTrail), 'R11'),
        ];
    }

    public static function find(string $path, AssessmentStatus $status): ?Module
    {
        foreach (self::all($status) as $module) {
            if ($module->path === $path) {
                return $module;
            }
        }

        return null;
    }
}

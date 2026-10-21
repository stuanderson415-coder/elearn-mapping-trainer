import { useState, useEffect } from 'react';
import { ClipboardCheck, FileCheck2 } from 'lucide-react';
import { useLookupUnit, type UnitOfCompetency } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { HistorySidebar } from '@/components/layout/history-sidebar';
import { LookupForm } from '@/components/unit/lookup-form';
import { RplWorkflow, type RplStage } from '@/components/rpl/rpl-workflow';
import { UnitDisplay } from '@/components/unit/unit-display';
import type { StudentDetails } from '@/lib/rpl-state';

const NUM_KEY    = 'map-app-de:numtasks:global';
const TITLE_KEY  = 'map-app-de:doctitle:global';

function loadNum(): number {
  try { const v = localStorage.getItem(NUM_KEY); return v ? Number(v) : 5; } catch { return 5; }
}
function loadTitle(): string {
  try { return localStorage.getItem(TITLE_KEY) ?? ''; } catch { return ''; }
}

function WelcomePanel() {
  const steps = [
    'Describe and log each RPL evidence piece.',
    'Map evidence to the Unit of Competence.',
    'Identify gaps in the evidence mapping.',
    'Devise gap questions to explore missing evidence.',
    'Review a report comparing collected evidence with the Unit of Competence.',
  ];

  return (
    <section className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-purple-700">Welcome</p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-zinc-900">Welcome to RPL Mapping Trainer</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600">
            RTO Standard 1.6 requires registered training organisations to support VET students with prior skills and knowledge to seek Recognition of Prior Learning (RPL). Providers must offer clear policy awareness, base RPL decisions on valid evidence, and maintain fair, consistent assessment standards.
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 font-bold text-green-800">
            This tool is designed to help you describe and log RPL evidence pieces, map them using a dynamic mapping interface and identify gaps.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-700">Follow these steps</h3>
           <ol className="mt-2 grid gap-1 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs leading-4 text-zinc-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[11px] font-bold text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <aside className="rounded-xl border border-green-950 bg-gradient-to-r from-[#022c22] via-[#064e3b] to-[#052e16] p-3 text-white">
          <FileCheck2 className="h-5 w-5 text-green-100" />
          <h3 className="mt-2 text-sm font-semibold text-white">Important!</h3>
          <p className="mt-1 text-xs leading-5 text-green-50">
            This resource is about learning skills. It is not a formal tool for use at CIT. The processing of full learner RPL portfolios needs to follow CIT&apos;s process for RPL. You can find that information{' '}
            <a
              href="https://cit.edu.au/study/apply/status/recognition-of-prior-learning"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white underline underline-offset-2 hover:text-green-200"
            >
              here
            </a>
            .
          </p>
        </aside>
      </div>
    </section>
  );
}

export default function Home() {
  const [currentUnit, setCurrentUnit] = useState<UnitOfCompetency | null>(null);
  const [numTasks,    setNumTasksRaw]  = useState<number>(loadNum);
  const [docTitle,    setDocTitleRaw]  = useState<string>(loadTitle);
  const [workspaceMode, setWorkspaceMode] = useState<'rpl' | 'assessment'>('rpl');
  const [selectedRplStudent, setSelectedRplStudent] = useState<string | undefined>();
  const [intakeDetails, setIntakeDetails] = useState<StudentDetails | undefined>();
  const [devPreviewStage, setDevPreviewStage] = useState<RplStage>('student');

  const setNumTasks = (n: number) => {
    setNumTasksRaw(n);
    try { localStorage.setItem(NUM_KEY, String(n)); } catch {}
  };
  const setDocTitle = (s: string) => {
    setDocTitleRaw(s);
    try { localStorage.setItem(TITLE_KEY, s); } catch {}
  };

  const lookupUnit = useLookupUnit();
  const { toast } = useToast();

  const handleUnitLoaded = (unit: UnitOfCompetency, intake?: StudentDetails, studentNumber?: string) => {
    setCurrentUnit(unit);
    setWorkspaceMode('rpl');
    setSelectedRplStudent(studentNumber);
    setIntakeDetails(intake);
  };

  const handleHistorySelect = (code: string, studentNumber: string) => {
    lookupUnit.mutate({ data: { unitCode: code } }, {
      onSuccess: data => handleUnitLoaded(data, undefined, studentNumber),
      onError:   () => toast({ title: 'Lookup failed', description: 'Could not load the selected unit.', variant: 'destructive' }),
    });
  };

  const startAnotherRpl = () => {
    setCurrentUnit(null);
    setSelectedRplStudent(undefined);
    setIntakeDetails(undefined);
  };

  const openDevPreview = (stage: 'intake' | RplStage) => {
    if (stage === 'intake') {
      startAnotherRpl();
      return;
    }
    setDevPreviewStage(stage);
    const previewStudent: StudentDetails = {
      surname: 'Preview',
      givenNames: 'Developer',
      studentNumber: 'DEV-PREVIEW',
      usi: 'PREVIEW1234',
      dateOfBirth: '',
      trainerName: 'Preview Assessor',
      organisation: 'Preview Qualification',
      assessmentDate: new Date().toLocaleDateString('en-CA'),
      studentInformed: true,
      preRplChecklist: {
        interviewCompleted: true,
        interviewDate: new Date().toLocaleDateString('en-CA'),
        interviewNotes: 'Candidate advised of the RPL process, evidence expectations, and next steps.',
        cvResumeProvided: true,
        cvResumeFileName: 'preview-cv.pdf',
        academicTranscriptProvided: true,
        academicTranscriptFileName: 'preview-transcript.pdf',
        positionDescriptionProvided: true,
        positionDescriptionFileName: 'preview-position-description.pdf',
        driversLicenceProvided: false,
        driversLicenceNumber: '',
        driversLicenceState: '',
        driversLicenceExpiry: '',
        whiteCardProvided: false,
        whiteCardNumber: '',
        whiteCardExpiry: '',
        forkliftLicenceProvided: false,
        forkliftLicenceNumber: '',
        forkliftLicenceExpiry: '',
        rsaProvided: false,
        rsaNumber: '',
        rsaExpiry: '',
        asbestosSilicaProvided: false,
        asbestosSilicaNumber: '',
        asbestosSilicaExpiry: '',
        wwvpProvided: false,
        wwvpNumber: '',
        wwvpExpiry: '',
        sharePointRepositoryCreated: false,
        sharePointPath: '',
        elearnStorageCreated: false,
        elearnUrl: '',
      },
    };
    if (currentUnit) {
      setSelectedRplStudent(undefined);
      setIntakeDetails(previewStudent);
      setWorkspaceMode('rpl');
      return;
    }
    lookupUnit.mutate({ data: { unitCode: 'CHCAOD001' } }, {
      onSuccess: unit => handleUnitLoaded(unit, previewStudent),
      onError: () => toast({ title: 'Preview unavailable', description: 'Could not load the developer preview unit.', variant: 'destructive' }),
    });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-green-950 bg-gradient-to-r from-[#022c22] via-[#064e3b] to-[#052e16] text-white shadow-md">
        <div className="flex h-full w-full items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-12 shrink-0">
              <img
                src={`${import.meta.env.BASE_URL}icons/map-app-icon.svg`}
                alt="Green app icon with MAP lettering"
                className="h-12 w-12 rounded-xl object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">RPL Mapping Trainer</h1>
              <p className="hidden truncate text-xs text-[#b0c6d6] sm:block">Recognition of Prior Learning Learning Space</p>
            </div>
          </div>
          <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 flex-col items-center lg:flex">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b0c6d6]">
              Developer Demonstration Version
            </p>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="pointer-events-auto mt-1 cursor-help text-[10px] font-medium tracking-wide text-[#b0c6d6] underline decoration-[#7b97aa] underline-offset-2 transition hover:text-white">
                    © Stuart Anderson, Fastigiata Lab
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md border border-[#7b97aa] bg-[#161618] px-3 py-2 text-center text-xs leading-5 text-[#b0c6d6] shadow-xl">
                  RPL Mapping Trainer © 2026 Stuart Anderson / Fastigiata Lab. Licensed under GNU AGPL v3.0. Dynamic Card Mapping™ conceived and developed by Stuart Anderson. See repository LICENSE and NOTICE for details.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <img
                src={`${import.meta.env.BASE_URL}images/adult-learner-feature.png`}
                alt="Adult learner reviewing vocational study materials"
                className="hidden h-10 w-24 rounded-md border border-white/25 object-cover lg:block xl:h-11 xl:w-28"
              />
              <a href="https://github.com/stuanderson415-coder/Unit-Scraper-Pro" target="_blank" rel="noopener noreferrer">
                <img src="https://img.shields.io/badge/Source-GitHub-181717?logo=github" alt="Source on GitHub" className="h-5" />
              </a>
            </div>
            {currentUnit && (
              <button type="button" onClick={startAnotherRpl} className="rounded-md border border-slate-400/60 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-slate-100">
                Start another RPL
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mt-16 flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-zinc-300 font-sans">
        <HistorySidebar onSelect={handleHistorySelect} />

        <main className="relative flex h-full min-w-0 flex-1 flex-col">
          {import.meta.env.DEV && (
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-950">
              <span className="mr-1 font-bold uppercase tracking-wide">Developer preview</span>
              {([
                ['intake', 'Intake'],
                ['student', 'Student'],
                ['evidence', 'Evidence'],
                ['mapping', 'Mapping'],
                ['gaps', 'Gaps'],
                ['review', 'Review'],
                ['final', 'Outcome'],
              ] as const).map(([stage, label]) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => openDevPreview(stage)}
                  className="rounded border border-amber-300 bg-white px-2 py-1 font-medium transition hover:border-amber-500 hover:bg-amber-100"
                >
                  {label}
                </button>
              ))}
              <span className="ml-1 text-[10px] text-amber-700">Development only — hidden from published builds</span>
            </div>
          )}
          <div className="h-full min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-16 md:p-6 md:pb-20">

              {!currentUnit && (
                <>
                  <WelcomePanel />
                  <LookupForm onUnitLoaded={handleUnitLoaded} isPending={lookupUnit.isPending} />
                </>
              )}

              {lookupUnit.isPending ? (
                 <div className="mt-6 space-y-4">
                   <div className="mb-5 flex gap-3">
                    <Skeleton className="h-16 w-48 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                   <Skeleton className="h-[420px] w-full rounded-xl" />
                </div>
              ) : currentUnit ? (
                 <div className="mt-2">
                  {workspaceMode === 'rpl'
                    ? <RplWorkflow key={`${currentUnit.code}:${selectedRplStudent ?? intakeDetails?.studentNumber ?? 'last'}`} unit={currentUnit} studentNumber={selectedRplStudent} prefill={intakeDetails} initialStage={devPreviewStage} onOpenAssessmentMapping={() => setWorkspaceMode('assessment')} />
                     : <div className="space-y-4">
                       <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                        <div>
                          <p className="font-mono text-xs font-bold text-zinc-500">{currentUnit.code}</p>
                          <p className="mt-0.5 text-sm font-semibold text-zinc-900">{currentUnit.title}</p>
                        </div>
                        <button type="button" onClick={() => setWorkspaceMode('rpl')} className="rounded-md border border-purple-700 px-3 py-1.5 text-xs font-semibold text-purple-800 transition hover:bg-purple-50">Return to RPL workflow</button>
                      </div>
                      <UnitDisplay unit={currentUnit} numTasks={numTasks} docTitle={docTitle} />
                    </div>}
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

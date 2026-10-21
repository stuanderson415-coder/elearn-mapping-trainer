import { useState } from 'react';
import { Loader2, UserRound } from 'lucide-react';
import { useLookupUnit, type UnitOfCompetency } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { createEmptyPreRplChecklist, type StudentDetails } from '@/lib/rpl-state';

interface Props {
  onUnitLoaded: (unit: UnitOfCompetency, intake: StudentDetails) => void;
  isPending: boolean;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

type ChecklistDocumentProps = {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function ChecklistDocument({ id, label, checked, disabled, onCheckedChange }: ChecklistDocumentProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
      <div className="flex items-start gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={value => onCheckedChange(value === true)} disabled={disabled} />
        <label htmlFor={id} className="cursor-pointer text-xs font-semibold leading-4 text-zinc-800">{label}</label>
      </div>
    </div>
  );
}

function LicenceItem({
  id,
  label,
  checked,
  number,
  expiry,
  disabled,
  onCheckedChange,
  onNumberChange,
  onExpiryChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  number: string;
  expiry: string;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  onNumberChange: (number: string) => void;
  onExpiryChange: (expiry: string) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
      <div className="flex items-start gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={value => onCheckedChange(value === true)} disabled={disabled} />
        <label htmlFor={id} className="cursor-pointer text-xs font-semibold leading-4 text-zinc-800">{label}</label>
      </div>
      <div className="mt-2 grid gap-2">
        <Input
          value={number}
          onChange={event => onNumberChange(event.target.value)}
          placeholder="Number"
          aria-label={`${label} number`}
          disabled={disabled || !checked}
          className="h-8 text-xs"
        />
        <DatePickerInput
          value={expiry}
          onChange={onExpiryChange}
          disabled={disabled || !checked}
          ariaLabel={`${label} expiry date`}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

export function LookupForm({ onUnitLoaded, isPending }: Props) {
  const [code, setCode] = useState('');
  const [intake, setIntake] = useState<StudentDetails>({
    surname: '',
    givenNames: '',
    studentNumber: '',
    usi: '',
    dateOfBirth: '',
    trainerName: '',
    organisation: '',
    assessmentDate: today(),
    studentInformed: false,
    preRplChecklist: createEmptyPreRplChecklist(),
  });

  const lookupUnit = useLookupUnit();
  const { toast } = useToast();
  const loading = lookupUnit.isPending || isPending;
  const hasRequiredIntake = Boolean(intake.surname.trim() && intake.givenNames.trim() && intake.studentNumber.trim());
  const updateIntake = (patch: Partial<StudentDetails>) => setIntake(current => ({ ...current, ...patch }));
  const updateChecklist = (patch: Partial<StudentDetails['preRplChecklist']>) => setIntake(current => ({
    ...current,
    preRplChecklist: { ...current.preRplChecklist, ...patch },
  }));

  const loadUnit = (unit: UnitOfCompetency) => {
    onUnitLoaded(unit, intake);
    setCode('');
  };

  const handleCodeSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasRequiredIntake || !code.trim()) {
      toast({
        title: 'Complete the required fields',
        description: 'Enter the student surname, given names, student number, and unit code before selecting Start.',
        variant: 'destructive',
      });
      return;
    }
    lookupUnit.mutate(
      { data: { unitCode: code.trim() } },
      {
        onSuccess: loadUnit,
        onError: () => toast({
          title: 'Lookup failed',
          description: 'Could not find the unit or training.gov.au is unavailable.',
          variant: 'destructive',
        }),
      },
    );
  };

  return (
    <Card className="border-purple-300/60 bg-white shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-zinc-100 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-purple-700">
            <UserRound className="h-4 w-4" /> Getting Started
          </div>
          <CardTitle className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">The Initial Interview</CardTitle>
          <CardDescription className="mt-1 max-w-4xl text-xs leading-5">
            Your RPL mapping process starts here at the pre-RPL interview. You will be entering the applicant&apos;s details at this stage. Typically, this would be an interview where you will inform your applicant of the process, the timeframes, and importantly that{' '}
            <strong className="font-bold">RPL is an assessment only process</strong>.
          </CardDescription>
        </div>
        <div className="hidden min-w-[160px] rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-semibold leading-5 text-white sm:block">
          <span>Pre-Assessment</span>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">
          Enter the applicant&apos;s name, details, and Unit of Competency (UOC), or use the selections provided on eLearn.
        </p>
        <form onSubmit={handleCodeSubmit} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold text-zinc-700">Surname <span className="text-rose-600">*</span></span>
            <Input placeholder="e.g. Morgan" value={intake.surname} onChange={event => updateIntake({ surname: event.target.value })} disabled={loading} />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold text-zinc-700">Given names <span className="text-rose-600">*</span></span>
            <Input placeholder="e.g. Alex" value={intake.givenNames} onChange={event => updateIntake({ givenNames: event.target.value })} disabled={loading} />
          </label>
          <label className="grid min-w-0 gap-1 lg:col-span-2">
            <span className="text-xs font-semibold text-zinc-700">Student number <span className="text-rose-600">*</span></span>
            <Input placeholder="e.g. 12345678" value={intake.studentNumber} onChange={event => updateIntake({ studentNumber: event.target.value })} disabled={loading} />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold text-zinc-700">USI</span>
            <Input placeholder="10-character USI" value={intake.usi} onChange={event => updateIntake({ usi: event.target.value.toUpperCase() })} maxLength={10} disabled={loading} />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-xs font-semibold text-zinc-700">Date of birth</span>
            <DatePickerInput value={intake.dateOfBirth} onChange={dateOfBirth => updateIntake({ dateOfBirth })} disabled={loading} ariaLabel="Date of birth" />
          </label>
          <label className="grid min-w-0 gap-1 lg:col-span-2">
            <span className="text-xs font-semibold text-zinc-700">Parent Qualification</span>
            <Input placeholder="e.g. Certificate III in Community Services" value={intake.organisation} onChange={event => updateIntake({ organisation: event.target.value })} disabled={loading} />
          </label>
          <label className="grid min-w-0 gap-1 lg:col-span-2">
            <span className="text-xs font-semibold text-zinc-700">Unit seeking RPL for <span className="text-rose-600">*</span></span>
            <Input placeholder="e.g. CHCCCS007" value={code} onChange={event => setCode(event.target.value.toUpperCase())} className="font-mono" disabled={loading} />
          </label>
          <div className="flex min-w-0 items-end lg:col-span-2">
            <Button type="submit" disabled={loading} className="h-9 w-full px-2 text-xs bg-purple-600 hover:bg-purple-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start
            </Button>
          </div>
        </form>

        <details className="mt-3 border-t border-zinc-100 pt-2">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <summary data-testid="summary-pre-rpl-interview" className="cursor-pointer text-[11px]">
                  <span className="inline-flex rounded-md bg-green-700 px-2.5 py-1 font-semibold text-white">
                    Pre-RPL Interview
                  </span>
                  <span className="ml-2 text-zinc-600">
                    Open here to record evidence of the initial RPL Interview.
                  </span>
                </summary>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs border border-green-800 bg-green-950 px-3 py-2 text-xs leading-5 text-white">
                Open here to record evidence of the initial RPL Interview.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="mt-2 space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-purple-800">RPL Pre-Assessment</h3>
            <section className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold text-zinc-700">Educator / assessor</span>
                <Input
                  placeholder="e.g. Jordan Lee"
                  value={intake.trainerName}
                  onChange={event => updateIntake({ trainerName: event.target.value })}
                  disabled={loading}
                  className="h-8 bg-white text-xs"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold text-zinc-700">RPL Start Date (DD/MM/YYYY)</span>
                <DatePickerInput
                  value={intake.assessmentDate}
                  onChange={assessmentDate => updateIntake({ assessmentDate })}
                  disabled={loading}
                  ariaLabel="RPL Start Date"
                  className="h-8 text-xs"
                />
              </label>
              <div className="flex items-center gap-2 lg:col-span-2">
                <Checkbox
                  id="pre-rpl-interview"
                  checked={intake.preRplChecklist.interviewCompleted}
                  onCheckedChange={value => updateChecklist({ interviewCompleted: value === true })}
                  disabled={loading}
                />
                <label htmlFor="pre-rpl-interview" className="cursor-pointer text-[11px] font-semibold text-zinc-800">Pre-RPL interview completed</label>
              </div>
            </section>
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold text-zinc-700">Pre-assessment interview notes</span>
              <textarea
                value={intake.preRplChecklist.interviewNotes}
                onChange={event => updateChecklist({ interviewNotes: event.target.value })}
                disabled={loading}
                rows={3}
                placeholder="Record key discussion points, candidate circumstances, and agreed next steps"
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
              />
            </label>

            <section className="border-t border-zinc-200 pt-2.5">
              <div className="mb-1.5">
                <h3 className="text-xs font-semibold text-zinc-900">Initial documents provided</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Tick each item received. Documents remain in the nominated evidence repository.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <ChecklistDocument
                  id="cv-resume"
                  label="CV / résumé"
                  checked={intake.preRplChecklist.cvResumeProvided}
                  disabled={loading}
                  onCheckedChange={checked => updateChecklist({ cvResumeProvided: checked })}
                />
                <ChecklistDocument
                  id="academic-transcript"
                  label="Academic transcript"
                  checked={intake.preRplChecklist.academicTranscriptProvided}
                  disabled={loading}
                  onCheckedChange={checked => updateChecklist({ academicTranscriptProvided: checked })}
                />
                <ChecklistDocument
                  id="position-description"
                  label="Current position description"
                  checked={intake.preRplChecklist.positionDescriptionProvided}
                  disabled={loading}
                  onCheckedChange={checked => updateChecklist({ positionDescriptionProvided: checked })}
                />
              </div>
            </section>

            <section className="border-t border-zinc-200 pt-2.5">
              <div className="mb-1.5">
                <h3 className="text-xs font-semibold text-zinc-900">Licensing</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Record licence or certification numbers and expiry dates where applicable.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="drivers-licence"
                      checked={intake.preRplChecklist.driversLicenceProvided}
                      onCheckedChange={value => updateChecklist({ driversLicenceProvided: value === true })}
                      disabled={loading}
                    />
                    <label htmlFor="drivers-licence" className="cursor-pointer text-xs font-semibold leading-4 text-zinc-800">Driver licence</label>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      value={intake.preRplChecklist.driversLicenceNumber}
                      onChange={event => updateChecklist({ driversLicenceNumber: event.target.value })}
                      placeholder="Licence number"
                      aria-label="Driver licence number"
                      disabled={loading || !intake.preRplChecklist.driversLicenceProvided}
                      className="h-8 text-xs"
                    />
                    <select
                      value={intake.preRplChecklist.driversLicenceState}
                      onChange={event => updateChecklist({ driversLicenceState: event.target.value })}
                      aria-label="Driver licence state or territory"
                      disabled={loading || !intake.preRplChecklist.driversLicenceProvided}
                      className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs outline-none focus:border-purple-700 disabled:bg-zinc-100"
                    >
                      <option value="">State / Territory</option>
                      {['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map(state => <option key={state} value={state}>{state}</option>)}
                    </select>
                    <DatePickerInput
                      value={intake.preRplChecklist.driversLicenceExpiry}
                      onChange={driversLicenceExpiry => updateChecklist({ driversLicenceExpiry })}
                      disabled={loading || !intake.preRplChecklist.driversLicenceProvided}
                      ariaLabel="Driver licence expiry date"
                      className="h-8 text-xs sm:col-span-2"
                    />
                  </div>
                </div>
                <LicenceItem id="white-card" label="White Card" checked={intake.preRplChecklist.whiteCardProvided} number={intake.preRplChecklist.whiteCardNumber} expiry={intake.preRplChecklist.whiteCardExpiry} disabled={loading} onCheckedChange={whiteCardProvided => updateChecklist({ whiteCardProvided })} onNumberChange={whiteCardNumber => updateChecklist({ whiteCardNumber })} onExpiryChange={whiteCardExpiry => updateChecklist({ whiteCardExpiry })} />
                <LicenceItem id="forklift-licence" label="Forklift" checked={intake.preRplChecklist.forkliftLicenceProvided} number={intake.preRplChecklist.forkliftLicenceNumber} expiry={intake.preRplChecklist.forkliftLicenceExpiry} disabled={loading} onCheckedChange={forkliftLicenceProvided => updateChecklist({ forkliftLicenceProvided })} onNumberChange={forkliftLicenceNumber => updateChecklist({ forkliftLicenceNumber })} onExpiryChange={forkliftLicenceExpiry => updateChecklist({ forkliftLicenceExpiry })} />
                <LicenceItem id="rsa" label="RSA" checked={intake.preRplChecklist.rsaProvided} number={intake.preRplChecklist.rsaNumber} expiry={intake.preRplChecklist.rsaExpiry} disabled={loading} onCheckedChange={rsaProvided => updateChecklist({ rsaProvided })} onNumberChange={rsaNumber => updateChecklist({ rsaNumber })} onExpiryChange={rsaExpiry => updateChecklist({ rsaExpiry })} />
                <LicenceItem id="asbestos-silica" label="Asbestos / Silica" checked={intake.preRplChecklist.asbestosSilicaProvided} number={intake.preRplChecklist.asbestosSilicaNumber} expiry={intake.preRplChecklist.asbestosSilicaExpiry} disabled={loading} onCheckedChange={asbestosSilicaProvided => updateChecklist({ asbestosSilicaProvided })} onNumberChange={asbestosSilicaNumber => updateChecklist({ asbestosSilicaNumber })} onExpiryChange={asbestosSilicaExpiry => updateChecklist({ asbestosSilicaExpiry })} />
                <LicenceItem id="wwvp" label="WWVP" checked={intake.preRplChecklist.wwvpProvided} number={intake.preRplChecklist.wwvpNumber} expiry={intake.preRplChecklist.wwvpExpiry} disabled={loading} onCheckedChange={wwvpProvided => updateChecklist({ wwvpProvided })} onNumberChange={wwvpNumber => updateChecklist({ wwvpNumber })} onExpiryChange={wwvpExpiry => updateChecklist({ wwvpExpiry })} />
              </div>
            </section>

            <section className="grid gap-2.5 border-t border-zinc-200 pt-2.5">
              <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-end">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sharepoint-repository"
                    checked={intake.preRplChecklist.sharePointRepositoryCreated}
                    onCheckedChange={value => updateChecklist({ sharePointRepositoryCreated: value === true })}
                    disabled={loading}
                  />
                  <label htmlFor="sharepoint-repository" className="cursor-pointer text-xs font-semibold text-zinc-800">SharePoint Evidence Repository</label>
                </div>
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">SharePoint path</span>
                  <Input
                    placeholder="https://… or document library / folder path"
                    value={intake.preRplChecklist.sharePointPath}
                    onChange={event => updateChecklist({ sharePointPath: event.target.value })}
                    disabled={loading}
                    className="h-8 bg-white text-xs"
                  />
                </label>
              </div>
              <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-end">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="elearn-storage"
                    checked={intake.preRplChecklist.elearnStorageCreated}
                    onCheckedChange={value => updateChecklist({ elearnStorageCreated: value === true })}
                    disabled={loading}
                  />
                  <label htmlFor="elearn-storage" className="cursor-pointer text-xs font-semibold text-zinc-800">eLearn Storage Repository</label>
                </div>
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold text-zinc-700">eLearn URL</span>
                  <Input
                    type="url"
                    placeholder="https://…"
                    value={intake.preRplChecklist.elearnUrl}
                    onChange={event => updateChecklist({ elearnUrl: event.target.value })}
                    disabled={loading || !intake.preRplChecklist.elearnStorageCreated}
                    className="h-8 bg-white text-xs"
                  />
                </label>
              </div>
            </section>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
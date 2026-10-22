import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileCheck2,
  GripVertical,
  Info,
  ListPlus,
  MessageSquareText,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { buildRows } from '@/lib/unit-rows';
import { exportRplToWord } from '@/lib/export-rpl-doc';
import {
  EVIDENCE_TYPES,
  EVIDENCE_COLOURS,
  EVIDENCE_LOCATIONS,
  EVIDENCE_STORAGE_LOCATIONS,
  EVIDENCE_MODES,
  EVIDENCE_FILE_FORMATS,
  EVIDENCE_CLASSIFICATIONS,
  createEmptyRplRecord,
  evidenceColourForClassification,
  evidenceCode,
  hasRplRecord,
  listRplStudents,
  loadRplRecordForStudent,
  loadRplRecord,
  newEvidenceId,
  persistRplRecord,
  type EvidenceItem,
  type EvidenceClassification,
  type EvidenceSubtype,
  type InterviewOutcome,
  type InterviewRecord,
  type RplRecord,
  type StudentRecordSummary,
  type StudentDetails,
  studentDisplayName,
} from '@/lib/rpl-state';

export type RplStage = 'student' | 'evidence' | 'mapping' | 'gaps' | 'review' | 'final';

const STAGES: Array<{ id: RplStage; label: string; short: string; icon: typeof UserRound }> = [
  { id: 'student', label: 'Student details', short: 'Student', icon: UserRound },
  { id: 'evidence', label: 'Evidence log', short: 'Evidence', icon: ListPlus },
  { id: 'mapping', label: 'RPL mapping', short: 'Mapping', icon: GripVertical },
  { id: 'gaps', label: 'Gaps interview', short: 'Gaps', icon: MessageSquareText },
  { id: 'review', label: 'Review', short: 'Review', icon: ClipboardCheck },
  { id: 'final', label: 'Outcome & sign-off', short: 'Outcome', icon: FileCheck2 },
];

type NewEvidenceDraft = Omit<EvidenceItem, 'id'>;

const DEFAULT_NEW_EVIDENCE: NewEvidenceDraft = {
  title: '',
  reference: '',
  notes: '',
  type: EVIDENCE_TYPES[0].value,
  colour: 'blue',
  locationIdentifier: '',
  location: EVIDENCE_LOCATIONS[0].value,
  storageLocations: [],
  evidenceModes: [],
  fileFormats: [],
  classifications: [],
  subtypes: [],
};

function statusForOutcome(outcome: InterviewOutcome) {
  if (outcome === 'resolved') return 'Resolved';
  if (outcome === 'not-resolved') return 'Not resolved';
  return 'Pending';
}

function tileStyle(item: Pick<EvidenceItem, 'classifications'>, expanded = false) {
  const colour = evidenceColourForClassification(item.classifications[0]);
  const palette = EVIDENCE_COLOURS.find(option => option.value === colour) ?? EVIDENCE_COLOURS[1];
  return expanded
    ? { backgroundColor: '#ffffff', borderColor: palette.color, color: '#18181b' }
    : { backgroundColor: palette.color, borderColor: palette.color, color: '#ffffff' };
}

function displayDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function EvidenceTile({
  evidence,
  index,
  compact = false,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  evidence: EvidenceItem;
  index: number;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onRemove?: () => void;
}) {
  const tile = (
    <>
      <span className="mr-1 font-mono font-bold">{evidenceCode(index)}</span>
      <span className="font-semibold">{evidence.title}</span>
      {!compact && evidence.reference && <span className="mt-0.5 block opacity-75">{evidence.reference}</span>}
    </>
  );
  return (
    <div
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative block h-full min-h-10 w-full rounded-md border-l-4 px-2 py-1.5 text-left shadow-[2px_2px_0_rgba(24,24,27,0.16)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(24,24,27,0.2)] active:scale-[0.98] ${selected ? 'ring-2 ring-purple-900 ring-offset-2' : ''} ${compact ? 'text-[11px]' : 'text-xs'}`}
      style={tileStyle(evidence)}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="block w-full text-left outline-none"
          title={onDragStart ? 'Drag to a requirement, or select then use the Map button in a requirement' : evidence.title}
        >
          {tile}
          <span className="mt-1 flex flex-wrap gap-1">
            {evidence.classifications.map(value => (
              <span key={value} className="rounded bg-black/20 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                {EVIDENCE_CLASSIFICATIONS.find(group => group.value === value)?.name}
              </span>
            ))}
          </span>
        </button>
      ) : tile}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${evidence.title} from this requirement`}
          className="absolute right-1.5 top-1 rounded p-0.5 text-zinc-700 opacity-0 hover:bg-white/70 group-hover:opacity-100"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}

function FieldLabel({ children, compact = false }: { children: string; compact?: boolean }) {
  const typography = compact ? 'text-[11px] tracking-[0.08em]' : 'text-xs tracking-[0.11em]';
  return <label className={`mb-1 block font-bold uppercase ${typography} text-zinc-600`}>{children}</label>;
}

function EvidenceOptionCheckboxes({
  legend,
  options,
  selectedValues,
  onChange,
}: {
  legend: string;
  options: readonly { name: string; value: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 block text-xs font-bold uppercase tracking-[0.11em] text-zinc-600">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const checked = selectedValues.includes(option.value);
          return (
            <label key={option.value} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${checked ? 'border-purple-400 bg-purple-50 text-purple-900' : 'border-zinc-200 bg-white text-zinc-700 hover:border-purple-300'}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(checked ? selectedValues.filter(value => value !== option.value) : [...selectedValues, option.value])}
                className="accent-purple-700"
              />
              {option.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function EvidenceClassificationFields({
  classifications,
  subtypes,
  onChange,
  compact = false,
  radioName,
}: {
  classifications: EvidenceClassification[];
  subtypes: EvidenceSubtype[];
  onChange: (patch: Pick<EvidenceItem, 'classifications' | 'subtypes'>) => void;
  compact?: boolean;
  radioName: string;
}) {
  const selectClassification = (classification: EvidenceClassification) => {
    const allowedSubtypes = new Set(
      EVIDENCE_CLASSIFICATIONS
        .filter(group => group.value === classification)
        .flatMap(group => group.subtypes.map(subtype => subtype.value)),
    );
    onChange({
      classifications: [classification],
      subtypes: subtypes.filter(subtype => allowedSubtypes.has(subtype)),
    });
  };
  const toggleSubtype = (subtype: EvidenceSubtype) => {
    onChange({
      classifications,
      subtypes: subtypes.includes(subtype) ? subtypes.filter(item => item !== subtype) : [...subtypes, subtype],
    });
  };
  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <div className="flex flex-wrap gap-2">
        {EVIDENCE_CLASSIFICATIONS.map(group => (
          <label key={group.value} title={group.description} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition ${classifications.includes(group.value) ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-zinc-200 bg-white text-zinc-600 hover:border-purple-300'}`}>
            <input type="radio" name={radioName} checked={classifications.includes(group.value)} onChange={() => selectClassification(group.value)} className="accent-purple-700" />
            {group.name}
          </label>
        ))}
      </div>
      {classifications.length > 0 && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {EVIDENCE_CLASSIFICATIONS.filter(group => classifications.includes(group.value)).flatMap(group =>
            group.subtypes.map(subtype => (
              <label key={subtype.value} className="flex cursor-pointer items-start gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] leading-4 text-zinc-700 hover:border-purple-300">
                <input type="checkbox" checked={subtypes.includes(subtype.value)} onChange={() => toggleSubtype(subtype.value)} className="mt-0.5 accent-purple-700" />
                {subtype.name}
              </label>
            )),
          )}
        </div>
      )}
    </div>
  );
}

function withPreRplEvidence(current: RplRecord): RplRecord {
  const checklist = current.student.preRplChecklist;
  const candidates: Array<{ provided: boolean; title: string; reference: string; sourceKey: NonNullable<EvidenceItem['sourceKey']> }> = [
    { provided: checklist.cvResumeProvided, title: 'CV / résumé', reference: checklist.cvResumeFileName, sourceKey: 'pre-rpl-cv' },
    { provided: checklist.academicTranscriptProvided, title: 'Academic transcript', reference: checklist.academicTranscriptFileName, sourceKey: 'pre-rpl-transcript' },
    { provided: checklist.positionDescriptionProvided, title: 'Current position description', reference: checklist.positionDescriptionFileName, sourceKey: 'pre-rpl-position-description' },
    { provided: checklist.jobCardProvided, title: 'Job Card', reference: '', sourceKey: 'pre-rpl-job-card' },
    { provided: checklist.driversLicenceProvided, title: 'Driver licence', reference: [checklist.driversLicenceNumber, checklist.driversLicenceState, checklist.driversLicenceExpiry && `Expires ${displayDate(checklist.driversLicenceExpiry)}`].filter(Boolean).join(' · '), sourceKey: 'pre-rpl-drivers-licence' },
    { provided: checklist.whiteCardProvided, title: 'White Card', reference: [checklist.whiteCardNumber, checklist.whiteCardExpiry && `Expires ${displayDate(checklist.whiteCardExpiry)}`].filter(Boolean).join(' · '), sourceKey: 'pre-rpl-white-card' },
    { provided: checklist.forkliftLicenceProvided, title: 'Forklift licence', reference: [checklist.forkliftLicenceNumber, checklist.forkliftLicenceExpiry && `Expires ${displayDate(checklist.forkliftLicenceExpiry)}`].filter(Boolean).join(' · '), sourceKey: 'pre-rpl-forklift' },
    { provided: checklist.rsaProvided, title: 'RSA', reference: [checklist.rsaNumber, checklist.rsaExpiry && `Expires ${displayDate(checklist.rsaExpiry)}`].filter(Boolean).join(' · '), sourceKey: 'pre-rpl-rsa' },
    { provided: checklist.asbestosSilicaProvided, title: 'Asbestos / Silica', reference: [checklist.asbestosSilicaNumber, checklist.asbestosSilicaExpiry && `Expires ${displayDate(checklist.asbestosSilicaExpiry)}`].filter(Boolean).join(' · '), sourceKey: 'pre-rpl-asbestos-silica' },
    { provided: checklist.wwvpProvided, title: 'WWVP/WWCC/Ochre/Pink Card', reference: [checklist.wwvpNumber, checklist.wwvpExpiry && `Expires ${displayDate(checklist.wwvpExpiry)}`].filter(Boolean).join(' · '), sourceKey: 'pre-rpl-wwvp' },
  ];
  const additions = candidates
    .filter(candidate => candidate.provided && !current.evidence.some(item => item.sourceKey === candidate.sourceKey))
    .map(candidate => ({
      id: newEvidenceId(),
      title: candidate.title,
      reference: candidate.reference,
      notes: 'Provided during Pre-RPL intake',
      type: candidate.sourceKey === 'pre-rpl-cv'
        ? 'professional-resume' as const
        : candidate.sourceKey === 'pre-rpl-transcript'
          ? 'academic-transcript' as const
          : candidate.sourceKey === 'pre-rpl-position-description'
            ? 'position-description' as const
            : candidate.sourceKey === 'pre-rpl-job-card'
              ? 'job-card' as const
            : 'other' as const,
      colour: 'blue' as const,
      locationIdentifier: '',
      location: checklist.sharePointRepositoryCreated || checklist.elearnStorageCreated || checklist.sharePointPath.trim() || checklist.elearnUrl.trim()
        ? 'digital-sharepoint' as const
        : 'sighted-logged' as const,
      storageLocations: [
        ...(checklist.elearnStorageCreated || checklist.elearnUrl.trim() ? ['elearn' as const] : []),
        ...(checklist.sharePointRepositoryCreated || checklist.sharePointPath.trim() ? ['sharepoint' as const] : []),
      ],
      evidenceModes: [],
      fileFormats: [],
      classifications: ['indirect'] as EvidenceClassification[],
      subtypes: ['work-sample-portfolio'] as EvidenceSubtype[],
      sourceKey: candidate.sourceKey,
    }));
  return additions.length ? { ...current, evidence: [...current.evidence, ...additions] } : current;
}

export function RplWorkflow({ unit, studentNumber, prefill, initialStage = 'student', stageRequest = 0, onFinish }: { unit: UnitOfCompetency; studentNumber?: string; prefill?: StudentDetails; initialStage?: RplStage; stageRequest?: number; onFinish: () => void }) {
  const hasPrefill = Boolean(prefill?.surname || prefill?.givenNames || prefill?.studentNumber);
  const [record, setRecord] = useState<RplRecord>(() => {
    const loaded = studentNumber
      ? loadRplRecordForStudent(unit.code, studentNumber)
      : hasPrefill
        ? createEmptyRplRecord()
        : loadRplRecord(unit.code);
    const merged = prefill ? { ...loaded, student: { ...loaded.student, ...prefill } } : loaded;
    return withPreRplEvidence(merged);
  });
  const [activeRecordStudentNumber, setActiveRecordStudentNumber] = useState(
    () => studentNumber ?? (hasPrefill ? 'draft' : (loadRplRecord(unit.code).student.studentNumber.trim() || 'draft')),
  );
  const [savedStudents, setSavedStudents] = useState<StudentRecordSummary[]>(() => listRplStudents(unit.code));
  const [recordConflict, setRecordConflict] = useState<string | null>(null);
  const [stage, setStage] = useState<RplStage>(initialStage);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [dragEvidenceId, setDragEvidenceId] = useState<string | null>(null);
  const [dragTargetRowKey, setDragTargetRowKey] = useState<string | null>(null);
  const [newEvidence, setNewEvidence] = useState(DEFAULT_NEW_EVIDENCE);
  const [exported, setExported] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState<Set<string>>(new Set());
  const [collapsedMappingSections, setCollapsedMappingSections] = useState<Set<string>>(new Set());
  const [reasonableAdjustmentHovered, setReasonableAdjustmentHovered] = useState(false);
  const [reasonableAdjustmentPinned, setReasonableAdjustmentPinned] = useState(false);
  const [assessmentGuidanceHovered, setAssessmentGuidanceHovered] = useState(false);
  const [assessmentGuidancePinned, setAssessmentGuidancePinned] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const reasonableAdjustmentInfoOpen = reasonableAdjustmentHovered || reasonableAdjustmentPinned;
  const assessmentGuidanceOpen = assessmentGuidanceHovered || assessmentGuidancePinned;

  useEffect(() => {
    const currentStudentNumber = record.student.studentNumber.trim() || 'draft';
    if (currentStudentNumber === activeRecordStudentNumber) {
      persistRplRecord(unit.code, record, activeRecordStudentNumber === 'draft' ? '' : activeRecordStudentNumber);
      setSavedStudents(listRplStudents(unit.code));
    }
  }, [activeRecordStudentNumber, record, unit.code]);

  useEffect(() => {
    if (import.meta.env.DEV) setStage(initialStage);
  }, [initialStage, stageRequest]);

  const rows = useMemo(() => buildRows(unit), [unit]);
  const requirementRows = useMemo(
    () => rows.filter((row): row is Extract<typeof row, { kind: 'data' }> => row.kind === 'data'),
    [rows],
  );
  const gapGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; rows: typeof requirementRows }> = [];
    let current = { key: 'performance-criteria', label: 'Performance Criteria', rows: [] as typeof requirementRows };
    groups.push(current);
    for (const row of rows) {
      if (row.kind === 'span' && (row.style === 'element' || row.style === 'section')) {
        current = { key: row.key, label: row.label, rows: [] };
        groups.push(current);
      } else if (row.kind === 'data') {
        current.rows.push(row);
      }
    }
    const uncoveredKeys = new Set(requirementRows.filter(row => !(record.mappings[row.key]?.length)).map(row => row.key));
    return groups
      .map(group => ({ ...group, rows: group.rows.filter(row => uncoveredKeys.has(row.key)) }))
      .filter(group => group.rows.length);
  }, [record.mappings, requirementRows, rows]);
  const visibleMappingRows = useMemo(() => {
    const visible: typeof rows = [];
    let hidden = false;
    for (const row of rows) {
      const broadSection = row.kind === 'span' && (row.style === 'element' || row.style === 'section');
      if (broadSection) {
        visible.push(row);
        hidden = collapsedMappingSections.has(row.key);
      } else if (!hidden) {
        visible.push(row);
      }
    }
    return visible;
  }, [collapsedMappingSections, rows]);
  const evidenceById = useMemo(() => new Map(record.evidence.map(item => [item.id, item])), [record.evidence]);
  const uncoveredRows = requirementRows.filter(row => !(record.mappings[row.key]?.length));
  const resolvedGaps = uncoveredRows.filter(row => record.interviews[row.key]?.outcome === 'resolved').length;
  const coveredRows = requirementRows.length - uncoveredRows.length;
  const selectedEvidence = record.evidence.find(item => item.id === selectedEvidenceId) ?? null;
  const stageIndex = STAGES.findIndex(item => item.id === stage);
  const studentName = studentDisplayName(record.student);
  const hasStudent = Boolean(record.student.surname.trim() && record.student.givenNames.trim() && record.student.studentNumber.trim());

  const updateRecord = (fn: (current: RplRecord) => RplRecord) => {
    setRecord(current => fn(current));
  };

  const addEvidence = () => {
    if (!newEvidence.title.trim() || newEvidence.classifications.length === 0) return;
    updateRecord(current => ({
      ...current,
      evidence: [...current.evidence, { ...newEvidence, id: newEvidenceId(), title: newEvidence.title.trim() }],
    }));
    setNewEvidence(DEFAULT_NEW_EVIDENCE);
  };

  const updateEvidence = (id: string, patch: Partial<EvidenceItem>) => {
    updateRecord(current => ({
      ...current,
      evidence: current.evidence.map(item => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const deleteEvidence = (id: string) => {
    updateRecord(current => {
      const mappings = Object.fromEntries(
        Object.entries(current.mappings).map(([rowKey, ids]) => [rowKey, ids.filter(itemId => itemId !== id)]),
      );
      return { ...current, evidence: current.evidence.filter(item => item.id !== id), mappings };
    });
    if (selectedEvidenceId === id) setSelectedEvidenceId(null);
  };

  const mapEvidence = (rowKey: string, evidenceId: string) => {
    updateRecord(current => {
      const existing = current.mappings[rowKey] ?? [];
      if (existing.includes(evidenceId)) return current;
      return { ...current, mappings: { ...current.mappings, [rowKey]: [...existing, evidenceId] } };
    });
  };

  const unmapEvidence = (rowKey: string, evidenceId: string) => {
    updateRecord(current => ({
      ...current,
      mappings: { ...current.mappings, [rowKey]: (current.mappings[rowKey] ?? []).filter(id => id !== evidenceId) },
    }));
  };

  const updateInterview = (rowKey: string, patch: Partial<InterviewRecord>) => {
    updateRecord(current => ({
      ...current,
      interviews: {
        ...current.interviews,
        [rowKey]: {
          ...(current.interviews[rowKey] ?? {
            question: '',
            studentResponse: '',
            assessorNotes: '',
            outcome: 'pending' as InterviewOutcome,
          }),
          ...patch,
        },
      },
    }));
  };

  const goNext = () => {
    if (stage === 'final') {
      onFinish();
      return;
    }
    if (stage === 'student') {
      saveStudentAndContinue();
      return;
    }
    setStage(STAGES[Math.min(stageIndex + 1, STAGES.length - 1)].id);
  };
  const goPrevious = () => setStage(STAGES[Math.max(stageIndex - 1, 0)].id);
  const devSkip = (direction: -1 | 1) => {
    setStage(STAGES[Math.max(0, Math.min(stageIndex + direction, STAGES.length - 1))].id);
  };

  const saveProgress = () => {
    persistRplRecord(unit.code, record, activeRecordStudentNumber === 'draft' ? '' : activeRecordStudentNumber);
    setSavedStudents(listRplStudents(unit.code));
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1600);
  };

  const onDrop = (rowKey: string) => {
    const evidenceId = dragEvidenceId ?? selectedEvidenceId;
    if (!evidenceId) return;
    mapEvidence(rowKey, evidenceId);
    setDragEvidenceId(null);
    setDragTargetRowKey(null);
  };

  const saveStudentAndContinue = () => {
    const nextStudentNumber = record.student.studentNumber.trim();
    if (!hasStudent) return;
    if (nextStudentNumber !== activeRecordStudentNumber && hasRplRecord(unit.code, nextStudentNumber)) {
      setRecordConflict(nextStudentNumber);
      return;
    }
    const nextRecord = withPreRplEvidence(record);
    setRecord(nextRecord);
    setActiveRecordStudentNumber(nextStudentNumber);
    persistRplRecord(unit.code, nextRecord, nextStudentNumber);
    setSavedStudents(listRplStudents(unit.code));
    setRecordConflict(null);
    setStage('evidence');
  };

  const openSavedStudent = (studentNumber: string) => {
    setRecord(loadRplRecordForStudent(unit.code, studentNumber));
    setActiveRecordStudentNumber(studentNumber);
    setRecordConflict(null);
    setStage('student');
  };

  const replaceSavedStudent = () => {
    if (!recordConflict) return;
    setActiveRecordStudentNumber(recordConflict);
    persistRplRecord(unit.code, record, recordConflict);
    setSavedStudents(listRplStudents(unit.code));
    setRecordConflict(null);
    setStage('evidence');
  };

  const startNewStudent = () => {
    setRecord(createEmptyRplRecord());
    setActiveRecordStudentNumber('draft');
    setSelectedEvidenceId(null);
    setRecordConflict(null);
    setStage('student');
  };

  const renderStudent = () => (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <p className="text-xs font-semibold text-purple-800">Start an RPL record</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-zinc-900">Student details</h2>
        <p className="mt-1 max-w-xl text-xs leading-4 text-zinc-600">
          This record is saved in this browser against the unit and student number, so you can return to the RPL assessment later.
        </p>
        <p className="mt-2 text-[11px] font-medium text-amber-800">
          Assessor to check all details before progressing to the evidence register.
        </p>
        {savedStudents.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <span className="mr-1 text-xs font-semibold text-zinc-600">Open a saved student:</span>
            {savedStudents.map(student => (
              <button key={student.studentNumber} type="button" onClick={() => openSavedStudent(student.studentNumber)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${student.studentNumber === activeRecordStudentNumber ? 'border-purple-700 bg-purple-100 text-purple-900' : 'border-zinc-300 bg-white text-zinc-700 hover:border-purple-400'}`}>
                {studentDisplayName(student) || 'Unnamed'} · {student.studentNumber}
              </button>
            ))}
            <button type="button" onClick={startNewStudent} className="rounded-full border border-dashed border-zinc-400 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-purple-500 hover:text-purple-800">New record</button>
          </div>
        )}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel compact>Surname</FieldLabel>
            <input
              value={record.student.surname}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, surname: event.target.value } }))}
              placeholder="e.g. Morgan"
              className="h-9 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div>
            <FieldLabel compact>Given names</FieldLabel>
            <input
              value={record.student.givenNames}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, givenNames: event.target.value } }))}
              placeholder="e.g. Alex"
              className="h-9 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div>
            <FieldLabel compact>Student number</FieldLabel>
            <input
              value={record.student.studentNumber}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, studentNumber: event.target.value } }))}
              placeholder="e.g. 12345678"
              className="h-9 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div>
            <FieldLabel compact>USI</FieldLabel>
            <input
              value={record.student.usi}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, usi: event.target.value.toUpperCase() } }))}
              placeholder="10-character USI"
              maxLength={10}
              className="h-9 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs uppercase outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div>
            <FieldLabel compact>Date of birth</FieldLabel>
            <DatePickerInput
              value={record.student.dateOfBirth}
              onChange={dateOfBirth => updateRecord(current => ({ ...current, student: { ...current.student, dateOfBirth } }))}
              ariaLabel="Date of birth"
              className="h-9 px-2 text-xs"
            />
          </div>
          <div>
            <FieldLabel compact>Trainer / assessor</FieldLabel>
            <input
              value={record.student.trainerName}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, trainerName: event.target.value } }))}
              placeholder="e.g. Jordan Lee"
              className="h-9 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <FieldLabel compact>Parent Qualification</FieldLabel>
            <input
              value={record.student.organisation}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, organisation: event.target.value } }))}
              placeholder="e.g. Your RTO"
              className="h-9 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div className="grid gap-2.5 sm:col-span-2 sm:grid-cols-3 lg:col-span-3">
            <div>
              <FieldLabel compact>RPL Start Date (DD/MM/YYYY)</FieldLabel>
              <DatePickerInput
                value={record.student.assessmentDate}
                onChange={assessmentDate => updateRecord(current => ({ ...current, student: { ...current.student, assessmentDate } }))}
                ariaLabel="RPL Start Date"
                className="h-9 bg-zinc-50 px-2 text-xs"
              />
            </div>
            <div>
              <FieldLabel compact>Evidence Presentation Session Booked</FieldLabel>
              <DatePickerInput
                value={record.student.evidencePresentationSessionDate}
                onChange={evidencePresentationSessionDate => updateRecord(current => ({ ...current, student: { ...current.student, evidencePresentationSessionDate } }))}
                ariaLabel="Evidence Presentation Session Booked"
                className="h-9 bg-zinc-50 px-2 text-xs"
              />
            </div>
            <div>
              <FieldLabel compact>Gaps Assessment Session Booked</FieldLabel>
              <DatePickerInput
                value={record.student.gapsAssessmentSessionDate}
                onChange={gapsAssessmentSessionDate => updateRecord(current => ({ ...current, student: { ...current.student, gapsAssessmentSessionDate } }))}
                ariaLabel="Gaps Assessment Session Booked"
                className="h-9 bg-zinc-50 px-2 text-xs"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2.5 rounded-lg border border-purple-200 bg-purple-50/50 p-2.5 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] sm:items-start">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="disability-access-plan"
                checked={record.student.disabilityAccessPlan}
                onCheckedChange={checked => updateRecord(current => ({ ...current, student: { ...current.student, disabilityAccessPlan: checked === true } }))}
                className="mt-0.5"
              />
              <label htmlFor="disability-access-plan" className="cursor-pointer text-xs font-semibold text-zinc-800">
                Disability Access Plan (DAP)
              </label>
            </div>
            <div
              className="relative"
              onMouseEnter={() => setReasonableAdjustmentHovered(true)}
              onMouseLeave={() => setReasonableAdjustmentHovered(false)}
              onFocusCapture={() => setReasonableAdjustmentHovered(true)}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setReasonableAdjustmentHovered(false);
                }
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  setReasonableAdjustmentHovered(false);
                  setReasonableAdjustmentPinned(false);
                }
              }}
            >
              <button
                type="button"
                aria-label="Show reasonable adjustment guidance"
                aria-expanded={reasonableAdjustmentInfoOpen}
                aria-controls="reasonable-adjustment-guidance"
                aria-haspopup="dialog"
                onClick={() => {
                  if (reasonableAdjustmentPinned) {
                    setReasonableAdjustmentPinned(false);
                    setReasonableAdjustmentHovered(false);
                  } else {
                    setReasonableAdjustmentPinned(true);
                  }
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-green-600 px-2.5 text-[11px] font-bold text-white transition hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
              >
                <Info aria-hidden="true" className="h-5 w-5" />
                Reasonable Adjustment
              </button>
              {reasonableAdjustmentInfoOpen && (
                <div
                  id="reasonable-adjustment-guidance"
                  role="dialog"
                  aria-label="Reasonable adjustment guidance"
                  className="absolute left-0 top-full z-50 mt-2 max-h-[min(70vh,34rem)] w-[calc(100vw-2rem)] max-w-[28rem] overflow-y-auto rounded-xl border border-emerald-700 bg-[#052e24]/90 p-4 text-left text-[11px] leading-4 text-green-50 shadow-xl"
                >
                  <p>
                    A reasonable adjustment in the Australian Vocational Education and Training (VET) sector is a modification or measure made to training, learning, or assessment methods to help students with disability participate on the same basis as students without disability, as outlined by the{' '}
                    <a
                      href="https://www.asqa.gov.au/for-providers/standards-for-RTOs/practice-guides/quality-area-2-vet-student-support/training-support-practice-guide"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-white underline decoration-green-300 underline-offset-2 hover:text-green-200"
                    >
                      Australian Skills Quality Authority (ASQA)
                    </a>.
                  </p>
                  <p className="mt-3 font-semibold text-white">Core Principles</p>
                  <ul className="mt-1 list-disc space-y-1.5 pl-4 text-[10px] leading-4 text-green-50/95">
                    <li><strong>Equal Access:</strong> Adjustments change the pathway, not the destination or core competency requirements.</li>
                    <li><strong>Legal Obligation:</strong> Registered Training Organisations (RTOs) must comply with Standard 2.4 and the Disability Standards for Education 2005 under the Disability Discrimination Act 1992.</li>
                    <li><strong>No Unjustifiable Hardship:</strong> An adjustment is reasonable unless it imposes an unjustifiable hardship on the RTO or compromises the integrity of the training product.</li>
                    <li><strong>Student Choice:</strong> Students have the right to choose whether to disclose a disability.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          <label className="grid gap-1">
            <FieldLabel compact>Record reasonable adjustments negotiated here</FieldLabel>
            <textarea
              value={record.student.reasonableAdjustments}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, reasonableAdjustments: event.target.value } }))}
              rows={4}
              placeholder="Record reasonable adjustments negotiated here"
              className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs leading-4 outline-none transition focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </label>
        </div>
        {recordConflict && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950">
            <p>A saved record already exists for student number <strong>{recordConflict}</strong>. Open the saved record to avoid overwriting it, or intentionally replace it with the details above.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openSavedStudent(recordConflict)}>Open saved record</Button>
              <Button size="sm" className="bg-amber-700 hover:bg-amber-600" onClick={replaceSavedStudent}>Replace saved record</Button>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg border-l-4 border-purple-600 bg-purple-50 p-3 text-purple-900">
          <p className="text-xs font-medium leading-4">The assessor should check that all student details are correct. The RPL Start Date marks when the candidate can begin collecting evidence.</p>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <Checkbox
            id="student-informed"
            checked={record.student.studentInformed}
            onCheckedChange={(checked) => updateRecord(current => ({ ...current, student: { ...current.student, studentInformed: checked === true } }))}
            className="mt-0.5"
          />
          <label htmlFor="student-informed" className="cursor-pointer text-xs font-medium leading-4 text-zinc-800">
            Student has been informed of the evidence they need to collect and provide as evidence to be assessed.
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={saveStudentAndContinue} disabled={!hasStudent} className="bg-purple-800 hover:bg-purple-700">
            Save and continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
      <aside className="rounded-xl border border-purple-950 bg-purple-900 p-4 text-purple-50 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-purple-200">CONFIRMATION BY ASSESSOR</h3>
        <p className="mt-2 text-sm font-medium leading-5">
          Your evidence will now be logged into a register of your evidence and then mapped against the unit of competence.
        </p>
        <img
          src={`${import.meta.env.BASE_URL}images/assessment-principles-rules.png`}
          alt="Infographic summarising the principles of assessment and rules of evidence"
          loading="lazy"
          decoding="async"
          className="-mx-2 mt-3 block h-auto w-[calc(100%+1rem)] max-w-none rounded-lg object-contain"
        />
        <div className="mt-3 flex items-start gap-2">
          <Checkbox
            id="assessment-principles-informed"
            checked={record.assessmentPrinciplesInformed}
            onCheckedChange={checked => updateRecord(current => ({ ...current, assessmentPrinciplesInformed: checked === true }))}
            className="mt-0.5 border-purple-300 data-[state=checked]:border-purple-200"
          />
          <label htmlFor="assessment-principles-informed" className="cursor-pointer text-xs font-bold leading-4 text-purple-50">
            Applicant has been informed of the principles of assessment.
          </label>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <Checkbox
            id="evidence-rules-informed"
            checked={record.evidenceRulesInformed}
            onCheckedChange={checked => updateRecord(current => ({ ...current, evidenceRulesInformed: checked === true }))}
            className="mt-0.5 border-purple-300 data-[state=checked]:border-purple-200"
          />
          <label htmlFor="evidence-rules-informed" className="cursor-pointer text-xs font-bold leading-4 text-purple-50">
            Applicant has been informed of the rules of evidence.
          </label>
        </div>
        <div
          className="relative mt-3 w-fit"
          onMouseEnter={() => setAssessmentGuidanceHovered(true)}
          onMouseLeave={() => setAssessmentGuidanceHovered(false)}
          onFocusCapture={() => setAssessmentGuidanceHovered(true)}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setAssessmentGuidanceHovered(false);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setAssessmentGuidanceHovered(false);
              setAssessmentGuidancePinned(false);
            }
          }}
        >
          <button
            type="button"
            aria-label="Show principles of assessment and rules of evidence guidance"
            aria-expanded={assessmentGuidanceOpen}
            aria-controls="assessment-guidance-panel"
            aria-haspopup="dialog"
            onClick={() => {
              if (assessmentGuidancePinned) {
                setAssessmentGuidancePinned(false);
                setAssessmentGuidanceHovered(false);
              } else {
                setAssessmentGuidancePinned(true);
              }
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-green-600 px-2.5 text-[11px] font-bold text-white transition hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
          >
            <Info aria-hidden="true" className="h-5 w-5" />
            Principles &amp; Rules
          </button>
          {assessmentGuidanceOpen && (
            <div
              id="assessment-guidance-panel"
              role="dialog"
              aria-label="Principles of assessment and rules of evidence"
              className="absolute right-0 top-full z-50 mt-2 max-h-[min(75vh,42rem)] w-[calc(100vw-2rem)] max-w-[40rem] overflow-y-auto rounded-xl border border-emerald-700 bg-[#052e24]/90 p-4 text-left text-[11px] leading-4 text-green-50 shadow-xl"
            >
              <p>
                The <strong>2025 Standards for RTOs</strong> require assessments to be fair, consistent and supported by quality evidence that demonstrates a learner&apos;s competence.
              </p>
              <p className="mt-2">
                <strong>Standard 1.3 – Assessment Systems</strong> requires assessment to be fit for purpose and aligned with the requirements of the relevant training product, including units of competency.
              </p>
              <p className="mt-2">
                <strong>Standard 1.4 – Conducting Assessment</strong> establishes the two essential requirements shown in the infographic above.
              </p>
              <p className="mt-2">
                <strong>Standard 1.5 – Validation</strong> requires regular review of assessment practices and judgements to maintain quality and consistency.
              </p>
              <p className="mt-2">
                For <strong>Recognition of Prior Learning (RPL)</strong>, these requirements are particularly important. Assessors must evaluate existing skills, knowledge and experience against unit requirements, identify any evidence gaps and make defensible decisions about competence.
              </p>
              <p className="mt-2">
                <strong>Standard 1.6 – Recognition of Prior Learning</strong> reinforces the requirement to support learners in seeking recognition of their existing capabilities.
              </p>
              <p className="mt-2 font-medium text-white">
                Together, these Standards help ensure that assessment decisions are fair, evidence-based and trustworthy.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );

  const renderEvidence = () => (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-purple-800">Evidence register</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Log a piece of evidence</h2>
          </div>
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">{record.evidence.length} logged</Badge>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(170px,1.1fr)_minmax(155px,0.9fr)_minmax(210px,1.2fr)_160px]">
          <label className="grid gap-1 text-xs font-semibold text-zinc-600">
            Evidence title
            <input
              value={newEvidence.title}
              onChange={event => setNewEvidence(current => ({ ...current, title: event.target.value }))}
              placeholder="Evidence title"
              className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm font-normal outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-zinc-600">
            Evidence type
            <select
              value={newEvidence.type}
              onChange={event => setNewEvidence(current => ({ ...current, type: event.target.value as EvidenceItem['type'] }))}
              className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-sm font-normal outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            >
              {EVIDENCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-zinc-600">
            Location / Workplace Identifier
            <input
              value={newEvidence.locationIdentifier}
              onChange={event => setNewEvidence(current => ({ ...current, locationIdentifier: event.target.value }))}
              placeholder="Location, workplace or identifier"
              className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm font-normal outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-zinc-600">
            Reference date
            <input
              type="date"
              value={newEvidence.reference}
              onChange={event => setNewEvidence(current => ({ ...current, reference: event.target.value }))}
              className="h-9 min-w-0 rounded-md border border-zinc-300 px-2 text-sm font-normal outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </label>
        </div>
        <label className="mt-3 grid gap-1 text-xs font-semibold text-zinc-600">
          Description
          <span className="font-normal text-zinc-500">Assessor to describe the evidence provided fully.</span>
          <textarea
            value={newEvidence.notes}
            onChange={event => setNewEvidence(current => ({ ...current, notes: event.target.value }))}
            placeholder="Describe the evidence provided"
            aria-label="Evidence description"
            rows={4}
            className="min-h-24 resize-y rounded-md border border-zinc-300 px-2.5 py-2 text-sm font-normal outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
          />
        </label>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <EvidenceOptionCheckboxes
            legend="Storage"
            options={EVIDENCE_STORAGE_LOCATIONS}
            selectedValues={newEvidence.storageLocations}
            onChange={values => setNewEvidence(current => ({ ...current, storageLocations: values as EvidenceItem['storageLocations'] }))}
          />
          <EvidenceOptionCheckboxes
            legend="Evidence form"
            options={EVIDENCE_MODES}
            selectedValues={newEvidence.evidenceModes}
            onChange={values => setNewEvidence(current => ({ ...current, evidenceModes: values as EvidenceItem['evidenceModes'] }))}
          />
        </div>
        <div className="mt-3">
          <EvidenceOptionCheckboxes
            legend="File format"
            options={EVIDENCE_FILE_FORMATS}
            selectedValues={newEvidence.fileFormats}
            onChange={values => setNewEvidence(current => ({ ...current, fileFormats: values as EvidenceItem['fileFormats'] }))}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Evidence classification</FieldLabel>
          <EvidenceClassificationFields
            classifications={newEvidence.classifications}
            subtypes={newEvidence.subtypes}
            radioName="new-evidence-classification"
            onChange={patch => setNewEvidence(current => ({
              ...current,
              ...patch,
              colour: evidenceColourForClassification(patch.classifications[0]),
            }))}
            compact
          />
          <p className="mt-1 text-[11px] text-zinc-500">Choose one classification; the card colour is assigned automatically.</p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={addEvidence}
            disabled={!newEvidence.title.trim() || newEvidence.classifications.length === 0}
            className="whitespace-nowrap bg-purple-800 hover:bg-purple-700"
          >
            <Plus className="mr-1.5 h-4 w-4" />Add evidence
          </Button>
        </div>
      </section>

      {record.evidence.length ? (
        <section className="space-y-2">
          {record.evidence.map((evidence, index) => {
            const expanded = expandedEvidenceIds.has(evidence.id);
            const typeName = EVIDENCE_TYPES.find(type => type.value === evidence.type)?.name ?? 'Other';
            const evidenceLocationSummary = [
              evidence.locationIdentifier,
              evidence.storageLocations.map(value => EVIDENCE_STORAGE_LOCATIONS.find(option => option.value === value)?.name).filter(Boolean).join(', '),
              evidence.evidenceModes.map(value => EVIDENCE_MODES.find(option => option.value === value)?.name).filter(Boolean).join(', '),
            ].filter(Boolean).join(' · ') || 'Location not recorded';
            return (
              <article key={evidence.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-l-4 px-3 py-2" style={tileStyle(evidence, expanded)}>
                  <button
                    type="button"
                    onClick={() => setExpandedEvidenceIds(current => {
                      const next = new Set(current);
                      if (next.has(evidence.id)) next.delete(evidence.id); else next.add(evidence.id);
                      return next;
                    })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={expanded}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="font-mono text-xs font-bold">{evidenceCode(index)}</span>
                    <span className="truncate text-sm font-semibold">{evidence.title}</span>
                    {evidence.sourceKey && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${expanded ? 'border-zinc-200 bg-zinc-100 text-zinc-700' : 'border-white/40 bg-black/20 text-white'}`}
                      >
                        BASELINE
                      </Badge>
                    )}
                  </button>
                  <span className="hidden text-[11px] font-medium md:inline">{typeName}</span>
                  <span className="hidden max-w-56 truncate text-[11px] opacity-80 lg:inline" title={evidenceLocationSummary}>{evidenceLocationSummary}</span>
                  <div className="hidden flex-wrap gap-1 sm:flex">
                    {evidence.classifications.map(value => (
                      <Badge
                        key={value}
                        variant="outline"
                        className={`text-[9px] uppercase ${expanded ? 'border-zinc-200 bg-zinc-100 text-zinc-700' : 'border-white/40 bg-black/20 text-white'}`}
                      >
                        {value}
                      </Badge>
                    ))}
                  </div>
                  <button type="button" onClick={() => deleteEvidence(evidence.id)} className="rounded p-1 opacity-60 hover:bg-white/70 hover:text-rose-700" aria-label={`Delete ${evidence.title}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {expanded && (
                  <div className="grid gap-3 border-t border-zinc-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                      Evidence title
                      <input value={evidence.title} onChange={event => updateEvidence(evidence.id, { title: event.target.value })} className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm font-normal outline-none focus:border-purple-700" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                      Evidence type
                      <select value={evidence.type} onChange={event => updateEvidence(evidence.id, { type: event.target.value as EvidenceItem['type'] })} className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-sm font-normal outline-none focus:border-purple-700">
                        {EVIDENCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.name}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                      Location / Workplace Identifier
                      <input value={evidence.locationIdentifier} onChange={event => updateEvidence(evidence.id, { locationIdentifier: event.target.value })} className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm font-normal outline-none focus:border-purple-700" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                      Reference / date
                      <input value={evidence.reference} onChange={event => updateEvidence(evidence.id, { reference: event.target.value })} className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm font-normal outline-none focus:border-purple-700" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-zinc-600 sm:col-span-2 lg:col-span-3">
                      Description
                      <span className="font-normal text-zinc-500">Assessor to describe the evidence provided fully.</span>
                      <textarea value={evidence.notes} onChange={event => updateEvidence(evidence.id, { notes: event.target.value })} rows={4} className="min-h-24 resize-y rounded-md border border-zinc-300 p-2 text-sm font-normal outline-none focus:border-purple-700" />
                    </label>
                    <div className="sm:col-span-2 lg:col-span-3 grid gap-3 md:grid-cols-2">
                      <EvidenceOptionCheckboxes
                        legend="Storage"
                        options={EVIDENCE_STORAGE_LOCATIONS}
                        selectedValues={evidence.storageLocations}
                        onChange={values => updateEvidence(evidence.id, { storageLocations: values as EvidenceItem['storageLocations'] })}
                      />
                      <EvidenceOptionCheckboxes
                        legend="Evidence form"
                        options={EVIDENCE_MODES}
                        selectedValues={evidence.evidenceModes}
                        onChange={values => updateEvidence(evidence.id, { evidenceModes: values as EvidenceItem['evidenceModes'] })}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <EvidenceOptionCheckboxes
                        legend="File format"
                        options={EVIDENCE_FILE_FORMATS}
                        selectedValues={evidence.fileFormats}
                        onChange={values => updateEvidence(evidence.id, { fileFormats: values as EvidenceItem['fileFormats'] })}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel>Evidence classification</FieldLabel>
                      <EvidenceClassificationFields
                        compact
                        radioName={`evidence-${evidence.id}-classification`}
                        classifications={evidence.classifications}
                        subtypes={evidence.subtypes}
                        onChange={patch => updateEvidence(evidence.id, {
                          ...patch,
                          colour: evidenceColourForClassification(patch.classifications[0]),
                        })}
                      />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-zinc-500">
          Add the first evidence piece above. Each one will become a labelled tile in the mapping board.
        </div>
      )}
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-purple-800">Landscape workspace</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Map evidence to Performance Criteria</h2>
          <p className="mt-1 text-sm text-zinc-600">Drag a tile onto a Performance Criterion, or select a tile then click a mapping cell. Collapse completed sections to reduce scrolling.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">{coveredRows} / {requirementRows.length} directly covered</Badge>
          {selectedEvidence && <Badge className="bg-zinc-900 text-white">Selected: {selectedEvidence.title}</Badge>}
        </div>
      </div>
      {!record.evidence.length && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add at least one evidence item in the Evidence log before mapping it to this unit.
        </div>
      )}
      <div className="grid w-full max-w-full grid-cols-[220px_minmax(0,1fr)] items-start rounded-xl border border-zinc-300 bg-zinc-200 shadow-sm">
          <aside ref={paletteRef} className="sticky top-2 max-h-[calc(100vh-8rem)] self-start overflow-y-auto rounded-l-xl border-r border-purple-800 bg-purple-900 p-3 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-purple-200">Evidence palette</p>
            <p className="mt-1.5 text-xs leading-5 text-purple-100">Drag evidence to the matrix. Click once to select it for click-to-map mode.</p>
            <div className="mt-3 space-y-2">
              {record.evidence.map((item, index) => (
                <EvidenceTile
                  key={item.id}
                  evidence={item}
                  index={index}
                  selected={item.id === selectedEvidenceId}
                  onSelect={() => setSelectedEvidenceId(current => current === item.id ? null : item.id)}
                  onDragStart={() => setDragEvidenceId(item.id)}
                  onDragEnd={() => { setDragEvidenceId(null); setDragTargetRowKey(null); }}
                />
              ))}
              {!record.evidence.length && <p className="rounded border border-dashed border-purple-600 p-3 text-xs leading-5 text-purple-200">No evidence logged yet.</p>}
            </div>
          </aside>
          <div className="overflow-x-auto bg-white">
             <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100">
                    <th className="w-[43%] border-b border-zinc-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Performance Criteria</th>
                   <th className="border-b border-l border-zinc-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Evidence mapped</th>
                </tr>
              </thead>
              <tbody>
                {visibleMappingRows.map(row => {
                  if (row.kind === 'span') {
                     const broadSection = row.style === 'element' || row.style === 'section';
                     const collapsed = collapsedMappingSections.has(row.key);
                     return (
                       <tr key={row.key}>
                         <td colSpan={2} className={`border-b border-zinc-300 px-3 py-2 ${row.style === 'section' ? 'bg-purple-900 text-xs font-bold uppercase tracking-[0.12em] text-white' : row.style === 'element' ? 'bg-zinc-100 font-bold text-zinc-900' : 'bg-white text-xs italic text-zinc-500'}`}>
                           {broadSection ? (
                             <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setCollapsedMappingSections(current => {
                               const next = new Set(current);
                               if (next.has(row.key)) next.delete(row.key); else next.add(row.key);
                               return next;
                             })}>
                               {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                               {row.label}
                             </button>
                           ) : row.label}
                         </td>
                       </tr>
                     );
                  }
                  const mappedIds = record.mappings[row.key] ?? [];
                  const mapped = mappedIds.map(id => ({ id, evidence: evidenceById.get(id) })).filter((item): item is { id: string; evidence: EvidenceItem } => Boolean(item.evidence));
                  return (
                    <tr key={row.key} className="align-top hover:bg-zinc-50">
                       <td className="border-b border-zinc-200 px-3 py-2.5 leading-5 text-zinc-800">{row.label}</td>
                      <td
                        onDragEnter={() => setDragTargetRowKey(row.key)}
                        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTargetRowKey(null); }}
                        onDragOver={event => event.preventDefault()}
                        onDrop={() => onDrop(row.key)}
                         className={`min-h-14 border-b border-l border-zinc-200 px-2.5 py-1.5 transition-all duration-200 ${dragTargetRowKey === row.key ? 'bg-purple-100 ring-2 ring-inset ring-purple-500' : selectedEvidenceId ? 'bg-purple-50/40' : 'bg-white'}`}
                      >
                        {mapped.length ? (
                           <div className="flex min-h-12 flex-wrap items-stretch gap-1.5">
                            {mapped.map(({ id, evidence }) => (
                               <div key={id} className="min-w-[145px] max-w-[225px] flex-1 animate-in slide-in-from-left-2 fade-in duration-200">
                                <EvidenceTile evidence={evidence} index={record.evidence.findIndex(item => item.id === id)} compact onRemove={() => unmapEvidence(row.key, id)} />
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onDrop(row.key)}
                          disabled={!selectedEvidenceId}
                          aria-label={selectedEvidence ? `Map ${selectedEvidence.title} to ${row.label}` : `Select evidence before mapping to ${row.label}`}
                           className={`mt-1 rounded px-2 py-1 text-xs font-medium outline-none transition focus:ring-2 focus:ring-purple-700 focus:ring-offset-2 ${selectedEvidenceId ? 'bg-purple-800 text-white hover:bg-purple-700' : 'text-zinc-400 hover:text-zinc-500'}`}
                        >
                          {selectedEvidenceId ? `Map ${selectedEvidence?.title}` : mapped.length ? 'Add more evidence' : 'Select evidence to map'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </div>
      {selectedEvidenceId && <button type="button" onClick={() => setSelectedEvidenceId(null)} className="text-xs font-medium text-purple-800 underline underline-offset-4">Clear selected evidence</button>}
    </div>
  );

  const renderGaps = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-purple-800">Evidence gaps</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Interview and oral questions</h2>
          <p className="mt-1 text-sm text-zinc-600">These are requirements without directly mapped evidence. Record how the gap was explored and the assessor’s outcome.</p>
        </div>
        <Badge className={uncoveredRows.length ? 'bg-amber-100 text-amber-900 hover:bg-amber-100' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100'}>
          {uncoveredRows.length ? `${uncoveredRows.length} gaps identified` : 'All requirements mapped'}
        </Badge>
      </div>
      {uncoveredRows.length ? (
        <div className="space-y-2">
          {gapGroups.map(group => (
            <details key={group.key} className="group overflow-hidden rounded-xl border border-green-700/40 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 bg-green-700 px-4 py-3 text-sm font-bold text-white hover:bg-green-800 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1">{group.label}</span>
                <Badge variant="outline" className="border-white/60 bg-white text-green-800">{group.rows.length} gap{group.rows.length === 1 ? '' : 's'}</Badge>
              </summary>
              <div className="space-y-2 border-t border-green-100 bg-white p-3">
                {group.rows.map(row => {
                  const interview = record.interviews[row.key] ?? { question: '', studentResponse: '', assessorNotes: '', outcome: 'pending' as const };
                  return (
                    <article key={row.key} className="rounded-lg border border-green-100 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="max-w-3xl text-sm font-semibold leading-6 text-zinc-900">{row.label}</p>
                        <select value={interview.outcome} onChange={event => updateInterview(row.key, { outcome: event.target.value as InterviewOutcome })} className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium outline-none focus:border-purple-700">
                          <option value="pending">Pending outcome</option>
                          <option value="resolved">Resolved</option>
                          <option value="not-resolved">Not resolved</option>
                        </select>
                      </div>
                      <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
                        <textarea value={interview.question} onChange={event => updateInterview(row.key, { question: event.target.value })} rows={3} placeholder="Interview / oral question prompt" className="resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100" />
                        <textarea value={interview.studentResponse} onChange={event => updateInterview(row.key, { studentResponse: event.target.value })} rows={3} placeholder="Student response / new evidence" className="resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100" />
                        <textarea value={interview.assessorNotes} onChange={event => updateInterview(row.key, { assessorNotes: event.target.value })} rows={3} placeholder="Assessor notes and rationale" className="resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100" />
                      </div>
                    </article>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <Check className="mx-auto h-8 w-8 text-emerald-700" />
          <h3 className="mt-3 font-semibold text-emerald-950">No direct-evidence gaps</h3>
          <p className="mt-1 text-sm text-emerald-800">Every requirement currently has at least one evidence tile mapped to it.</p>
        </div>
      )}
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-purple-800">Pre-finalisation check</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Review the RPL record</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Student', hasStudent ? studentName : 'Details incomplete', hasStudent ? 'text-purple-900 bg-purple-50 border-purple-200' : 'text-rose-900 bg-rose-50 border-rose-200'],
          ['Evidence logged', `${record.evidence.length} items`, 'text-indigo-900 bg-indigo-50 border-indigo-200'],
          ['Directly covered', `${coveredRows} of ${requirementRows.length}`, 'text-emerald-900 bg-emerald-50 border-emerald-200'],
          ['Gaps resolved', `${resolvedGaps} of ${uncoveredRows.length}`, 'text-amber-900 bg-amber-50 border-amber-200'],
        ].map(([label, value, classes]) => (
            <article key={label} className={`rounded-xl border p-3 ${classes}`}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
             <p className="mt-1.5 text-lg font-bold">{value}</p>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
         <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="font-semibold text-zinc-900">Performance Criteria coverage</h3>
          <p className="mt-1 text-xs text-zinc-500">A direct evidence mapping is shown below; interview records can be completed in the Gaps screen.</p>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
             <thead className="sticky top-0 bg-zinc-100">
               <tr><th className="px-4 py-2.5 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Performance Criteria</th><th className="px-4 py-2.5 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Evidence</th><th className="px-4 py-2.5 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Status</th></tr>
            </thead>
            <tbody>
              {requirementRows.map(row => {
                const mapped = (record.mappings[row.key] ?? []).map(id => evidenceById.get(id)).filter((item): item is EvidenceItem => Boolean(item));
                const interview = record.interviews[row.key];
                return <tr key={row.key} className="border-t border-zinc-100 align-top">
                   <td className="px-4 py-2.5 text-zinc-800">{row.label}</td>
                   <td className="px-4 py-2.5">{mapped.length ? <div className="flex flex-wrap gap-1.5">{mapped.map(item => <span key={item.id} style={tileStyle(item)} className="rounded border-l-4 px-2 py-1 text-xs font-semibold">{item.title}</span>)}</div> : <span className="text-xs text-zinc-400">No direct evidence</span>}</td>
                   <td className="px-4 py-2.5 text-xs font-medium">{mapped.length ? <span className="text-emerald-700">Mapped</span> : interview ? <span className={interview.outcome === 'resolved' ? 'text-purple-700' : 'text-amber-700'}>{statusForOutcome(interview.outcome)}</span> : <span className="text-amber-700">Gap</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderFinal = () => (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-purple-800">Final output</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">RPL outcome and sign-off</h2>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-zinc-600">
           Record the assessment outcome, complete the digital declarations, then download the final landscape Word report.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">RPL outcome</span>
            <select
              value={record.finalisation.outcome}
              onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, outcome: event.target.value as typeof current.finalisation.outcome } }))}
              className="h-10 rounded-md border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            >
              <option value="granted">RPL Granted</option>
              <option value="in-progress">In Progress</option>
              <option value="not-granted">RPL Not Granted</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Outcome notes / conditions</span>
            <input
              value={record.finalisation.outcomeNotes}
              onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, outcomeNotes: event.target.value } }))}
              placeholder="Record the decision rationale, extra evidence required, or next steps"
              className="h-10 rounded-md border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-100"
            />
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          <div className="grid gap-2 sm:grid-cols-2">
             <span><strong>Student:</strong> {studentName || 'Not recorded'}</span>
            <span><strong>Student number:</strong> {record.student.studentNumber || 'Not recorded'}</span>
            <span><strong>Trainer / assessor:</strong> {record.student.trainerName || 'Not recorded'}</span>
            <span><strong>RPL Start Date:</strong> {record.student.assessmentDate || 'Not recorded'}</span>
            <span><strong>Evidence Presentation Session Booked:</strong> {record.student.evidencePresentationSessionDate || 'Not recorded'}</span>
            <span><strong>Gaps Assessment Session Booked:</strong> {record.student.gapsAssessmentSessionDate || 'Not recorded'}</span>
            <span><strong>Disability Access Plan (DAP):</strong> {record.student.disabilityAccessPlan ? 'Yes' : 'No'}</span>
            <span><strong>Reasonable adjustments:</strong> {record.student.reasonableAdjustments || 'Not recorded'}</span>
            <span><strong>Evidence items:</strong> {record.evidence.length}</span>
            <span><strong>Direct mappings:</strong> {coveredRows} of {requirementRows.length}</span>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-xs text-zinc-700">
            <p className="font-semibold text-purple-900">Student digital declaration</p>
            <p className="mt-1 text-[11px]">Typing the name below confirms the evidence and responses belong to the student.</p>
            <input value={record.finalisation.studentSignature} onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, studentSignature: event.target.value } }))} placeholder="Student full name" className="mt-3 h-9 w-full rounded-md border border-purple-200 bg-white px-2.5 text-sm outline-none focus:border-purple-700" />
            <DatePickerInput value={record.finalisation.studentSignatureDate} onChange={studentSignatureDate => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, studentSignatureDate } }))} ariaLabel="Student signature date" className="mt-2 h-9" />
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-xs text-zinc-700">
            <p className="font-semibold text-purple-900">Assessor digital declaration</p>
            <p className="mt-1 text-[11px]">Typing the name below confirms the assessment has been reviewed and finalised.</p>
            <input value={record.finalisation.assessorSignature} onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, assessorSignature: event.target.value } }))} placeholder="Assessor full name" className="mt-3 h-9 w-full rounded-md border border-purple-200 bg-white px-2.5 text-sm outline-none focus:border-purple-700" />
            <DatePickerInput value={record.finalisation.assessorSignatureDate} onChange={assessorSignatureDate => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, assessorSignatureDate } }))} ariaLabel="Assessor signature date" className="mt-2 h-9" />
          </div>
        </div>
        <Button
          onClick={async () => { await exportRplToWord(unit, record); setExported(true); }}
          disabled={!hasStudent}
           className="mt-4 bg-purple-800 hover:bg-purple-700"
        >
          {exported ? <Check className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
          {exported ? 'Downloaded RPL Mapping Report' : 'Download RPL Mapping Report'}
        </Button>
        {!hasStudent && <p className="mt-2 text-xs text-rose-700">Add the student name and student number before finalising.</p>}
      </section>
      <aside className="rounded-xl border border-purple-900 bg-purple-950 p-4 text-purple-50 shadow-sm">
        <FileCheck2 className="h-7 w-7 text-purple-300" />
        <h3 className="mt-3 text-lg font-semibold">Ready for signatures</h3>
        <p className="mt-1.5 text-sm leading-5 text-purple-100">The export includes separate declaration boxes for the student and assessor, with room for their signatures and dates.</p>
      </aside>
    </div>
  );

  const stageContent: Record<RplStage, () => ReactElement> = {
    student: renderStudent,
    evidence: renderEvidence,
    mapping: renderMapping,
    gaps: renderGaps,
    review: renderReview,
    final: renderFinal,
  };

  return (
    <div className="space-y-4" data-testid="rpl-workflow">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-purple-800">{unit.code}</span>
            <Badge variant="outline" className="border-zinc-300 text-zinc-600">RPL workflow</Badge>
          </div>
           <h1 className="mt-1 text-base font-bold text-zinc-900">{unit.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-right text-xs leading-5 text-zinc-500">
          {import.meta.env.DEV && (
            <div className="flex items-center gap-1 rounded-md border border-dashed border-amber-400 bg-amber-50 p-1 text-amber-900" title="Development-only stage navigation">
              <span className="px-1 text-[10px] font-bold uppercase">Dev</span>
              <button type="button" onClick={() => devSkip(-1)} disabled={stageIndex === 0} className="rounded p-1 hover:bg-amber-100 disabled:opacity-30" aria-label="Developer: previous stage"><ArrowLeft className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => devSkip(1)} disabled={stageIndex === STAGES.length - 1} className="rounded p-1 hover:bg-amber-100 disabled:opacity-30" aria-label="Developer: next stage"><ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div>
            <span className="block font-semibold text-zinc-700">{studentName || 'No student selected'}</span>
            <span>{record.student.studentNumber || 'Student number required'}</span>
          </div>
        </div>
      </header>

      <nav aria-label="RPL workflow steps" className="pb-1">
        <ol className="grid grid-cols-3 gap-1 sm:flex sm:items-center">
          {STAGES.map((item, index) => {
            const Icon = item.icon;
            const active = item.id === stage;
            const complete = index < stageIndex;
             return <li key={item.id} className="flex min-w-0 flex-col items-center sm:flex-1 sm:flex-row sm:last:flex-none">
              <button
                type="button"
                onClick={() => setStage(item.id)}
                 className={`group flex w-full min-w-0 flex-col items-center gap-1 text-center outline-none sm:w-auto sm:min-w-[88px] ${active ? 'text-purple-900' : complete ? 'text-purple-700' : 'text-zinc-500'}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition ${active ? 'border-purple-800 bg-purple-800 text-white shadow-sm' : complete ? 'border-purple-200 bg-purple-100 text-purple-800' : 'border-zinc-300 bg-white text-zinc-500 group-hover:border-purple-400'}`}>
                  {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="text-[11px] font-semibold leading-4">{item.short}</span>
              </button>
               {index < STAGES.length - 1 && <span className={`mx-1 hidden h-px flex-1 sm:block ${index < stageIndex ? 'bg-purple-300' : 'bg-zinc-300'}`} />}
            </li>;
          })}
        </ol>
      </nav>

      <section>{stageContent[stage]()}</section>

      <footer className="flex items-center justify-between border-t border-zinc-300 pt-4">
        <Button variant="outline" onClick={goPrevious} disabled={stageIndex === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={saveProgress} className="border-purple-300 text-purple-800 hover:bg-purple-50">
            {savedFeedback ? <Check className="mr-2 h-4 w-4" /> : null}
            {savedFeedback ? 'Saved' : 'Save progress'}
          </Button>
          <span className="hidden text-xs font-medium text-zinc-500 sm:inline">Step {stageIndex + 1} of {STAGES.length}</span>
        </div>
        <Button onClick={goNext} disabled={stage === 'student' && !hasStudent} className="bg-zinc-900 hover:bg-zinc-700">
          {stage === 'final' ? <>Finish <Check className="ml-2 h-4 w-4" /></> : <>Next <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </footer>
    </div>
  );
}
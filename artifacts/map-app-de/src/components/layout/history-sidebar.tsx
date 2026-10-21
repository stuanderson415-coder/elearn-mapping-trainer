import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { ClipboardCheck, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  listRplProgress,
  removeRplProgress,
  RPL_PROGRESS_EVENT,
  studentDisplayName,
  type RplProgressItem,
} from '@/lib/rpl-state';

function displayAssessmentDate(entry: RplProgressItem) {
  if (entry.assessmentDate) {
    const [year, month, day] = entry.assessmentDate.split('-').map(Number);
    return format(new Date(year, month - 1, day, 12), 'MMM d, yyyy');
  }
  return format(new Date(entry.updatedAt), 'MMM d, yyyy');
}

export function HistorySidebar({ onSelect }: { onSelect: (code: string, studentNumber: string) => void }) {
  const [progress, setProgress] = useState<RplProgressItem[]>(() => listRplProgress());

  useEffect(() => {
    const refresh = () => setProgress(listRplProgress());
    window.addEventListener(RPL_PROGRESS_EVENT, refresh);
    return () => window.removeEventListener(RPL_PROGRESS_EVENT, refresh);
  }, []);

  const handleDelete = (entry: RplProgressItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Remove the RPL record for ${studentDisplayName(entry) || entry.studentNumber}?`)) return;
    removeRplProgress(entry.unitCode, entry.studentNumber);
  };

  return (
    <div className="hidden h-full w-52 shrink-0 flex-col overflow-hidden bg-emerald-800 md:flex">
      <div className="flex items-center justify-between border-b border-emerald-950 bg-emerald-900 p-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-50">
          <History className="h-3.5 w-3.5 text-emerald-100" />
          Assessments in progress
        </div>
      </div>
      <ScrollArea className="flex-1">
        {progress.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 p-4 text-center text-sm text-emerald-50">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            <p>Your RPL applications in training will show here.</p>
            <p className="text-xs text-emerald-200">Don&apos;t forget to save your work as you progress.</p>
          </div>
        ) : (
          <div className="divide-y divide-emerald-700">
            {progress.map(entry => (
              <div
                key={`${entry.unitCode}-${entry.studentNumber}`}
                className="group flex cursor-pointer items-start gap-2 border-l-2 border-transparent p-2.5 transition-colors hover:border-emerald-300 hover:bg-emerald-700"
                onClick={() => onSelect(entry.unitCode, entry.studentNumber)}
              >
                <div className="mt-0.5">
                  <ClipboardCheck className="w-4 h-4 text-emerald-100" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">
                    {studentDisplayName(entry) || 'Unnamed student'}
                  </div>
                  <div className="text-xs text-emerald-100 truncate mt-0.5">
                    {entry.unitCode} · {entry.studentNumber}
                  </div>
                  <div className="text-[10px] text-emerald-200 mt-1.5 uppercase tracking-wider font-medium">
                    {displayAssessmentDate(entry)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-1 h-6 w-6 shrink-0 text-emerald-100 hover:bg-emerald-700 hover:text-red-200"
                   onClick={(e) => handleDelete(entry, e)}
                   title="Remove RPL record"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

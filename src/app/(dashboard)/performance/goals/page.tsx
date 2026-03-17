'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Target,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  useGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
} from '@/hooks/use-performance';
import { usePermission } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' }> = {
  NOT_STARTED: { label: 'Not Started', variant: 'outline' },
  IN_PROGRESS: { label: 'In Progress', variant: 'secondary' },
  AT_RISK: { label: 'At Risk', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export default function GoalsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

  const { data: goalsData, isLoading } = useGoals(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const deleteGoal = useDeleteGoal();

  const goals = goalsData?.data ?? [];

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      await deleteGoal.mutateAsync(id);
      toast.success('Goal deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete goal');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/performance">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
              Goals
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track and manage your goals and key results
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Create Goal Form */}
      {showCreate && (
        <CreateGoalForm
          onCreated={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="NOT_STARTED">Not Started</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="AT_RISK">At Risk</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Goals List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Target className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No goals found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a goal to start tracking your progress.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal: any) => (
            <GoalCard key={goal.id} goal={goal} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onDelete }: { goal: any; onDelete: (id: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const updateGoal = useUpdateGoal(goal.id);
  const sb = STATUS_BADGE[goal.status] ?? { label: goal.status, variant: 'outline' as const };
  const keyResults = Array.isArray(goal.keyResults) ? goal.keyResults : [];

  async function handleUpdateKeyResults(updatedKRs: any[]) {
    try {
      await updateGoal.mutateAsync({ keyResults: updatedKRs });
      toast.success('Progress updated');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update');
    }
  }

  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{goal.title}</h3>
            <Badge variant={sb.variant}>{sb.label}</Badge>
          </div>
          {goal.description && (
            <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>
          )}
          {goal.employee && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {goal.employee.firstName} {goal.employee.lastName}
              {goal.employee.department?.name && ` · ${goal.employee.department.name}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {goal.dueDate && (
            <span className="text-xs text-muted-foreground">
              Due {format(new Date(goal.dueDate), 'MMM d, yyyy')}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => onDelete(goal.id)}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{goal.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              goal.progress >= 100
                ? 'bg-green-500'
                : goal.progress >= 50
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(100, goal.progress)}%` }}
          />
        </div>
      </div>

      {/* Key Results */}
      {keyResults.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Key Results</span>
            {!isEditing && goal.status !== 'COMPLETED' && goal.status !== 'CANCELLED' && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                Update Progress
              </Button>
            )}
          </div>
          {isEditing ? (
            <KeyResultEditor
              keyResults={keyResults}
              onSave={handleUpdateKeyResults}
              onCancel={() => setIsEditing(false)}
              isPending={updateGoal.isPending}
            />
          ) : (
            keyResults.map((kr: any, idx: number) => {
              const pct = kr.targetValue > 0
                ? Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100))
                : 0;
              return (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground">
                    {kr.title}: {kr.currentValue}/{kr.targetValue} {kr.unit}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function KeyResultEditor({
  keyResults,
  onSave,
  onCancel,
  isPending,
}: {
  keyResults: any[];
  onSave: (krs: any[]) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [values, setValues] = useState(
    keyResults.map((kr) => ({ ...kr, currentValue: kr.currentValue ?? 0 }))
  );

  function updateValue(idx: number, val: number) {
    setValues((prev) => prev.map((kr, i) => (i === idx ? { ...kr, currentValue: val } : kr)));
  }

  return (
    <div className="space-y-2">
      {values.map((kr, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="min-w-[120px] text-sm">{kr.title}</span>
          <Input
            type="number"
            value={kr.currentValue}
            onChange={(e) => updateValue(idx, Number(e.target.value))}
            className="w-24"
            min={0}
            max={kr.targetValue}
          />
          <span className="text-sm text-muted-foreground">
            / {kr.targetValue} {kr.unit}
          </span>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onSave(values)} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CreateGoalForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const createGoal = useCreateGoal();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [keyResults, setKeyResults] = useState<{ title: string; targetValue: number; unit: string }[]>([]);

  function addKeyResult() {
    setKeyResults((prev) => [...prev, { title: '', targetValue: 100, unit: '%' }]);
  }

  function updateKR(idx: number, field: string, value: any) {
    setKeyResults((prev) =>
      prev.map((kr, i) => (i === idx ? { ...kr, [field]: value } : kr))
    );
  }

  function removeKR(idx: number) {
    setKeyResults((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createGoal.mutateAsync({
        title,
        description: description || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        keyResults: keyResults.filter((kr) => kr.title.trim()),
      });
      toast.success('Goal created');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create goal');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
      <h3 className="font-semibold text-foreground">New Goal</h3>
      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={2}
          placeholder="What does success look like?"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Due Date</label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      {/* Key Results */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium">Key Results</label>
          <Button type="button" variant="ghost" size="sm" onClick={addKeyResult}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {keyResults.map((kr, idx) => (
          <div key={idx} className="mb-2 flex items-center gap-2">
            <Input
              value={kr.title}
              onChange={(e) => updateKR(idx, 'title', e.target.value)}
              placeholder="Key result title"
              className="flex-1"
            />
            <Input
              type="number"
              value={kr.targetValue}
              onChange={(e) => updateKR(idx, 'targetValue', Number(e.target.value))}
              className="w-20"
              min={1}
            />
            <Input
              value={kr.unit}
              onChange={(e) => updateKR(idx, 'unit', e.target.value)}
              className="w-16"
              placeholder="%"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeKR(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={createGoal.isPending}>
          {createGoal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Goal
        </Button>
      </div>
    </form>
  );
}

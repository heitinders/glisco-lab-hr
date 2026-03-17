'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Users,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutList,
  Network,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ──────────────────────────────────────────────────────────

interface OrgEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  profilePhotoUrl: string | null;
  reportingToId: string | null;
  department: { id: string; name: string; code: string } | null;
  designation: { id: string; title: string; level: number } | null;
  status: string;
}

interface TreeNode extends OrgEmployee {
  children: TreeNode[];
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

// ─── Department Colors ──────────────────────────────────────────────

const DEPT_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  ENG:    { border: 'border-blue-300',    bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  OPS:    { border: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  MKT:    { border: 'border-purple-300',  bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  FIN:    { border: 'border-amber-300',   bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  HR:     { border: 'border-pink-300',    bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  SALES:  { border: 'border-cyan-300',    bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-400' },
  LEGAL:  { border: 'border-red-300',     bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400' },
  DESIGN: { border: 'border-orange-300',  bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400' },
};

const DEFAULT_COLOR = { border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };

function getDeptColor(code: string | undefined) {
  return DEPT_COLORS[code || ''] || DEFAULT_COLOR;
}

// ─── Tree builder ───────────────────────────────────────────────────

function buildTree(employees: OrgEmployee[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const emp of employees) {
    map.set(emp.id, { ...emp, children: [] });
  }

  for (const emp of employees) {
    const node = map.get(emp.id)!;
    if (emp.reportingToId && map.has(emp.reportingToId)) {
      map.get(emp.reportingToId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── Connector Dot ─────────────────────────────────────────────────

function ConnectorDot() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="h-[7px] w-[7px] rounded-full border-[1.5px] border-blue bg-white" />
    </div>
  );
}

// ─── Person Card (horizontal: avatar + name/title) ─────────────────

function PersonCard({ node, isRoot }: { node: TreeNode; isRoot?: boolean }) {
  const color = getDeptColor(node.department?.code);

  return (
    <Link
      href={`/employees/${node.id}`}
      className={`group flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-md ${
        isRoot ? 'px-5 py-3.5' : ''
      }`}
    >
      {/* Avatar */}
      {node.profilePhotoUrl ? (
        <Image
          src={node.profilePhotoUrl}
          alt={`${node.firstName} ${node.lastName}`}
          width={isRoot ? 44 : 36}
          height={isRoot ? 44 : 36}
          className={`${isRoot ? 'h-11 w-11' : 'h-9 w-9'} shrink-0 rounded-full border-2 border-white object-cover shadow-sm`}
        />
      ) : (
        <div
          className={`flex ${isRoot ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs'} shrink-0 items-center justify-center rounded-full ${color.bg} ${color.text} font-semibold`}
        >
          {node.firstName[0]}{node.lastName[0]}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0">
        <div className={`font-semibold text-foreground ${isRoot ? 'text-sm' : 'text-[13px]'}`}>
          {node.firstName} {node.lastName}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {node.designation?.title || 'No designation'}
        </div>
      </div>
    </Link>
  );
}

// ─── Tree View: OrgNode ─────────────────────────────────────────────

function OrgNode({ node, isRoot }: { node: TreeNode; isRoot?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  // Group children by department for the dashed group boxes
  const childGroups = useMemo(() => {
    if (!hasChildren) return [];
    const groups = new Map<string, TreeNode[]>();
    for (const child of node.children) {
      const key = child.department?.code || '_none';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(child);
    }
    return Array.from(groups.entries());
  }, [node.children, hasChildren]);

  // If all children share the same department, show a group box
  const showDeptGroups = childGroups.length >= 1 && childGroups.every(([key]) => key !== '_none');

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <PersonCard node={node} isRoot={isRoot} />

      {/* Expand toggle */}
      {hasChildren && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="relative z-10 -mt-1 flex items-center justify-center"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border bg-white shadow-sm transition-colors hover:bg-muted">
            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
          </div>
        </button>
      )}

      {/* Connectors + Children */}
      {hasChildren && expanded && (
        <div className="flex flex-col items-center">
          {/* Vertical line from toggle to junction */}
          <div className="h-5 w-px bg-blue/30" />
          <ConnectorDot />

          {node.children.length === 1 ? (
            <>
              <div className="h-5 w-px bg-blue/30" />
              <OrgNode node={node.children[0]} />
            </>
          ) : showDeptGroups ? (
            /* Department-grouped children */
            <div className="flex items-start gap-8 pt-0">
              {childGroups.map(([deptCode, members]) => {
                const color = getDeptColor(deptCode);
                const deptName = members[0].department?.name || deptCode;

                return (
                  <div key={deptCode} className="flex flex-col items-center">
                    {/* Vertical line down to group */}
                    <div className="h-5 w-px bg-blue/30" />

                    {/* Department group box */}
                    <div className={`relative rounded-xl border-2 border-dashed ${color.border} p-4 pt-6`}>
                      {/* Department label */}
                      <div className={`absolute -top-3 left-4 rounded-md px-2.5 py-0.5 text-xs font-bold ${color.bg} ${color.text}`}>
                        {deptName}
                      </div>

                      <div className="flex items-start gap-4">
                        {members.map((child) => (
                          <div key={child.id} className="flex flex-col items-center">
                            <OrgNode node={child} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Horizontal bar connecting all groups */}
              {childGroups.length > 1 && (
                <div className="pointer-events-none absolute" style={{ display: 'none' }} />
              )}
            </div>
          ) : (
            /* Ungrouped children in a row */
            <div className="flex items-start gap-6">
              {node.children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="h-5 w-px bg-blue/30" />
                  <OrgNode node={child} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────────

function OrgListNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const color = getDeptColor(node.department?.code);

  return (
    <div>
      <div className="group flex items-center gap-3 rounded-lg border bg-white p-2.5 transition-all hover:shadow-sm">
        {/* Expand/Collapse */}
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
            hasChildren
              ? 'cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground'
              : 'invisible'
          }`}
        >
          {hasChildren && (
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
          )}
        </button>

        {/* Avatar */}
        {node.profilePhotoUrl ? (
          <Image
            src={node.profilePhotoUrl}
            alt={`${node.firstName} ${node.lastName}`}
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full border object-cover"
          />
        ) : (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color.bg} ${color.text} text-xs font-semibold`}>
            {node.firstName[0]}{node.lastName[0]}
          </div>
        )}

        {/* Info */}
        <Link href={`/employees/${node.id}`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground group-hover:text-blue">
            {node.firstName} {node.lastName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {node.designation?.title || 'No designation'}
          </div>
        </Link>

        {/* Meta */}
        <div className="hidden items-center gap-2 sm:flex">
          {node.department && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${color.bg} ${color.text}`}>
              {node.department.name}
            </span>
          )}
          {hasChildren && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Users className="h-3 w-3" />
              {node.children.length}
            </span>
          )}
          <div
            className={`h-2 w-2 rounded-full ${
              node.status === 'ACTIVE' ? 'bg-emerald-400' :
              node.status === 'ON_LEAVE' ? 'bg-amber-400' :
              node.status === 'NOTICE_PERIOD' ? 'bg-red-400' : 'bg-gray-300'
            }`}
            title={node.status.replace('_', ' ')}
          />
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative ml-5 mt-1 space-y-1 pl-5">
          <div className="absolute bottom-3 left-[7px] top-0 w-px bg-blue/20" />
          {node.children.map((child) => (
            <div key={child.id} className="relative">
              <div className="absolute left-[-13px] top-[22px] h-px w-[13px] bg-blue/20" />
              <div className="absolute left-[-16px] top-[19px] h-[7px] w-[7px] rounded-full border-[1.5px] border-blue bg-white" />
              <OrgListNode node={child} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function OrgChartPage() {
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['org-chart', departmentFilter],
    queryFn: () => {
      const params = departmentFilter && departmentFilter !== 'all'
        ? `?department=${departmentFilter}`
        : '';
      return apiClient.get<{ data: OrgEmployee[] }>(`/api/org-chart${params}`);
    },
  });

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.get<{ data: DepartmentOption[] }>('/api/departments'),
  });

  const employees = useMemo(() => {
    if (!orgData) return [];
    return Array.isArray(orgData) ? orgData : (orgData as any).data ?? [];
  }, [orgData]);

  const departments = useMemo(() => {
    if (!deptData) return [];
    return Array.isArray(deptData) ? deptData : (deptData as any).data ?? [];
  }, [deptData]);

  const tree = useMemo(() => buildTree(employees), [employees]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 10, 200)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 10, 40)), []);
  const handleZoomReset = useCallback(() => setZoom(100), []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleZoomReset]);

  return (
    <div className="flex gap-5">
      {/* ─── Sidebar: Department Filter ─── */}
      {viewMode === 'tree' && (
        <div className="hidden w-[160px] shrink-0 lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Departments
            </p>
            <button
              onClick={() => setDepartmentFilter('all')}
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                departmentFilter === 'all'
                  ? 'bg-blue/10 font-medium text-blue'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              All
            </button>
            {departments.map((dept: DepartmentOption) => {
              const color = getDeptColor(dept.code);
              return (
                <button
                  key={dept.id}
                  onClick={() => setDepartmentFilter(dept.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                    departmentFilter === dept.id
                      ? 'bg-blue/10 font-medium text-blue'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full ${color.dot}`} />
                  {dept.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl text-foreground">Org Chart</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {employees.length} employee{employees.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border p-0.5">
              <Button
                variant={viewMode === 'tree' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('tree')}
                title="Tree view"
              >
                <Network className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomOut}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="min-w-[2.5rem] text-center text-xs text-muted-foreground">
                {zoom}%
              </span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomIn}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomReset}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        {isLoading ? (
          <div className="rounded-xl border bg-white/50 p-12">
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex gap-12">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : tree.length === 0 ? (
          <div className="rounded-xl border bg-white p-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-foreground">No employees found</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              {departmentFilter !== 'all'
                ? 'No employees in this department. Try selecting a different one.'
                : 'Add employees to see the organizational chart.'}
            </p>
          </div>
        ) : viewMode === 'tree' ? (
          <div
            ref={containerRef}
            className="overflow-auto rounded-xl border bg-white/50 backdrop-blur-sm"
            style={{ minHeight: '500px' }}
          >
            <div
              className="flex justify-center px-8 py-10"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
              <div className="flex flex-col items-center">
                {tree.map((node) => (
                  <OrgNode key={node.id} node={node} isRoot />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border bg-white p-4"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          >
            <div className="space-y-1.5">
              {tree.map((node) => (
                <OrgListNode key={node.id} node={node} depth={0} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

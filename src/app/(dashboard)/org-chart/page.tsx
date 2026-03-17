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
  Mail,
  Building2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

// ─── Department Color Map ───────────────────────────────────────────

const DEPT_THEME: Record<string, { bg: string; text: string; ring: string; gradient: string }> = {
  ENG: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', gradient: 'from-blue-500 to-blue-600' },
  OPS: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', gradient: 'from-emerald-500 to-emerald-600' },
  MKT: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200', gradient: 'from-purple-500 to-purple-600' },
  FIN: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', gradient: 'from-amber-500 to-amber-600' },
  HR: { bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200', gradient: 'from-pink-500 to-pink-600' },
  SALES: { bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200', gradient: 'from-cyan-500 to-cyan-600' },
  LEGAL: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', gradient: 'from-red-500 to-red-600' },
  DESIGN: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', gradient: 'from-orange-500 to-orange-600' },
};

const DEFAULT_THEME = { bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-200', gradient: 'from-gray-500 to-gray-600' };

function getDeptTheme(code: string | undefined) {
  return DEPT_THEME[code || ''] || DEFAULT_THEME;
}

function countDescendants(node: TreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
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

// ─── Tree View: OrgCard (top-down visual tree) ─────────────────────

function OrgCard({ node, isRoot }: { node: TreeNode; isRoot?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const theme = getDeptTheme(node.department?.code);
  const totalReports = countDescendants(node);

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className={`group relative w-[220px] rounded-xl border bg-card shadow-sm transition-all duration-200 hover:shadow-lg ${
          isRoot ? 'ring-2 ring-blue/20' : ''
        }`}
      >
        {/* Top accent bar */}
        <div className={`h-1 rounded-t-xl bg-gradient-to-r ${theme.gradient}`} />

        <div className="px-4 pb-4 pt-3">
          {/* Avatar */}
          <div className="flex justify-center">
            <Link href={`/employees/${node.id}`} className="group/avatar">
              {node.profilePhotoUrl ? (
                <Image
                  src={node.profilePhotoUrl}
                  alt={`${node.firstName} ${node.lastName}`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-sm ring-2 ring-offset-1 transition-transform group-hover/avatar:scale-105"
                  style={{ ['--tw-ring-color' as string]: undefined }}
                />
              ) : (
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${theme.gradient} text-base font-bold text-white shadow-sm ring-2 ring-white ring-offset-1 transition-transform group-hover/avatar:scale-105`}
                >
                  {node.firstName[0]}{node.lastName[0]}
                </div>
              )}
            </Link>
          </div>

          {/* Name & Title */}
          <div className="mt-2.5 text-center">
            <Link href={`/employees/${node.id}`}>
              <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-blue">
                {node.firstName} {node.lastName}
              </h3>
            </Link>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              {node.designation?.title || 'No designation'}
            </p>
          </div>

          {/* Department Badge */}
          {node.department && (
            <div className="mt-2 flex justify-center">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${theme.bg} ${theme.text}`}>
                <Building2 className="h-2.5 w-2.5" />
                {node.department.name}
              </span>
            </div>
          )}

          {/* Team count */}
          {hasChildren && (
            <div className="mt-2.5 flex justify-center">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Users className="h-3 w-3" />
                {totalReports} report{totalReports !== 1 ? 's' : ''}
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
              </button>
            </div>
          )}
        </div>

        {/* Status dot */}
        <div className="absolute right-2.5 top-3.5">
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

      {/* Connector line down from card */}
      {hasChildren && expanded && (
        <>
          <div className="h-6 w-px bg-border" />

          {/* Horizontal line spanning all children */}
          {node.children.length > 1 && (
            <div className="relative flex w-full justify-center">
              <div className="absolute top-0 h-px bg-border" style={{
                left: `calc(50% - ${(node.children.length - 1) * 130}px)`,
                right: `calc(50% - ${(node.children.length - 1) * 130}px)`,
              }} />
            </div>
          )}

          {/* Children */}
          <div className="flex gap-3">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="h-6 w-px bg-border" />
                <OrgCard node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── List View: OrgListNode (compact indented list) ────────────────

function OrgListNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const theme = getDeptTheme(node.department?.code);

  return (
    <div>
      <div
        className={`group flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-all hover:shadow-sm ${
          depth === 0 ? 'border-blue/20 bg-blue/[0.02]' : ''
        }`}
      >
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
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${theme.gradient} text-xs font-semibold text-white`}>
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
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${theme.bg} ${theme.text}`}>
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
          {/* Vertical connector */}
          <div className="absolute bottom-3 left-[7px] top-0 w-px bg-border" />
          {node.children.map((child, i) => (
            <div key={child.id} className="relative">
              {/* Horizontal connector to child */}
              <div className="absolute left-[-13px] top-[22px] h-px w-[13px] bg-border" />
              {/* Dot on the vertical line */}
              <div className="absolute left-[-16px] top-[19px] h-1.5 w-1.5 rounded-full bg-border" />
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

  // Fetch org chart data
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['org-chart', departmentFilter],
    queryFn: () => {
      const params = departmentFilter && departmentFilter !== 'all'
        ? `?department=${departmentFilter}`
        : '';
      return apiClient.get<{ data: OrgEmployee[] }>(`/api/org-chart${params}`);
    },
  });

  // Fetch departments for filter
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

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 10, 150)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 10, 40)), []);
  const handleZoomReset = useCallback(() => setZoom(100), []);

  // Keyboard shortcut
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Org Chart
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employees.length} active employee{employees.length !== 1 ? 's' : ''}
            {tree.length > 0 && (
              <> &middot; {tree.length} top-level</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border p-0.5">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setViewMode('tree')}
            >
              <Network className="h-3.5 w-3.5" />
              Tree
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </Button>
          </div>

          {/* Department Filter */}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept: DepartmentOption) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Zoom Controls */}
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

      {/* Chart */}
      {isLoading ? (
        <div className="rounded-xl border bg-card p-8">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-px w-64" />
            <div className="flex gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : tree.length === 0 ? (
        <div className="rounded-xl border bg-card p-16 text-center">
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
          className="overflow-auto rounded-xl border bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,var(--border)_19px,var(--border)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,var(--border)_19px,var(--border)_20px)] bg-[length:20px_20px] bg-[position:10px_10px] p-8"
          style={{ minHeight: '400px' }}
        >
          <div
            className="flex justify-center"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <div className="flex flex-col items-center gap-0">
              {tree.map((node) => (
                <OrgCard key={node.id} node={node} isRoot />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border bg-card p-4"
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
  );
}

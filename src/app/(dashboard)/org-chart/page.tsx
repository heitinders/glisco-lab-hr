'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Users, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
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

const DEPT_COLORS: Record<string, string> = {
  ENG: 'border-l-blue-500',
  OPS: 'border-l-green-500',
  MKT: 'border-l-purple-500',
  FIN: 'border-l-amber-500',
  HR: 'border-l-pink-500',
  SALES: 'border-l-cyan-500',
  LEGAL: 'border-l-red-500',
  DESIGN: 'border-l-orange-500',
};

function getDeptColor(code: string | undefined): string {
  return DEPT_COLORS[code || ''] || 'border-l-gray-400';
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

// ─── OrgNode Component ─────────────────────────────────────────────

function OrgNode({ node, defaultExpanded }: { node: TreeNode; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  const deptColor = getDeptColor(node.department?.code);

  return (
    <div className="org-node">
      <div
        className={`group flex items-center gap-3 rounded-lg border border-l-4 ${deptColor} bg-card p-3 transition-shadow hover:shadow-md`}
      >
        {/* Expand/Collapse */}
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
            hasChildren
              ? 'cursor-pointer text-muted-foreground hover:bg-muted'
              : 'invisible'
          }`}
        >
          {hasChildren && (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        </button>

        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4B9EFF]/10 text-xs font-semibold text-[#4B9EFF]">
          {node.firstName[0]}
          {node.lastName[0]}
        </div>

        {/* Info */}
        <Link href={`/employees/${node.id}`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground group-hover:underline">
            {node.firstName} {node.lastName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {node.designation?.title || 'No designation'}
          </div>
        </Link>

        {/* Meta */}
        <div className="hidden items-center gap-2 sm:flex">
          {node.department && (
            <Badge variant="outline" className="text-xs">
              {node.department.name}
            </Badge>
          )}
          {hasChildren && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {node.children.length}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="ml-6 mt-1 space-y-1 border-l border-dashed border-border pl-4">
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} defaultExpanded={false} />
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
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 10, 60)), []);
  const handleZoomReset = useCallback(() => setZoom(100), []);

  // Reset zoom with keyboard shortcut
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
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            Org Chart
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employees.length} active employee{employees.length !== 1 ? 's' : ''} &middot;{' '}
            {tree.length} top-level node{tree.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Department Filter */}
          <Select
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
          >
            <SelectTrigger className="w-[180px]">
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
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomOut}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
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
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No employees found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {departmentFilter !== 'all'
              ? 'Try selecting a different department.'
              : 'Add employees to see the organizational chart.'}
          </p>
        </div>
      ) : (
        <div
          className="overflow-auto rounded-lg border bg-background p-4"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          <div className="space-y-1">
            {tree.map((node) => (
              <OrgNode key={node.id} node={node} defaultExpanded={true} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { ConditionGrade, DeviceStatus } from '@prisma/client';
import { CONDITION_SHORT_LABELS, STATUS_LABELS } from '@/lib/device-labels';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-slate-100 text-slate-700',
        success: 'bg-emerald-50 text-emerald-700',
        warning: 'bg-amber-50 text-amber-700',
        danger: 'bg-rose-50 text-rose-700',
        brand: 'bg-slate-900 text-white',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentPropsWithoutRef<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const CONDITION_TONES: Record<ConditionGrade, 'success' | 'neutral' | 'warning'> = {
  A: 'success',
  B: 'neutral',
  C: 'warning',
};

export function ConditionBadge({ grade, className }: { grade: ConditionGrade; className?: string }) {
  return (
    <Badge tone={CONDITION_TONES[grade]} className={className}>
      {CONDITION_SHORT_LABELS[grade]}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: DeviceStatus; className?: string }) {
  if (status === 'AVAILABLE') return null;
  const tone = status === 'SOLD' ? 'danger' : 'neutral';
  return (
    <Badge tone={tone} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

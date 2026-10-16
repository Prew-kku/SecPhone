import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-slate-100', className)} {...props} />;
}

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

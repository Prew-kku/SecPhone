import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentPropsWithoutRef<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentPropsWithoutRef<'label'>) {
  return (
    <label className={cn('mb-1.5 block text-sm font-medium text-slate-700', className)} {...props} />
  );
}

export function Textarea({ className, ...props }: React.ComponentPropsWithoutRef<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10',
        className,
      )}
      {...props}
    />
  );
}

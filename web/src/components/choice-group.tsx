import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  legend: string;
  name: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: string;
}

// Native radio buttons styled as large tap targets: keyboard and screen-reader behaviour for free.
export function ChoiceGroup<T extends string>({ legend, name, options, value, onChange, columns = "grid-cols-2" }: Props<T>) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn("grid gap-2", columns)}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="font-medium">{option.label}</span>
            {option.hint && <span className="text-xs opacity-80">{option.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

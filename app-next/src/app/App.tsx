import { Zap } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

export function App() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <header className="mb-8 flex items-center gap-3">
        <Zap className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">app-next</h1>
      </header>
      <p className="text-muted-foreground mb-6">
        Showcase rebuild of the lightning-terminal frontend. PR 2 — Tailwind v4 + shadcn primitives
        wired up. Features land progressively; see{' '}
        <a className="text-foreground underline-offset-4 hover:underline" href="./docs/ROADMAP.md">
          docs/ROADMAP.md
        </a>
        .
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
      <div className="mt-6 max-w-sm">
        <Input placeholder="Node password" type="password" />
      </div>
    </main>
  );
}

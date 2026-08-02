import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AiResult({
  output,
  isPending,
  error,
  fileNameHint,
}: {
  output: string | null;
  isPending: boolean;
  error: string | null;
  fileNameHint: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileNameHint}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">Generating with AI…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        <p className="max-w-sm text-[13px] text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <p className="text-sm">Fill in the inputs and run the tool to see results here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Copy
        </Button>
        <Button size="sm" variant="outline" onClick={download}>
          <Download className="size-3.5" />
          Download .md
        </Button>
      </div>
      <div
        className={cn(
          "prose prose-sm max-w-none flex-1 whitespace-pre-wrap rounded-xl border border-border bg-card/50 p-4 text-[13px] leading-relaxed",
        )}
      >
        {output}
      </div>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import {
  PDF_EVIDENCE_LABELS,
  primaryPdfEvidenceGrade,
  type PdfEvidenceGrade,
} from "@/lib/peptide/lexiconV2/pdfResearch/types";
import { cn } from "@/lib/utils";

const GRADE_STYLES: Record<PdfEvidenceGrade, string> = {
  A: "border-success/40 bg-success/10 text-success",
  B: "border-primary/40 bg-primary/10 text-primary",
  C: "border-warning/40 bg-warning/10 text-warning",
  D: "border-muted-foreground/30 bg-secondary text-muted-foreground",
  U: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function EvidenceGradeBadge({
  grade,
  className,
}: {
  grade: string | null | undefined;
  className?: string;
}) {
  if (!grade) return null;
  const primary = primaryPdfEvidenceGrade(grade);
  const label = primary ? PDF_EVIDENCE_LABELS[primary] : grade;
  const style = primary ? GRADE_STYLES[primary] : GRADE_STYLES.D;

  return (
    <Badge
      variant="outline"
      className={cn("max-w-full whitespace-normal text-left font-medium", style, className)}
      title={label}
    >
      Evidenz {grade}
    </Badge>
  );
}

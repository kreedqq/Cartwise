import type * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LexiconSectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/TaskReportFormPreview.jsx
//
// BB-129: shows a form the way an employee will see it (same fields as the real answer
// dialog). The inputs work so the admin can try them, but nothing is saved or sent anywhere.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionField } from "../../TaskReportForms/TaskReportFormFields";

export default function TaskReportFormPreview({ name, description, questions, note }) {
  const [answers, setAnswers] = useState({});
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));

  return (
    <Card>
      <CardHeader className="pb-3">
        {note && <p className="text-xs text-muted-foreground mb-2">{note}</p>}
        <CardTitle className="text-xl">{name?.trim() || "Untitled form"}</CardTitle>
        {description?.trim() && <p className="text-sm text-muted-foreground whitespace-pre-line">{description.trim()}</p>}
        {questions.some((q) => q.required) && (
          <p className="text-xs text-muted-foreground pt-1"><span className="text-destructive">*</span> Required</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        {questions.map((q, i) => (
          <div key={q.id} className="border-t pt-5 first:border-t-0 first:pt-0">
            <QuestionField q={q} index={i} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

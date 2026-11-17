"use client";
// components/Dashboard/DashboardContent/TaskReportForms/TaskReportFormFields.jsx
//
// BB-129: one renderer for custom clock-out form questions, shared by the admin Preview,
// the employee's answer dialog and the read-only answer views, so they always match.
// Values use the UI shapes from lib/taskReportFormsApi.js (yes_no = true/false, number = string).

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ANSWER_LIMITS, fmtAnswer } from "@/lib/taskReportFormsApi";

// Question heading + input. `error` is a message shown under the input.
export function QuestionField({ q, index, value, onChange, disabled = false, error }) {
  return (
    <div className="space-y-2" id={`answer-${q.id}`}>
      <QuestionHeading q={q} index={index} />
      <QuestionInput q={q} value={value} onChange={onChange} disabled={disabled} invalid={Boolean(error)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function QuestionHeading({ q, index }) {
  return (
    <div>
      <p className="text-sm font-medium">
        {index !== undefined && <span className="text-muted-foreground mr-1">{index + 1}.</span>}
        {q.label?.trim() || <span className="text-muted-foreground italic">Untitled question</span>}
        {q.required && <span className="text-destructive ml-0.5">*</span>}
      </p>
      {q.helpText?.trim() && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{q.helpText.trim()}</p>}
    </div>
  );
}

export function QuestionInput({ q, value, onChange, disabled = false, invalid = false }) {
  const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
  const bad = invalid ? "border-destructive" : "";
  switch (q.type) {
    case "short_text":
      return (
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          maxLength={ANSWER_LIMITS.short_text} placeholder={disabled ? "" : "Your answer"} className={`max-w-md ${bad}`} />
      );
    case "paragraph":
      return (
        <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          maxLength={ANSWER_LIMITS.paragraph} placeholder={disabled ? "" : "Your answer"} rows={3} className={bad} />
      );
    case "number":
      return (
        <Input type="number" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          disabled={disabled} className={`max-w-[12rem] ${bad}`} />
      );
    case "date":
      return <Input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`max-w-[12rem] ${bad}`} />;
    case "time":
      // <input type="time"> gives "HH:mm" (24-hour), which is what the server stores.
      return <Input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`max-w-[12rem] ${bad}`} />;
    case "yes_no":
      return (
        <div className="flex gap-2">
          {[{ v: true, label: "Yes" }, { v: false, label: "No" }].map(({ v, label }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value === v ? undefined : v)}
              aria-pressed={value === v}
              className={`px-4 py-1.5 rounded-md border text-sm transition-colors disabled:cursor-not-allowed ${
                value === v
                  ? "border-orange-500 text-foreground font-medium"
                  : `${invalid ? "border-destructive" : "border-input"} text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      );
    case "single_choice":
      return (
        <div className="space-y-2">
          {options.map((opt, i) => (
            <label key={`${opt}-${i}`} className={`flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
              <input
                type="radio"
                name={`answer-${q.id}`}
                checked={value === opt}
                onChange={() => onChange(opt)}
                disabled={disabled}
                className="h-4 w-4 accent-orange-500"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "checkboxes": {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {options.map((opt, i) => {
            const id = `answer-${q.id}-${i}`;
            return (
              <div key={id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={picked.includes(opt)}
                  disabled={disabled}
                  onCheckedChange={(c) => onChange(c ? [...picked, opt] : picked.filter((p) => p !== opt))}
                />
                <Label htmlFor={id} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            );
          })}
        </div>
      );
    }
    case "dropdown":
      return (
        <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className={`max-w-xs ${bad}`}><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>
            {options.map((opt, i) => <SelectItem key={`${opt}-${i}`} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    default:
      return <p className="text-xs text-muted-foreground">Unknown question type: {q.type}</p>;
  }
}

// Read-only list of questions and the answers given (server answer values).
export function AnswerList({ questions, answers }) {
  if (!questions?.length) return <p className="text-sm text-muted-foreground">This form has no questions.</p>;
  return (
    <ol className="space-y-4">
      {questions.map((q, i) => {
        const shown = fmtAnswer(q, answers?.[q.id]);
        return (
          <li key={q.id} className="text-sm space-y-1">
            <QuestionHeading q={q} index={i} />
            {shown === null
              ? <p className="text-muted-foreground italic pl-4">No answer</p>
              : <p className="whitespace-pre-wrap pl-4">{shown}</p>}
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { Alert } from "@/components/ui/alert";

type ActionFeedbackProps = {
  success?: string | null;
  error?: string | null;
};

/** Consistent success / error banners for assign & shift forms. */
export function ActionFeedback({ success, error }: ActionFeedbackProps) {
  if (error) {
    return <Alert title="Could not complete" variant="error">{error}</Alert>;
  }
  if (success) {
    return <Alert title="Done" variant="success">{success}</Alert>;
  }
  return null;
}

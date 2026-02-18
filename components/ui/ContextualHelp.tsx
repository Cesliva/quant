"use client";

interface ContextualHelpProps {
  content: string;
  className?: string;
}

export default function ContextualHelp({ 
  content,
  className = ""
}: ContextualHelpProps) {
  return (
    <span className={`text-xs text-slate-400 font-normal ml-2 ${className}`}>
      {content}
    </span>
  );
}

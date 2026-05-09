"use client";

import { useState } from "react";

export function CopyCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="cmd"
      onClick={() => {
        navigator.clipboard.writeText(cmd).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <span>
        <span className="p">$</span>
        {cmd}
      </span>
      <span className="cpy">{copied ? "copied!" : "copy"}</span>
    </div>
  );
}

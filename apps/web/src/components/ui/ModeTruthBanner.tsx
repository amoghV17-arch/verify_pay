import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Shield, Zap } from 'lucide-react';

export interface SystemModeData {
  paypal: 'sandbox' | 'mock';
  llm: {
    provider: string;
    model: string;
    live: boolean;
  };
  demoMode: boolean;
  demoBudgetCapActive?: boolean;
  maxDemoBudgetCents?: number;
  webhookConfigured: boolean;
  version: string;
  commit: string;
}

interface ModeTruthBannerProps {
  className?: string;
  showWhenLive?: boolean;
}

export const ModeTruthBanner: React.FC<ModeTruthBannerProps> = ({
  className = '',
  showWhenLive = true,
}) => {
  const [modeData, setModeData] = useState<SystemModeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch('/api/system/mode')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SystemModeData | null) => {
        if (mounted) {
          setModeData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !modeData) return null;

  const isSimulated = modeData.paypal === 'mock' || !modeData.llm.live;
  const isFullyLive = modeData.paypal === 'sandbox' && modeData.llm.live && modeData.webhookConfigured;

  if (isSimulated && modeData.demoMode) {
    return (
      <aside
        role="alert"
        aria-live="polite"
        className={`w-full bg-[#B3392B] text-white px-4 py-2 flex items-center justify-between text-xs font-medium tracking-wide shadow-sm z-40 ${className}`}
        data-testid="mode-truth-banner-simulated"
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" aria-hidden="true" />
            <span>
              <strong>Not live:</strong> this demo is using simulated payments or AI.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] opacity-90 font-mono">
            <span>PayPal: {modeData.paypal}</span>
            <span>·</span>
            <span>LLM: {modeData.llm.provider}</span>
          </div>
        </div>
      </aside>
    );
  }

  if (!showWhenLive) return null;

  if (!isFullyLive) {
    return (
      <aside
        aria-label="System verification status"
        className={`w-full bg-[#FEF3C7] text-[#78350F] border-b border-[#F59E0B] px-4 py-1.5 flex items-center justify-between text-xs z-30 ${className}`}
        data-testid="mode-truth-banner-partial"
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-[#92400E] shrink-0" aria-hidden="true" />
            <span>
              PayPal Sandbox &amp; Live AI Active · Webhook ID Not Configured
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span>AI: {modeData.llm.provider} ({modeData.llm.model})</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="System verification status"
      className={`w-full bg-[#E3EFEC] text-[#202722] border-b border-[#C3DCD5] px-4 py-1.5 flex items-center justify-between text-xs z-30 ${className}`}
      data-testid="mode-truth-banner-live"
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 font-medium text-[#1E4D40]">
          <CheckCircle className="w-3.5 h-3.5 text-[#1E4D40] shrink-0" aria-hidden="true" />
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#1E4D40] text-white font-mono text-[10px] font-bold tracking-wider">
            LIVE SANDBOX VERIFIED
          </span>
          <span>
            PayPal Sandbox Verified · Real API Execution · Webhooks Active
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#202722] font-mono">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#1E4D40]" />
            AI: {modeData.llm.provider} ({modeData.llm.model})
          </span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#1E4D40]" />
            Version: {modeData.version} ({modeData.commit.substring(0, 7)})
          </span>
        </div>
      </div>
    </aside>
  );
};


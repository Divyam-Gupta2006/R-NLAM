'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  RotateCcw, 
  XCircle, 
  HelpCircle, 
  ShieldCheck, 
  CreditCard, 
  KeyRound,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useAudit } from '@/context/AuditContext';
import { useRole } from '@/context/RoleContext';
import { workflowApi, parcelsApi, compensationApi, possessionApi } from '@/lib/api/client';

export type ActionType = 
  | 'APPROVE' 
  | 'RETURN' 
  | 'REJECT' 
  | 'RAISE_QUERY' 
  | 'VERIFY_PARCEL' 
  | 'INITIATE_PAYMENT' 
  | 'HANDOVER_POSSESSION';

interface ActionButtonsProps {
  entityId: string;
  workflowInstanceId?: string;
  fromStage?: string;
  toStage?: string;
  entityType?: string;
  allowedActions?: ActionType[];
  onActionComplete?: (action: ActionType, remarks: string) => void;
  compact?: boolean;
}

export function ActionButtons({
  entityId,
  workflowInstanceId,
  fromStage = 'Proposal Scrutiny',
  toStage = 'Preliminary Notification (Sec 11)',
  entityType = 'PARCEL',
  allowedActions = [
    'APPROVE',
    'RETURN',
    'REJECT',
    'RAISE_QUERY',
    'VERIFY_PARCEL',
    'INITIATE_PAYMENT',
    'HANDOVER_POSSESSION',
  ],
  onActionComplete,
  compact = false,
}: ActionButtonsProps) {
  const { addAuditLog } = useAudit();
  const { activeRole, currentRoleOption, showToast } = useRole();
  const [activeModalAction, setActiveModalAction] = useState<ActionType | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionConfigs: Record<
    ActionType,
    { label: string; icon: React.ReactNode; color: string; hoverColor: string }
  > = {
    APPROVE: {
      label: 'Approve',
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: 'bg-emerald-600 text-white',
      hoverColor: 'hover:bg-emerald-700',
    },
    RETURN: {
      label: 'Return',
      icon: <RotateCcw className="w-4 h-4" />,
      color: 'bg-amber-600 text-white',
      hoverColor: 'hover:bg-amber-700',
    },
    REJECT: {
      label: 'Reject',
      icon: <XCircle className="w-4 h-4" />,
      color: 'bg-rose-600 text-white',
      hoverColor: 'hover:bg-rose-700',
    },
    RAISE_QUERY: {
      label: 'Raise Query',
      icon: <HelpCircle className="w-4 h-4" />,
      color: 'bg-sky-600 text-white',
      hoverColor: 'hover:bg-sky-700',
    },
    VERIFY_PARCEL: {
      label: 'Verify Parcel',
      icon: <ShieldCheck className="w-4 h-4" />,
      color: 'bg-indigo-600 text-white',
      hoverColor: 'hover:bg-indigo-700',
    },
    INITIATE_PAYMENT: {
      label: 'Initiate Payment',
      icon: <CreditCard className="w-4 h-4" />,
      color: 'bg-teal-600 text-white',
      hoverColor: 'hover:bg-teal-700',
    },
    HANDOVER_POSSESSION: {
      label: 'Handover Possession',
      icon: <KeyRound className="w-4 h-4" />,
      color: 'bg-purple-600 text-white',
      hoverColor: 'hover:bg-purple-700',
    },
  };

  const handleConfirmAction = async () => {
    if (!activeModalAction) return;

    setSubmitting(true);
    setError(null);

    const actionText = actionConfigs[activeModalAction].label;

    try {
      if (workflowInstanceId) {
        const wfRes = await workflowApi.executeAction({
          instanceId: workflowInstanceId,
          actionName: actionText,
          performedBy: activeRole,
          fromStage,
          toStage,
          remarks,
        });

        if (wfRes.error) {
          setError(`Workflow Action Error: ${wfRes.error}`);
          setSubmitting(false);
          return;
        }
      } else if (activeModalAction === 'VERIFY_PARCEL') {
        const verRes = await parcelsApi.verify({
          parcelId: entityId,
          verifiedBy: activeRole,
          latitude: 21.1458,
          longitude: 79.0882,
          notes: remarks || 'Officer verified parcel boundary',
          status: 'OFFICER_VERIFIED',
        });

        if (verRes.error) {
          setError(`Parcel Verification Error: ${verRes.error}`);
          setSubmitting(false);
          return;
        }
      }

      // Write to audit context
      addAuditLog(
        activeModalAction,
        entityType,
        entityId,
        remarks ? `Action: ${actionText}. Remarks: ${remarks}` : `Executed action: ${actionText}`,
        activeRole,
        currentRoleOption.label
      );

      showToast(`${actionText} recorded on ${entityType} #${entityId}`);

      if (onActionComplete) {
        onActionComplete(activeModalAction, remarks);
      }

      setActiveModalAction(null);
      setRemarks('');
    } catch (err: any) {
      setError(err.message || 'Action execution error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {allowedActions.map((actionKey) => {
          const config = actionConfigs[actionKey];
          if (!config) return null;

          return (
            <button
              key={actionKey}
              onClick={() => {
                setError(null);
                setActiveModalAction(actionKey);
              }}
              className={`inline-flex items-center gap-1.5 font-medium rounded-md shadow-sm transition-all text-xs ${
                compact ? 'px-2 py-1' : 'px-3 py-1.5'
              } ${config.color} ${config.hoverColor}`}
              title={config.label}
            >
              {config.icon}
              {!compact && <span>{config.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Confirmation & Remarks Modal */}
      {activeModalAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-base">
                  Confirm {actionConfigs[activeModalAction].label}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalAction(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p>
                  You are performing <strong className="text-slate-900">{actionConfigs[activeModalAction].label}</strong> on{' '}
                  <span className="font-mono bg-slate-200 px-1 rounded text-slate-800">{entityType} #{entityId}</span>.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  This action executes a NestJS workflow state transition and records a SHA-256 audit entry.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Official Remarks / Justification
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter detailed remarks for statutory audit compliance..."
                  rows={3}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setActiveModalAction(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmAction}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-sm flex items-center space-x-1.5 ${actionConfigs[activeModalAction].color} ${actionConfigs[activeModalAction].hoverColor}`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing...</span>
                    </>
                  ) : (
                    <span>Confirm & Sign Audit Log</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

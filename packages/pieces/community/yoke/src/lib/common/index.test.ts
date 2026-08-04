import { describe, expect, it } from 'vitest';
import { flattenInstruction, yokeApprovalPayload } from './index';

describe('flattenInstruction', () => {
  it('joins tags and lifts owner fields', () => {
    const flat = flattenInstruction({
      id: 7,
      title: 'Refund policy',
      tags: ['policy', 'finance'],
      owner: { id: 3, name: 'Ada', email: 'ada@example.com' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      content_markdown: '# Refunds',
    });

    expect(flat.tags).toBe('policy, finance');
    expect(flat.owner_id).toBe(3);
    expect(flat.owner_email).toBe('ada@example.com');
    expect(flat.content_html).toBeNull();
  });

  it('nulls owner fields when the document has no owner', () => {
    const flat = flattenInstruction({
      id: 8,
      title: 'Orphan',
      tags: [],
      owner: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    expect(flat.tags).toBe('');
    expect(flat.owner_id).toBeNull();
    expect(flat.owner_name).toBeNull();
    expect(flat.content_markdown).toBeNull();
  });
});

describe('decisionFromAction', () => {
  it('maps approve to true', () => {
    expect(yokeApprovalPayload.decisionFromAction('approve')).toBe(true);
  });

  it('maps both rejection spellings to false', () => {
    expect(yokeApprovalPayload.decisionFromAction('reject')).toBe(false);
    expect(yokeApprovalPayload.decisionFromAction('disapprove')).toBe(false);
  });

  it('maps input submissions and missing actions to null', () => {
    expect(yokeApprovalPayload.decisionFromAction('submit')).toBeNull();
    expect(yokeApprovalPayload.decisionFromAction(null)).toBeNull();
  });
});

describe('readFeedback', () => {
  it('reads note then response', () => {
    expect(yokeApprovalPayload.readFeedback({ note: 'looks fine' })).toBe(
      'looks fine',
    );
    expect(yokeApprovalPayload.readFeedback({ response: 'ACME Ltd' })).toBe(
      'ACME Ltd',
    );
  });

  it('returns null for bodies without usable text', () => {
    expect(yokeApprovalPayload.readFeedback(null)).toBeNull();
    expect(yokeApprovalPayload.readFeedback('note=hi')).toBeNull();
    expect(yokeApprovalPayload.readFeedback({ note: 42 })).toBeNull();
  });
});

describe('idempotencyKey', () => {
  it('prefers the supplied approval id', () => {
    const key = yokeApprovalPayload.idempotencyKey({
      approvalId: 'invoice-42',
      runId: 'run1',
      stepName: 'step_1',
    });
    expect(key).toBe('invoice-42');
  });

  it('falls back to run and step when empty', () => {
    expect(
      yokeApprovalPayload.idempotencyKey({
        approvalId: '',
        runId: 'run1',
        stepName: 'step_1',
      }),
    ).toBe('run1:step_1');
    expect(
      yokeApprovalPayload.idempotencyKey({
        approvalId: undefined,
        runId: 'run1',
        stepName: 'step_1',
      }),
    ).toBe('run1:step_1');
  });
});

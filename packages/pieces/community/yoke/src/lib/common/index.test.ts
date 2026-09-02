import { describe, expect, it } from 'vitest';
import {
  flattenInstruction,
  flattenReceivedEmail,
  flattenReceivedEmailRow,
  YokeReceivedEmail,
  YokeReceivedEmailRow,
  yokeApprovalPayload,
} from './index';

describe('flattenInstruction', () => {
  it('joins tags and lifts owner fields', () => {
    const flat = flattenInstruction({
      id: 7,
      title: 'Refund policy',
      tags: ['policy', 'finance'],
      owner: { id: 3, name: 'Ada', email: 'ada@example.com' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      body: '# Refunds',
    });

    expect(flat.tags).toBe('policy, finance');
    expect(flat.owner_id).toBe(3);
    expect(flat.owner_email).toBe('ada@example.com');
    expect(flat.body).toBe('# Refunds');
  });

  it('keeps an empty body as an empty string', () => {
    const flat = flattenInstruction({
      id: 9,
      title: 'Placeholder',
      tags: [],
      owner: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      body: '',
    });

    expect(flat.body).toBe('');
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
    expect(flat.body).toBeNull();
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

describe('flattenReceivedEmail', () => {
  const email = (overrides: Partial<YokeReceivedEmail> = {}): YokeReceivedEmail => ({
    id: 'rem_9k2f7ax4m1q8w3zzzzzzzz',
    message_id: '<CAF=abc123@mail.example.com>',
    from: 'ap@supplier.example.com',
    subject: 'Invoice 55021 - August',
    received_at: '2026-08-31T14:21:58Z',
    recorded_at: '2026-08-31T14:22:03Z',
    has_attachments: true,
    attachment_count: 1,
    content_available_until: '2026-09-30T14:22:03Z',
    inbox: {
      token: 'k3f9qm2xz7ab',
      label: 'Invoices',
      label_slug: 'invoices',
      address: 'invoices-k3f9qm2xz7ab@inbox.yokecontrol.ai',
      routing_address: 'k3f9qm2xz7ab@inbox.yokecontrol.ai',
      discarded: false,
    },
    text_body: 'Please find attached...',
    html_body: '<div>Please find attached...</div>',
    headers: { date: 'Mon, 31 Aug 2026 14:21:58 +0000', to: ['invoices@example.com'], cc: [] },
    attachments: [
      {
        position: 0,
        filename: 'invoice-55021.pdf',
        content_type: 'application/pdf',
        byte_size: 84213,
        download_path: '/api/v1/received_emails/rem_9k2f7ax4m1q8w3zzzzzzzz/attachments/0',
      },
    ],
    attachments_truncated: false,
    ...overrides,
  });

  it('lifts the inbox object into flat fields', () => {
    const flat = flattenReceivedEmail(email(), { includeHtml: true });

    expect(flat.inbox_token).toBe('k3f9qm2xz7ab');
    expect(flat.inbox_label).toBe('Invoices');
    expect(flat.inbox_address).toBe('invoices-k3f9qm2xz7ab@inbox.yokecontrol.ai');
    expect(flat.inbox_discarded).toBe(false);
  });

  it('keeps attachments an array and headers an object', () => {
    const flat = flattenReceivedEmail(email(), { includeHtml: true });

    expect(Array.isArray(flat.attachments)).toBe(true);
    expect(flat.attachments[0].download_path).toContain('/attachments/0');
    expect(flat.headers['to']).toEqual(['invoices@example.com']);
  });

  it('drops html_body entirely when includeHtml is false', () => {
    const flat = flattenReceivedEmail(email(), { includeHtml: false });

    // Dropped, not nulled: the mapping UI must not offer a field that is always
    // empty.
    expect('html_body' in flat).toBe(false);
    expect(flat.text_body).toBe('Please find attached...');
  });

  it('includes html_body as null when asked for and the message has none', () => {
    const flat = flattenReceivedEmail(email({ html_body: null }), { includeHtml: true });

    expect('html_body' in flat).toBe(true);
    expect(flat.html_body).toBeNull();
  });

  it('survives an incinerated message, whose bodies are null', () => {
    const flat = flattenReceivedEmail(
      email({ text_body: null, html_body: null, attachments: [], content_available_until: null }),
      { includeHtml: true },
    );

    expect(flat.text_body).toBeNull();
    expect(flat.attachments).toEqual([]);
    expect(flat.content_available_until).toBeNull();
    // Metadata outlives the raw message, which is the whole point of the split.
    expect(flat.id).toBe('rem_9k2f7ax4m1q8w3zzzzzzzz');
    expect(flat.attachment_count).toBe(1);
  });

  it('keeps a null byte_size, which means the download will refuse', () => {
    const flat = flattenReceivedEmail(
      email({
        attachments: [
          {
            position: 0,
            filename: 'bad.bin',
            content_type: 'application/octet-stream',
            byte_size: null,
            download_path: '/api/v1/received_emails/rem_x/attachments/0',
          },
        ],
      }),
      { includeHtml: true },
    );

    expect(flat.attachments[0].byte_size).toBeNull();
  });
});

describe('flattenReceivedEmailRow', () => {
  const row: YokeReceivedEmailRow = {
    id: 'rem_9k2f7ax4m1q8w3zzzzzzzz',
    message_id: '<CAF=abc123@mail.example.com>',
    from: 'ap@supplier.example.com',
    subject: 'Invoice 55021 - August',
    received_at: '2026-08-31T14:21:58Z',
    recorded_at: '2026-08-31T14:22:03Z',
    has_attachments: true,
    attachment_count: 3,
    content_available_until: '2026-09-30T14:22:03Z',
    inbox: {
      token: 'k3f9qm2xz7ab',
      label: 'Invoices',
      label_slug: 'invoices',
      address: 'invoices-k3f9qm2xz7ab@inbox.yokecontrol.ai',
      routing_address: 'k3f9qm2xz7ab@inbox.yokecontrol.ai',
      discarded: false,
    },
    content_available: true,
    webhook_status: 'succeeded',
    content_path: '/api/v1/received_emails/rem_9k2f7ax4m1q8w3zzzzzzzz',
  };

  it('carries the three index-only keys and no body fields', () => {
    const flat = flattenReceivedEmailRow(row);

    expect(flat.content_available).toBe(true);
    expect(flat.webhook_status).toBe('succeeded');
    expect(flat.content_path).toBe('/api/v1/received_emails/rem_9k2f7ax4m1q8w3zzzzzzzz');
    expect('text_body' in flat).toBe(false);
    expect('attachments' in flat).toBe(false);
  });

  it('lifts the inbox the same way the show flattener does', () => {
    const flat = flattenReceivedEmailRow(row);

    expect(flat.inbox_token).toBe('k3f9qm2xz7ab');
    expect(flat.inbox_label).toBe('Invoices');
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  mockGetScenario,
  mockCreateScenario,
  mockUpdateScenario,
} = vi.hoisted(() => ({
  mockGetScenario: vi.fn(),
  mockCreateScenario: vi.fn(),
  mockUpdateScenario: vi.fn(),
}));

vi.mock('../src/lib/themeWorldAdminApi', () => ({
  getScenario: mockGetScenario,
  createScenario: mockCreateScenario,
  updateScenario: mockUpdateScenario,
  getErrorMessage: (error) => error?.message || 'Fehler',
}));

vi.mock('../src/components/admin/AdminStatusBadge', () => ({ default: () => null }));
vi.mock('../src/components/admin/AdminSaveState', () => ({ default: () => null }));
vi.mock('../src/components/admin/AdminSeoFields', () => ({ default: () => null }));
vi.mock('../src/components/admin/AdminImageField', () => ({ default: () => null }));
vi.mock('../src/components/admin/AdminRichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

import AdminScenarioForm from '../src/components/admin/AdminScenarioForm.jsx';

const THEME_WORLD_ID = 'theme-world-id';
const SCENARIO_ID = 'scenario-id';

function renderForm(props = {}) {
  return render(
    <AdminScenarioForm
      showNotification={vi.fn()}
      setView={vi.fn()}
      themeWorldId={THEME_WORLD_ID}
      scenarioId={null}
      setSelectedScenarioId={vi.fn()}
      {...props}
    />,
  );
}

function deliverySelect(container) {
  return container.querySelector('select');
}

describe('Phase 8.13: Szenario-Lieferart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the Vor Ort selection with the canonical presence value', async () => {
    mockCreateScenario.mockResolvedValue({ id: SCENARIO_ID, status: 'draft' });
    const { container } = renderForm();
    const select = deliverySelect(container);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Berufseinstieg als Fitness-Trainer'), {
        target: { value: 'Szenario vor Ort' },
      });
      fireEvent.change(select, { target: { value: 'presence' } });
      fireEvent.click(screen.getAllByText('Speichern')[0]);
    });

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalledTimes(1));
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.cta_config.delivery).toBe('presence');
    expect(JSON.stringify(payload)).not.toContain('in_person');
  });

  it('normalizes a legacy in_person value for display and saving', async () => {
    mockGetScenario.mockResolvedValue({
      id: SCENARIO_ID,
      label_de: 'Bestehendes Szenario',
      slug: 'bestehendes-szenario',
      cta_config: { delivery: 'in_person' },
      status: 'draft',
    });
    mockUpdateScenario.mockResolvedValue({ id: SCENARIO_ID, status: 'draft' });
    const { container } = renderForm({ scenarioId: SCENARIO_ID });

    await waitFor(() => expect(deliverySelect(container).value).toBe('presence'));
    await act(async () => {
      fireEvent.click(screen.getAllByText('Speichern')[0]);
    });

    await waitFor(() => expect(mockUpdateScenario).toHaveBeenCalledTimes(1));
    const [, payload] = mockUpdateScenario.mock.calls[0];
    expect(payload.cta_config.delivery).toBe('presence');
  });

  it('sends normalized semantic rich text in the scenario save payload', async () => {
    mockCreateScenario.mockResolvedValue({ id: SCENARIO_ID, status: 'draft' });
    renderForm();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Berufseinstieg als Fitness-Trainer'), {
        target: { value: 'Formatierter Artikel' },
      });
      fireEvent.change(screen.getByTestId('rich-text-editor'), {
        target: { value: '<p><strong><em>Wichtig</em></strong></p>' },
      });
      fireEvent.click(screen.getAllByText('Speichern')[0]);
    });

    await waitFor(() => expect(mockCreateScenario).toHaveBeenCalledTimes(1));
    const [, payload] = mockCreateScenario.mock.calls[0];
    expect(payload.content_html).toBe('<p><strong><em>Wichtig</em></strong></p>');
    expect(payload.content_html).not.toContain('style=');
  });

  it('keeps the generated slug stable when the title has not changed', async () => {
    renderForm();
    const title = screen.getByPlaceholderText('Berufseinstieg als Fitness-Trainer');
    const slug = screen.getByPlaceholderText('berufseinstieg');

    await act(async () => {
      fireEvent.change(title, { target: { value: 'Einstieg in den Beruf' } });
    });
    await waitFor(() => expect(slug.value).toBe('einstieg-in-den-beruf'));

    await act(async () => {
      fireEvent.click(screen.getByText('Aus Titel'));
      fireEvent.click(screen.getByText('Aus Titel'));
    });

    expect(slug.value).toBe('einstieg-in-den-beruf');
  });
});
